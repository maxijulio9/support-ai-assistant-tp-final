#M2: TicketAnalyze, tiene la lógica principal de análisis y clasificación de solicitudes.


import logging
from app.modules.webhook_receiver.schemas import NormalizedEvent
from app.modules.ticket_analyzer.schemas import TicketAnalysis
from app.modules.ticket_analyzer.conversation_history import ConversationHistory


logger = logging.getLogger(__name__)

# esquema de prioridades de tokenia  hardcodeado temporalmente
# TODO: leer de project_config cuando la feature para obtener esa info desde confluecne 
PRIORITY_SCHEMA = {
    ("seguridad_cuenta", "reporte_problema"):     "Highest",
    ("seguridad_cuenta", "reclamo"):              "Highest",
    ("seguridad_cuenta", "solicitud_accion"):     "Highest",
    ("seguridad_cuenta", "consulta_informativa"): "Highest",
    ("seguridad_cuenta", "cancelacion"):          "Highest",

    ("acceso_autenticacion", "reporte_problema"):     "High",
    ("acceso_autenticacion", "reclamo"):              "High",
    ("acceso_autenticacion", "solicitud_accion"):     "High",
    ("acceso_autenticacion", "consulta_informativa"): "Medium",
    ("acceso_autenticacion", "cancelacion"):          "Low",

    ("depositos_retiros", "reporte_problema"):     "High",
    ("depositos_retiros", "reclamo"):              "High",
    ("depositos_retiros", "solicitud_accion"):     "Medium",
    ("depositos_retiros", "consulta_informativa"): "Low",
    ("depositos_retiros", "cancelacion"):          "Medium",

    ("operaciones_crypto", "reporte_problema"):     "High",
    ("operaciones_crypto", "reclamo"):              "High",
    ("operaciones_crypto", "solicitud_accion"):     "Medium",
    ("operaciones_crypto", "consulta_informativa"): "Low",
    ("operaciones_crypto", "cancelacion"):          "Low",

    ("operaciones_fiat", "reporte_problema"):     "High",
    ("operaciones_fiat", "reclamo"):              "High",
    ("operaciones_fiat", "solicitud_accion"):     "Medium",
    ("operaciones_fiat", "consulta_informativa"): "Low",
    ("operaciones_fiat", "cancelacion"):          "Low",

    ("verificacion_identidad", "reporte_problema"):     "Medium",
    ("verificacion_identidad", "reclamo"):              "Medium",
    ("verificacion_identidad", "solicitud_accion"):     "Medium",
    ("verificacion_identidad", "consulta_informativa"): "Low",
    ("verificacion_identidad", "cancelacion"):          "Low",

    ("billetera_direcciones", "reporte_problema"):     "Medium",
    ("billetera_direcciones", "reclamo"):              "Medium",
    ("billetera_direcciones", "solicitud_accion"):     "Medium",
    ("billetera_direcciones", "consulta_informativa"): "Low",
    ("billetera_direcciones", "cancelacion"):          "Low",

    ("limites_restricciones", "reporte_problema"):     "Medium",
    ("limites_restricciones", "reclamo"):              "Medium",
    ("limites_restricciones", "solicitud_accion"):     "Low",
    ("limites_restricciones", "consulta_informativa"): "Low",
    ("limites_restricciones", "cancelacion"):          "Low",

    ("problemas_tecnicos", "reporte_problema"):     "Medium",
    ("problemas_tecnicos", "reclamo"):              "Medium",
    ("problemas_tecnicos", "solicitud_accion"):     "Low",
    ("problemas_tecnicos", "consulta_informativa"): "Low",
    ("problemas_tecnicos", "cancelacion"):          "Low",

    ("tarifas_comisiones", "reporte_problema"):     "Low",
    ("tarifas_comisiones", "reclamo"):              "Low",
    ("tarifas_comisiones", "solicitud_accion"):     "Low",
    ("tarifas_comisiones", "consulta_informativa"): "Low",
    ("tarifas_comisiones", "cancelacion"):          "Low",

    ("informacion_general", "reporte_problema"):     "Low",
    ("informacion_general", "reclamo"):              "Low",
    ("informacion_general", "solicitud_accion"):     "Low",
    ("informacion_general", "consulta_informativa"): "Low",
    ("informacion_general", "cancelacion"):          "Low",
}

# mapeo project_key y country para tokenia hardcre por ahora
PROJECT_COUNTRY = {
    "TGA": "AR",  #tokenia Argentina
    "TGB": "BR",  #tokenia Brasil
}


class TicketAnalyzer:

    def __init__(self):
        self.history = ConversationHistory()

    async def analyze(self, event: NormalizedEvent) -> TicketAnalysis:
        # punto de entrada, por ahora arma el objeto base con lo que llega de M1
        # priority = self._determine_priority(event.priority)
        country = self._get_country(event.issue_key)
        
        # lee el historial previo de la conversacion en caso de que existan
        conversation_history = await self.history.get(event.issue_key)
        
        # cu9 agrega el turno nuevo del usuario al historial
        # si es comentario usa comment_body, si es ticket nuevo usa summary + description
        texto_usuario = f"{event.summary or ''} {event.description or ''}".strip()
        if event.comment_body:
            texto_usuario = event.comment_body
        if texto_usuario:
            await self.history.append(event.issue_key, "user", texto_usuario)


        priority = self._determine_priority(
            category=None,
            intent=None,
            user_priority=event.priority,
            issue_key=event.issue_key
        )
        return TicketAnalysis(
            issue_key=event.issue_key,
            event_type=event.event_type,
            summary=event.summary,
            country=country,
            priority=priority,
        )

    #pendiente de implementar la logica de clasificacion, por ahora devuelve un diccionario sin nada
    def _classify(self, text: str) -> dict:

        return {}

    # si no hay clasificacion todavia, usa la prioridad del usuario, cu8
    def _determine_priority(self, category: str, intent: str, user_priority: str, issue_key: str) -> str:
        if not category or not intent:
            return user_priority or "Medium"

        calculated = self._calculate_priority(category, intent)

        if calculated == user_priority:
            logger.info(f"[{issue_key}] prioridad ok con la del usuario: {calculated}")
            return calculated

        logger.info(f"[{issue_key}] prioridad calculada '{calculated}' diferente a la elegida por usuario '{user_priority}'")
        # aca invocaría a m5 para aplicar la prioridad en jsm


        return calculated

     # deriva el country desde la nomenclatura del issue_key
    def _get_country(self, issue_key: str) -> str:
        project_key = issue_key.split("-")[0] if "-" in issue_key else ""
        country = PROJECT_COUNTRY.get(project_key)
        if not country:
            logger.warning(f"project_key '{project_key}' no mapeado en PROJECT_COUNTRY")
            return "unknown"
        return country

    # busca la prioridad en el esquema del negocio segun category, intent
    def _calculate_priority(self, category: str, intent: str) -> str:
        priority = PRIORITY_SCHEMA.get((category, intent))
        if not priority:
            logger.warning(f"combinacion ({category}, {intent}) no encontrada en PRIORITY_SCHEMA usando Medium")
            return "Medium"
        return priority
