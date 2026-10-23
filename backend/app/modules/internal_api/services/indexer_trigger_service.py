# M7:
# dispara la indexacion de spaces de confluence en background via el worker de arq
# CU30

import logging
from fastapi.concurrency import run_in_threadpool
from app.core.arq_pool import get_arq_pool

logger = logging.getLogger(__name__)


class IndexingTriggerService:

    # crea la fila de la corrida en estado queued y encola la tarea con su id, no espera a que termine, corre en el worker
    # asi el dashboard puede consultar la corrida apenas se hace el pedido, sin esperar a que el worker la tome
    # devuelve el id y el started_at de la corrida
    async def start_indexing(self, space_keys: list[str]) -> dict:
        from app.modules.event_pipeline.settings import KB_QUEUE_NAME
        from app.modules.event_pipeline.indexing_status_repository import IndexingStatusRepository

        status_repo = IndexingStatusRepository()
        run = await run_in_threadpool(status_repo.create_queued_job, space_keys)

        try:
            pool = await get_arq_pool()
            await pool.enqueue_job("process_kb_indexing", space_keys, run["id"], _queue_name=KB_QUEUE_NAME)
        except Exception as e:
            # si no se pudo encolar, la fila no puede quedar en queued para simpre
            logger.error(f"no se pudo encolar la indexacion de spaces {space_keys}: {e}")
            try:
                await run_in_threadpool(status_repo.mark_failed, run["id"], f"No se pudo encolar la indexacion: {e}")
            except Exception as mark_error:
                logger.error(f"no se pudo marcar como fallida la corrida {run['id']}: {mark_error}")
            raise

        logger.info(f"indexacion encolada para spaces {space_keys}, corrida {run['id']}")
        return run
