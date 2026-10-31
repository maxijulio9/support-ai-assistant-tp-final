#Orchestrator del pipeline de procesamiento de eventos issue created y commment created.
#Coordina los módulos M2, M3, M4 y M5 según el tipo de evento recibido.


import logging
import time
from sqlalchemy import text
from app.core.database import get_db
from app.core.jsm_status_actions import JSM_STATUS_ACTION_ESCALATE, JSM_STATUS_ACTION_AWAITING_CUSTOMER, JSM_STATUS_ACTION_RESOLVED
from app.modules.webhook_receiver.schemas import NormalizedEvent
from app.modules.ticket_analyzer.service import TicketAnalyzer
from app.modules.interaction_logger.service import InteractionLogger
from app.modules.knowledge_retriever.service import KnowledgeRetriever
from app.modules.response_generator.service import ResponseGenerator
from app.modules.response_generator.schemas import (
    ACTION_AUTO_PUBLISH,
    ACTION_NEEDS_REVIEW,
    ACTION_REQUEST_INFO,
    ACTION_ESCALATE,
    ESCALATION_REASON_LOW_CONFIDENCE,

)
from app.modules.jsm_executor.client import JsmExecutor
from app.modules.ticket_analyzer.schemas import TicketAnalysis
from app.modules.internal_api.services.workflow_discovery_service import WorkflowDiscoveryService
from app.modules.internal_api.project_workflow_map import ProjectWorkflowMap
from app.modules.internal_api.repositories.project_workflow_repository import ProjectWorkflowRepository
from app.modules.internal_api.repositories.jsm_credentials_repository import JsmCredentialsRepository

logger = logging.getLogger(__name__)


