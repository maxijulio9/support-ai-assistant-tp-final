# M7:
# dispara la indexacion de spaces de confluence en background via el worker de arq
# CU30

import logging
from app.core.arq_pool import get_arq_pool

logger = logging.getLogger(__name__)


class IndexingTriggerService:

    # encola la tarea de indexacion, no espera a que termine, corre en el worker
    async def start_indexing(self, space_keys: list[str]):
        pool = await get_arq_pool()
        await pool.enqueue_job("process_kb_indexing", space_keys)
        logger.info(f"indexacion encolada para spaces {space_keys}")