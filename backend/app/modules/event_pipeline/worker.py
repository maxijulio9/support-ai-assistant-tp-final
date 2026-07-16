# tareas que ejecuta el worker de arq
# cada funcion recibe arq_context, el contexto interno de arq, mas los datos que le paso desde m1

import logging
from app.modules.webhook_receiver.schemas import NormalizedEvent
from app.modules.event_pipeline.orchestrator import Orchestrator
from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)

orchestrator = Orchestrator()

# tarea para tickets nuevos el event_data ya viene completo desde m1
async def process_issue_created(arq_context, event_data: dict):
    logger.info(f"worker: procesando issue_created")

    event = NormalizedEvent( 
        issue_key=event_data["issue_key"],
        event_type=event_data["event_type"],
        summary=event_data.get("summary"),
        description=event_data.get("description"),
        issue_type=event_data.get("issue_type"),
        priority=event_data.get("priority"),
        status=event_data.get("status"),
        reporter_id=event_data.get("reporter_id"),
        reporter_email=event_data.get("reporter_email"),
        request_type=event_data.get("request_type"),
        created_at=event_data.get("created_at"),
        comment_body=event_data.get("comment_body"),
        comment_author_id=event_data.get("comment_author_id"),
    )

    result = await orchestrator.process_event(event)

    logger.info(f"issue_created procesado, issue_key={event.issue_key}")
    return result


# tarea para comentarios, acá solo llega el issue_key
# hay que leer el hash de debouncing para obtener el texto acumulado
async def process_comment_created(arq_context, issue_key: str):
    logger.info(f" procesando comment_created para {issue_key}")

    redis = get_redis()
    debounce_key = f"debounce:{issue_key}"
    comment_body = await redis.hget(debounce_key, "body")

    if not comment_body:
        logger.warning(f"no se encontro hash de debouncing para {issue_key} se descarta")
        return {"status": "discarded", "issue_key": issue_key}

    # arma un evento  con el texto acumulado
    event = NormalizedEvent(
        issue_key=issue_key,
        event_type="jira:issue_updated",
        comment_body=comment_body,
    )

    result = await orchestrator.process_event(event)

    logger.info(f"worker: comment_created procesado, issue_key={issue_key}")
    return result