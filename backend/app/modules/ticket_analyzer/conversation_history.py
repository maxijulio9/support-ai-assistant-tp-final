# gestiona el historial conversacional de cada ticket en redis
# cada ticket tiene una lista en redis con los turnos de la conversacion
# se usa para dar contexto al llm cuando clasifica comentarios nuevos

import json
import logging
from app.core.redis_client import get_redis
from app.core.config import settings
from app.modules.ticket_analyzer.schemas import ConversationTurn

logger = logging.getLogger(__name__)


class ConversationHistory:

    # lee el historial completo de un ticket desde redis ydevuelve lista vacia si no existe o si redis falla
    async def get(self, issue_key: str) -> list[ConversationTurn]:
        try:
            redis = get_redis()
            history_key = f"history:{issue_key}"
            items = await redis.lrange(history_key, 0, -1)

            turnos = []
            for item in items:
                data = json.loads(item)
                turnos.append(ConversationTurn(role=data["role"], content=data["content"]))

            return turnos

        except Exception as e:
            logger.warning(f"no se pudo leer historial de {issue_key}: {e}")
            return []

    # agrega un turno nuevo al historial y actuliza el ttl
    async def append(self, issue_key: str, role: str, content: str):
        try:
            redis = get_redis()
            history_key = f"history:{issue_key}"

            turno = json.dumps({"role": role, "content": content})
            await redis.rpush(history_key, turno)
            await redis.expire(history_key, settings.history_ttl_seconds)

            logger.info(f"turno agregado al historial de {issue_key} role: {role}")

        except Exception as e:
            logger.warning(f"no se pudo escribir en historial de {issue_key}: {e}")