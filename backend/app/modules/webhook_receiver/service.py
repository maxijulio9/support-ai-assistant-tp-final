"""
Modulo 1: Webhook Receiver
Contiene la clase WebhookReceiver, responsable de la validación, normalización y despacho de eventos recibidos desde JSM vía webhook
"""
import time
from app.modules.webhook_receiver.schemas import JsmWebhookPayload, NormalizedEvent
from app.core.redis_client import get_redis
from app.core.config import settings
from app.core.arq_pool import get_arq_pool


class WebhookReceiver:

    # convierte el payload que viene desde JSM a un evento normalizado para uso interno
    # retorna None si el evento no es procesable
    def normalize_payload(self, payload: JsmWebhookPayload) -> NormalizedEvent | None:
       
        if not payload.issue:
            return None

        issue = payload.issue
        fields = issue.fields

        if not fields:
            return None

        description_text = self._extract_plain_text(fields.description) if fields.description else None

        request_type = None
        if fields.customfield_10010 and fields.customfield_10010.requestType:
            request_type = fields.customfield_10010.requestType.name

        comment_body = None
        comment_author_id = None
        if payload.webhookEvent == "jira:issue_updated" and fields.comment:
            comments = fields.comment.get("comments", [])
            if comments:
                last_comment = comments[-1]
                comment_body = last_comment.get("body", "")
                author = last_comment.get("author", {})
                comment_author_id = author.get("accountId")

        return NormalizedEvent(
            issue_key=issue.key,
            event_type=payload.webhookEvent,
            summary=fields.summary,
            description=description_text,
            issue_type=fields.issuetype.name if fields.issuetype else None,
            priority=fields.priority.name if fields.priority else None,
            status=fields.status.name if fields.status else None,
            reporter_id=fields.reporter.accountId if fields.reporter else None,
            reporter_email=fields.reporter.emailAddress if fields.reporter else None,
            request_type=request_type,
            created_at=fields.created,
            comment_body=comment_body,
            comment_author_id=comment_author_id,
        )

    #determina la ruta del evento y lo despacha al módulo que corresponda
    # encola en arq para que el worker lo procese
    async def dispatch_event(self, event: NormalizedEvent) -> dict:

        redis = get_redis()
        pool = await get_arq_pool()

        if event.event_type == "jira:issue_created":
            # nuevo ticket: encola el evento completo como un job de arq
            print(f"M1 issue_created recibido {event.issue_key}")
            await pool.enqueue_job("process_issue_created", event.model_dump())
            return {"status": "dispatched", "route": "ticket_analyzer", "issue_key": event.issue_key}

        if event.event_type == "jira:issue_updated":
            # comentario: acumula en hash de debouncing y agenda el job 
            print(f"M1 comment_created recibido {event.issue_key}")

            # acumula el comentario en el hash de debouncing y si ya hay texto previo lo concatena con un salto de linea
            debounce_key = f"debounce:{event.issue_key}"
            existing = await redis.hget(debounce_key, "body")
            nuevo_body = event.comment_body or ""
            if existing:
                nuevo_body = f"{existing}\n{nuevo_body}"

            # guarda el body actualizado y resetea el ttl
            #
            await redis.hset(debounce_key, "body", nuevo_body)
            # await redis.expire(debounce_key, settings.debounce_ttl_seconds)
            await redis.expire(debounce_key, settings.debounce_ttl_seconds + 5)


            # agenda el job con defer_by para esperar mas comentariossss
            # el job_id fijo evita que se creen jobs duplicados para el mismo ticket
            #
            await pool.enqueue_job(
                "process_comment_created",
                event.issue_key,
                # _job_id=f"comment:{event.issue_key}",
                _job_id=f"comment:{event.issue_key}:{int(time.time() // 60)}",
                _defer_by=settings.debounce_ttl_seconds,
            )

            return {"status": "dispatched", "route": "conversation_handler", "issue_key": event.issue_key}

        # si en caso de revivir un evento ya conocido ignorar, no debería pasar
        return {"status": "ignored", "event_type": event.event_type}

    #code viejo: determina la ruta del evento y lo despacha al módulo correspondiente
   # determina la ruta del evento y lo despacha al módulo correspondiente
    # encola en redis para que el worker lo procese
    # async def dispatch_event(self, event: NormalizedEvent) -> dict:

    #     redis = get_redis()

    #     if event.event_type == "jira:issue_created":
    #     # nuevo ticket: flujo principal>> al M2 Ticket Analyzer
    #         print(f"M1 issue_created recibido: {event.issue_key}")
    #         # encola el evento serializado como json para que el worker lo desencole
    #         await redis.rpush("queue:issue_created", event.model_dump_json())
    #         return {"status": "dispatched", "route": "ticket_analyzer", "issue_key": event.issue_key}

    #     if event.event_type == "jira:issue_updated":
    #         # si es comentario de usuario >> flujo de conversación con debouncing
    #         print(f"M1 comment_created recibido: {event.issue_key}")

    #         # acumula el comentario en el hash de debouncing
    #         # si ya hay texto previo, lo concatena con un salto de linea
    #         debounce_key = f"debounce:{event.issue_key}"
    #         existing = await redis.hget(debounce_key, "body")
    #         nuevo_body = event.comment_body or ""
    #         if existing:
    #             nuevo_body = f"{existing}\n{nuevo_body}"

    #         # guarda el body actualizado y resetea el ttl a 30s
    #         await redis.hset(debounce_key, "body", nuevo_body)
    #         await redis.expire(debounce_key, settings.debounce_ttl_seconds)

    #         # encola el issue_key para que el worker lo procese cuando venza el ttl
    #         # el worker leera el hash y ejecutara el pipeline con el texto acumulado
    #         await redis.rpush("queue:comment_created", event.issue_key)

    #         return {"status": "dispatched", "route": "conversation_handler", "issue_key": event.issue_key}

    #     # si en caso de revibir un evento no reconocido  ignorar simplemente, no debería pasar
    #     return {"status": "ignored", "event_type": event.event_type}

    #ewxtrae texto plano desde el formato ADF Atlassian Document Format
    def _extract_plain_text(self, adf_node: dict) -> str:
        if not adf_node:
            return ""

        texts = []

        #funcion recursiva para recorrer el arbol ADF,si hay, y extraer los textos de los nodos de tipo text
        def _recorrer_nodo(node: dict):
            if not isinstance(node, dict):
                return
            if node.get("type") == "text":
                texts.append(node.get("text", ""))
            for child in node.get("content", []):
                _recorrer_nodo(child)

        _recorrer_nodo(adf_node)
        texto_completo = " ".join(texts)

        return texto_completo.strip()
