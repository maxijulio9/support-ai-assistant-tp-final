# Configuración del worker ARQ para el pipeline de procesamiento de eventos

from arq.connections import RedisSettings
from app.core.config import settings
from app.modules.event_pipeline.worker import process_issue_created, process_comment_created, process_kb_indexing, process_page_reindex

# nombre de la cola dedicada a las tareas de kb, usado tambien al encolar desde m1 y m7
KB_QUEUE_NAME = "kb_queue"
class WorkerSettings:
    # funciones que este worker sabe ejecutar
    functions = [process_issue_created, process_comment_created]
    # configuración de conexión a rexdis
    # RedisSettings.from_dsn("redis://redis:6379")
    redis_settings = RedisSettings.from_dsn(settings.redis_url)

    # cuántas tareas puede ejecutar en paralelo
    max_jobs = 5

    #reintentos ante fallos
    max_tries = 3
    
class KbWorkerSettings:
    # worker dedicado a kb, escucha una cola separada para no competir con los tickets
    functions = [process_kb_indexing, process_page_reindex]
    queue_name = KB_QUEUE_NAME

    redis_settings = RedisSettings.from_dsn(settings.redis_url)

    max_jobs = 5
    max_tries = 3