class Orchestrator:

    # instancia los módulos que va a coordinar
    def __init__(self):
        self.ticket_analyzer = TicketAnalyzer()
        self.interaction_logger = InteractionLogger()
        self.knowledge_retriever = KnowledgeRetriever()
        self.response_generator = ResponseGenerator()
        #self.jsm_executor = JsmExecutor()
        self.workflow_discovery_service = WorkflowDiscoveryService()
        self.credentials_repository = JsmCredentialsRepository()
        self.project_workflow_repository = ProjectWorkflowRepository()


    # punto de entrada del pipeline
    # ejecuta m2, m3 y m4. m5 todavia no esta cableado
    async def process_event(self, event: NormalizedEvent) -> dict:
        
        logger.info(f"[{event.issue_key}] iniciando procesamiento del evento {event.event_type}")
        started_at = time.perf_counter()

        # obtener credenciales de JSM
        credentials = self.credentials_repository.get_credentials()
        if credentials is None:
            logger.error(f"[{event.issue_key}] no hay credenciales de jsm configuradas, no se puede procesar el evento")
            return {"status": "error", "issue_key": event.issue_key, "reason": "jsm no configurado"}

        self.jsm_executor = JsmExecutor(
            base_url=credentials["base_url"],
            user_email=credentials["user_email"],
            api_token=credentials["api_token"],
        )

        #m2 analisis y clasificaciòn del ticket
        analysis = await self.ticket_analyzer.analyze(event, self.jsm_executor)

        logger.info(f"[{event.issue_key}] M2 listorti, priority={analysis.priority}, country={analysis.country}")

        # persiste el resultado del analisis en la bd relacional, guarda el id para completarlo despues
        interaction_id = self.interaction_logger.log_analysis(analysis)

        # guarda la hora real de entrada del evento y la de creacion del ticket en jsm, para medir los tiempos de repsuesta
        self.interaction_logger.record_event_times(interaction_id, getattr(event, "received_at", None), getattr(event, "created_at", None))

        # si m2 ya determino que esto escala directo (out of scope o resolved_by l2),
        # nos ahorramos la consulta a m3 y la generacion de m4, que igual terminarian escalando
        if analysis.escalate_direct:
            self.interaction_logger.update_interaction_result(
                interaction_id,
                chunks_retrieved_count=0,
                generated_response=None,
                confidence_score=None,
                decision=ACTION_ESCALATE,
            )
            self.interaction_logger.record_processing_time(interaction_id, int((time.perf_counter() - started_at) * 1000))

            transition_id, target_status_name = await self._resolve_transition_id(event.issue_key, analysis.project_id, JSM_STATUS_ACTION_ESCALATE, analysis.issue_type_id)
            
            if transition_id:
                try:
                    await self.jsm_executor.transition_issue(event.issue_key, transition_id)
                    self.interaction_logger.update_ticket_status(event.issue_key, target_status_name)
                    logger.info(f"[{event.issue_key}] escalate_direct desde m2, transicionado en jsm")

                    acknowledgment = self.ticket_analyzer.llm_client.generate_escalation_acknowledgment(analysis.summary, None)
                    if acknowledgment:
                        await self.jsm_executor.post_comment(event.issue_key, acknowledgment, public=True)
                        self.interaction_logger.mark_first_response(interaction_id, resolved=False)

                    internal_note = self._build_internal_escalation_note(analysis, self._direct_escalation_reason(analysis))
                    await self.jsm_executor.post_comment(event.issue_key, internal_note, public=False)

                except Exception as e:
                    logger.error(f"[{event.issue_key}] fallo al transicionar o comentar en jsm: {type(e).__name__}: {e}")
                          
            return {
                "status": "processed",
                "issue_key": event.issue_key,
                "analysis": analysis.model_dump(),
                "retrieved_chunks": [],
                "generated_response": {"action_type": ACTION_ESCALATE},
            }

        # el cliente esta confirmando que ya resolvio su consulta, no hace falta generar nada nuevo
        if analysis.intent == "cierre_conversacion":
            self.interaction_logger.update_interaction_result(
                interaction_id,
                chunks_retrieved_count=0,
                generated_response=None,
                confidence_score=None,
                decision="RESOLVED",
            )
            self.interaction_logger.mark_resolved(interaction_id)
            self.interaction_logger.record_processing_time(interaction_id, int((time.perf_counter() - started_at) * 1000))

            transition_id, target_status_name = await self._resolve_transition_id(event.issue_key, analysis.project_id, JSM_STATUS_ACTION_RESOLVED, analysis.issue_type_id)
            
            
            if transition_id:
                try:
                    await self.jsm_executor.transition_issue(event.issue_key, transition_id)
                    self.interaction_logger.update_ticket_status(event.issue_key, target_status_name)
                    logger.info(f"[{event.issue_key}] cierre de conversacion detectado, transicionado a resolved")
                except Exception as e:
                    logger.error(f"[{event.issue_key}] fallo al transicionar a resolved: {type(e).__name__}: {e}")
            else:
                logger.warning(f"[{event.issue_key}] cierre de conversacion detectado, sin transicion configurada para resolved")

            return {
                "status": "processed",
                "issue_key": event.issue_key,
                "analysis": analysis.model_dump(),
                "retrieved_chunks": [],
                "generated_response": {"action_type": "RESOLVED"},
            }

        # busca en la kb los chunks mas relevantes segun el analisis de M2 en M3
        retrieval_result = self.knowledge_retriever.retrieve(analysis)

        #m4 genera la respuesta en base al contexto recuperado por m3 y analisis de m2
        generated_response = self.response_generator.generate(analysis, retrieval_result)

        logger.info(f"[{event.issue_key}] M4 listo, action_type={generated_response.action_type}")

        # reintenta una sola vez, solo si la razon de escalar es confianza baja
        # (out_of_scope, no_context o llm_failure no mejoran reintentando con el mismo contexto)
        # amplia la busqueda a 10 chunks (el doble del default) para darle al segundo intento la chance
        # de encontrar contexto relevante que no haya entrado en el top 5 original
        # regenerate() ya limita el resultado a auto_publish o escalate, nunca un segundo needs_review
        # solo se reintenta cuando el sistema iba a escalar por confianza baja, la franja de revision humana no se reintnta
        # queda como needs_review con una nota interna, para que una persona la apruebe, edite o regenere
        if generated_response.action_type == ACTION_ESCALATE and generated_response.escalation_reason == ESCALATION_REASON_LOW_CONFIDENCE:
            logger.info(f"[{event.issue_key}] confianza baja en el primer intento, ampliando busqueda y reintentando")
            retrieval_result = self.knowledge_retriever.retrieve(analysis, top_k=10)
            generated_response = self.response_generator.regenerate(
                analysis, retrieval_result, rejection_reason="la respuesta generada no esta suficientemente respaldada por el contexto"
            )
            logger.info(f"[{event.issue_key}] reintento completo, action_type={generated_response.action_type}")
            
        
        # completa la interaccion con el resultado final de m3/m4
        self.interaction_logger.update_interaction_result(
            interaction_id,
            chunks_retrieved_count=len(retrieval_result.chunks),
            generated_response=generated_response.response_text,
            confidence_score=generated_response.confidence_score,
            decision=generated_response.action_type,
        )

        # persiste el detalle de cada chunk recuperado, para poder auditar el contexto real usado despues
        self.interaction_logger.save_retrieved_chunks(interaction_id, retrieval_result.chunks)
        self.interaction_logger.record_processing_time(interaction_id, int((time.perf_counter() - started_at) * 1000))
        
        # m5 ejecuta la accion segun lo que decidio m4
        # auto_publish, needs_review y request_info publican un comentario, la diferencia es si es publico o nota interna
        # escalate por ahora solo logea, la asignacion depende de m7
        if generated_response.action_type in (ACTION_AUTO_PUBLISH, ACTION_NEEDS_REVIEW, ACTION_REQUEST_INFO) and generated_response.response_text:
            is_public = generated_response.action_type != ACTION_NEEDS_REVIEW
            try:
                await self.jsm_executor.post_comment(event.issue_key, generated_response.response_text, public=is_public)
                # primer comentario publico de la interaccion, si es la respuesta automatica tambien la resuelve
                if is_public:
                    self.interaction_logger.mark_first_response(interaction_id, resolved=generated_response.action_type == ACTION_AUTO_PUBLISH)
                logger.info(f"[{event.issue_key}] m5 publico el comentario,es public={is_public}")

                # si ya se le respondio al cliente (o se le pidio mas info), transiciona a un estado de espera
                if generated_response.action_type in (ACTION_AUTO_PUBLISH, ACTION_REQUEST_INFO):
                    transition_id, target_status_name = await self._resolve_transition_id(event.issue_key, analysis.project_id, JSM_STATUS_ACTION_AWAITING_CUSTOMER, analysis.issue_type_id)
                    if transition_id:
                        await self.jsm_executor.transition_issue(event.issue_key, transition_id)
                        self.interaction_logger.update_ticket_status(event.issue_key, target_status_name)
                        logger.info(f"[{event.issue_key}] transicionado a awaiting_customer en jsm")
                    else:
                        logger.warning(f"[{event.issue_key}] sin transicion configurada para awaiting_customer")

            except Exception as e:
                logger.error(f"[{event.issue_key}] fallo al publicar comentario o transicionar en jsm: {type(e).__name__}: {e}")
        elif generated_response.action_type in (ACTION_AUTO_PUBLISH, ACTION_NEEDS_REVIEW, ACTION_REQUEST_INFO):
            logger.warning(f"[{event.issue_key}] action_type={generated_response.action_type} sin response_text, no se publica ningun comentario")
        
        elif generated_response.action_type == ACTION_ESCALATE:
            transition_id, target_status_name = await self._resolve_transition_id(event.issue_key, analysis.project_id, JSM_STATUS_ACTION_ESCALATE, analysis.issue_type_id)
            if transition_id:
                try:
                    await self.jsm_executor.transition_issue(event.issue_key, transition_id)
                    self.interaction_logger.update_ticket_status(event.issue_key, target_status_name)
                    logger.info(f"[{event.issue_key}] transicionado en jsm")

                    acknowledgment = self.ticket_analyzer.llm_client.generate_escalation_acknowledgment(analysis.summary, None)
                    if acknowledgment:
                        await self.jsm_executor.post_comment(event.issue_key, acknowledgment, public=True)
                        self.interaction_logger.mark_first_response(interaction_id, resolved=False)

                    internal_note = self._build_internal_escalation_note(analysis, generated_response.escalation_reason)
                    await self.jsm_executor.post_comment(event.issue_key, internal_note, public=False)

                except Exception as e:
                    logger.error(f"[{event.issue_key}] fallo al transicionar o comentar en jsm: {type(e).__name__}: {e}")
            else:
                logger.warning(f"[{event.issue_key}] ticket va para escalamiento, sin transicion configurada o disponible")
                
        return {
            "status": "processed",
            "issue_key": event.issue_key,
            "analysis": analysis.model_dump(),
            "retrieved_chunks": [chunk.model_dump() for chunk in retrieval_result.chunks], #TEST
            "generated_response": generated_response.model_dump(),
        }
       # resuelve el transition_id real de jsm para una accion generica (escalate, resolve, etc)
    # busca el system_action(en jsm_status_actions)configurado para ese proyecto y lo matchea contra
    # las transiciones disponibles para ese ticket puntual en su estado actual
    # si no hay transicion directa, intenta un camino de respaldo (multi salto) y avisa por nota interna, sin ejecutarlo
    async def _resolve_transition_id(self, issue_key: str, project_id: str, system_action: str, issue_type_id: str | None = None) -> tuple[str | None, str | None]:
        target_status_name = self._get_target_status_name(project_id, system_action)

        if target_status_name is None:
            logger.warning(f"[{issue_key}] no hay mapeo configurado para la accion '{system_action}' en este proyecto")
            return None, None

        transitions_data = await self.jsm_executor.get_transitions(issue_key)
        transitions = transitions_data.get("transitions", [])

        for transition in transitions:
            if transition.get("to", {}).get("name") == target_status_name:
                return transition["id"], target_status_name

        logger.warning(f"[{issue_key}] no se encontro una transicion disponible hacia '{target_status_name}'")
        # con el interruptor del proyecto habilitado, prueba pasar por un estado intermedio antes de rendirse
        final_transition_id = await self._try_multi_step(issue_key, project_id, target_status_name, issue_type_id)
        if final_transition_id is not None:
            return final_transition_id, target_status_name

        await self._handle_missing_direct_transition(issue_key, project_id, target_status_name, issue_type_id)
        return None, target_status_name

       # cuando no hay transicion directa, busca si existe un camino multi salto como respaldo
    # no lo ejecuta automaticamente, solo avisa por nota interna, el riesgo de disparar automatizaciones
    # en estados intermedios sin que un humano lo apruebe
    async def _handle_missing_direct_transition(self, issue_key: str, project_id: str, target_status_name: str, issue_type_id: str | None = None) -> None:
        try:
            project_code = self._get_project_code(project_id)
            if project_code is None:
                return

            # si el evento no trajo el tipo de ticket, por ejemplo en un comentario, se lo pide a jsm para usar el workflow correcto
            if issue_type_id is None:
                issue_type_id = await self.jsm_executor.get_issue_type_id(issue_key)

            workflow_map = await self._get_cached_workflow_map(project_code, project_id, issue_type_id)
            current_status_name = await self.jsm_executor.get_issue_status(issue_key)
            path = workflow_map.find_path(current_status_name, target_status_name)

            if path is None:
                note = (
                    f"El sistema no encontro ningun camino, ni directo ni de varios pasos, "
                    f"para transicionar este ticket desde '{current_status_name}' hacia '{target_status_name}'. "
                    f"Revisar el workflow configurado en JSM para este proyecto."
                )
            else:
                note = (
                    f"El sistema encontro un camino de {len(path)} pasos desde '{current_status_name}' hacia "
                    f"'{target_status_name}', pero no lo ejecuto automaticamente. Cada paso intermedio es un "
                    f"evento real en JSM que podria disparar automatizaciones no deseadas. Revisar manualmente "
                    f"o ajustar el workflow para agregar una transicion directa."
                )

            await self.jsm_executor.post_comment(issue_key, note, public=False)

        except Exception as e:
            logger.error(f"[{issue_key}] fallo al calcular el camino de respaldo: {type(e).__name__}: {e}")
            
            
    # dice si el administrador habilito, en la configuracion del proyecto, pasar por un estado intermedio cuando jira no ofrece una transicion directa
    # un fallo de la consulta cuenta como apagado, que es lo que el sistema ya hacia
    def _multi_step_enabled(self, project_id: str | None) -> bool:
        if not project_id:
            return False

        db = next(get_db())
        try:
            row = db.execute(
                text("SELECT multi_step_transitions_enabled FROM project WHERE id = :project_id"),
                {"project_id": project_id},
            ).fetchone()
            return row is not None and row.multi_step_transitions_enabled is True
        except Exception as e:
            logger.error(f"no se pudo consultar si el proyecto admite un estado intermedio, se asume que no: {type(e).__name__}: {e}")
            return False
        finally:
            db.close()

    # elige, entre las transiciones que jira ofrece hoy para el ticket, un estado intermedio desde el que el workflow permita llegar al destino
    # descarta los estados de la categoria hecho y los que el sistema usa para resolver o escalar, y no sigue caminos con mas de un estado intermedio
    def _pick_intermediate(self, transitions: list, workflow_map: ProjectWorkflowMap, target_status_name: str, avoid_names: set) -> tuple[str, str] | None:
        for transition in transitions:
            destination = transition.get("to", {})
            name = destination.get("name")
            category = (destination.get("statusCategory") or {}).get("key")

            if not name or name == target_status_name or name in avoid_names or category == "done":
                continue

            if workflow_map.can_transition(name, target_status_name):
                return transition["id"], name

        return None

    # vuelve a descubrir el workflow real del proyecto en jira y lo guarda, para cuando el mapa guardado quedo viejo
    async def _refresh_workflow_map(self, project_code: str, project_id: str, issue_type_id: str | None = None) -> ProjectWorkflowMap:
        resultados = await self.workflow_discovery_service.discover_all_workflows(project_code)
        for r in resultados:
            self.project_workflow_repository.upsert(project_id, r["issue_type_id"], r["workflow_name"], r["workflow_data"])

        workflow_data = self.project_workflow_repository.get_workflow_data(project_id, issue_type_id=issue_type_id)
        return ProjectWorkflowMap(workflow_data["workflow"], workflow_data["status_names"])

    # deja una nota interna sin romper el flujo si falla, es solo informativa
    async def _post_internal_note(self, issue_key: str, note: str) -> None:
        try:
            await self.jsm_executor.post_comment(issue_key, note, public=False)
        except Exception as e:
            logger.error(f"[{issue_key}] no se pudo dejar la nota interna: {type(e).__name__}: {e}")

    # recorre un estado intermedio cuando jira no ofrece una transicion directa, solo si el proyecto lo habilito
    # ejecuta el primer paso y devuelve el id de la transicion que lleva al destino, para que quien llama la ejecute como siempre
    # devuelve none si esta apagado, si no hay un camino seguro o si algo falla, y en ese caso queda la nota interna de siempre
    async def _try_multi_step(self, issue_key: str, project_id: str, target_status_name: str, issue_type_id: str | None = None) -> str | None:
        if not self._multi_step_enabled(project_id):
            return None

        try:
            project_code = self._get_project_code(project_id)
            if project_code is None:
                return None

            current_status_name = await self.jsm_executor.get_issue_status(issue_key)
            resolved_type = issue_type_id or await self.jsm_executor.get_issue_type_id(issue_key)
            avoid_names = {
                name
                for name in (
                    self._get_target_status_name(project_id, JSM_STATUS_ACTION_RESOLVED),
                    self._get_target_status_name(project_id, JSM_STATUS_ACTION_ESCALATE),
                )
                if name
            }
            transitions = (await self.jsm_executor.get_transitions(issue_key)).get("transitions", [])

            workflow_map = await self._get_cached_workflow_map(project_code, project_id, resolved_type)
            choice = self._pick_intermediate(transitions, workflow_map, target_status_name, avoid_names)

            if choice is None:
                # el mapa guardado puede estar viejo, se vuelve a descubrir el workflow una sola vez y se prueba de nuevo
                workflow_map = await self._refresh_workflow_map(project_code, project_id, resolved_type)
                choice = self._pick_intermediate(transitions, workflow_map, target_status_name, avoid_names)

            if choice is None:
                logger.warning(f"[{issue_key}] no hay un estado intermedio seguro entre '{current_status_name}' y '{target_status_name}'")
                return None

            first_transition_id, intermediate_name = choice

            if not await self.jsm_executor.transition_issue(issue_key, first_transition_id):
                logger.error(f"[{issue_key}] jsm rechazo el paso a '{intermediate_name}'")
                return None

            self.interaction_logger.update_ticket_status(issue_key, intermediate_name)
            logger.info(f"[{issue_key}] paso por '{intermediate_name}' para llegar a '{target_status_name}'")

            next_transitions = (await self.jsm_executor.get_transitions(issue_key)).get("transitions", [])
            final_transition_id = next((t["id"] for t in next_transitions if t.get("to", {}).get("name") == target_status_name), None)

            if final_transition_id is None:
                await self._post_internal_note(issue_key, (
                    f"El sistema movio el ticket a '{intermediate_name}' pero desde ahi Jira no ofrece una transicion hacia '{target_status_name}', "
                    f"el ticket quedo en '{intermediate_name}'. Revisar el workflow configurado en JSM para este proyecto."
                ))
                return None

            await self._post_internal_note(issue_key, (
                f"El sistema paso por '{intermediate_name}' para llegar a '{target_status_name}', porque desde '{current_status_name}' "
                f"Jira no ofrece una transicion directa. Camino habilitado en la configuracion del proyecto."
            ))
            return final_transition_id

        except Exception as e:
            logger.error(f"[{issue_key}] fallo el camino con estado intermedio: {type(e).__name__}: {e}")
            return None

    # trae el code real del proyecto (ej TARG) a partir de su uuid interno
    def _get_project_code(self, project_id: str) -> str | None:
        db = next(get_db())
        try:
            row = db.execute(text("SELECT code FROM project WHERE id = :project_id"), {"project_id": project_id}).fetchone()
            return row.code if row else None
        finally:
            db.close()

    # trae el mapa de workflow de un proyecto desde la base, descubriendolo y persistiendolo
    # la primera vez que se necesite. usa el issue_type_id real si se paso, sino cae al fallback
    async def _get_cached_workflow_map(self, project_code: str, project_id: str, issue_type_id: str | None = None) -> ProjectWorkflowMap:
        workflow_data = self.project_workflow_repository.get_workflow_data(project_id, issue_type_id=issue_type_id)

        if workflow_data is None:
            resultados = await self.workflow_discovery_service.discover_all_workflows(project_code)
            for r in resultados:
                self.project_workflow_repository.upsert(project_id, r["issue_type_id"], r["workflow_name"], r["workflow_data"])

            workflow_data = self.project_workflow_repository.get_workflow_data(project_id, issue_type_id=issue_type_id)

        return ProjectWorkflowMap(workflow_data["workflow"], workflow_data["status_names"])
    
    # busca en project_config el nombre del estado configurado para una accion, en un proyecto puntual
    def _get_target_status_name(self, project_id: str, system_action: str) -> str | None:
        db = next(get_db())
        try:
            row = db.execute(text("""
                SELECT ts.name
                FROM project_config pc
                JOIN ticket_status ts ON pc.status_id = ts.id
                WHERE pc.project_id = :project_id AND pc.system_action = :system_action AND pc.is_active = TRUE
            """), {"project_id": project_id, "system_action": system_action}).fetchone()

            return row.name if row else None
        finally:
            db.close()
            

    # busca en project_config el nombre del estado configurado para una accion, en un proyecto puntual
    def _get_target_status_name(self, project_id: str, system_action: str) -> str | None:
        db = next(get_db())
        try:
            row = db.execute(text("""
                SELECT ts.name
                FROM project_config pc
                JOIN ticket_status ts ON pc.status_id = ts.id
                WHERE pc.project_id = :project_id AND pc.system_action = :system_action AND pc.is_active = TRUE
            """), {"project_id": project_id, "system_action": system_action}).fetchone()

            return row.name if row else None
        finally:
            db.close()
    
    # motivo real del escalamiento directo, el alcance que marco el clasificador o el nivel 2, antes la nota siempre decia lo mismo
    def _direct_escalation_reason(self, analysis: TicketAnalysis) -> str:
        if analysis.scope == "OUT_OF_SCOPE":
            return "out_of_scope"
        if analysis.resolved_by == "L2":
            return "resolved_by_l2"
        return "no_especificado"

    # arma el texto de la nota interna para el agente, resumen de lo que detecto el sistema antes de escalar
    def _build_internal_escalation_note(self, analysis: TicketAnalysis, escalation_reason: str | None) -> str:
        return (
            f"Resumen automatico del analisis:\n"
            f"Categoria: {analysis.category or 'sin clasificar'}\n"
            f"Prioridad: {analysis.priority or 'sin clasificar'}\n"
            f"Intent: {analysis.intent or 'sin clasificar'}\n"
            f"Sentimiento: {analysis.sentiment or 'sin clasificar'}\n"
            f"Motivo de escalamiento: {escalation_reason or 'no especificado'}"
        )