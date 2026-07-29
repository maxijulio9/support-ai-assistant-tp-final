# Configuración del worker ARQ para el pipeline de procesamiento de eventos

from arq.connections import RedisSettings
from app.core.config import settings
from app.modules.event_pipeline.worker import process_issue_created, process_comment_created, process_kb_indexing   


class WorkerSettings:
    # funciones que este worker sabe ejecutar
    functions = [process_issue_created, process_comment_created, process_kb_indexing]

    # configuración de conexión a rexdis
    # RedisSettings.from_dsn("redis://redis:6379")
    redis_settings = RedisSettings.from_dsn(settings.redis_url)

    # cuántas tareas puede ejecutar en paralelo
    max_jobs = 5

    #reintentos ante fallos
    max_tries = 3