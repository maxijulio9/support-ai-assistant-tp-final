# Configuración del worker ARQ para el pipeline de procesamiento de eventos

from arq import cron
from arq.connections import RedisSettings
from app.core.config import settings
from app.modules.event_pipeline.worker import process_issue_created, process_comment_created, process_kb_indexing, process_page_reindex, process_agent_resolution, resync_all_project_workflows

# nombre de la cola dedicada a las tareas de kb, usado tambien al encolar desde m1 y m7
KB_QUEUE_NAME = "kb_queue"

# conexion a redis de los workers, con mas margen que el valor por defecto de arq, que espera 1 segundo y reintenta 5 veces
# con el worker ocupado una conexion nueva puede tardar mas que eso y el ciclo principal termina con un erorr
def build_redis_settings() -> RedisSettings:
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    redis_settings.conn_timeout = 10
    redis_settings.conn_retries = 30
    redis_settings.conn_retry_delay = 2
    return redis_settings


class WorkerSettings:
    # funciones que este worker sabe ejecutar
    functions = [process_issue_created, process_comment_created, process_agent_resolution]

    # tareas periodicas, resincroniza el workflow de todos los proyectos una vez por dia a las 3 am
    cron_jobs = [cron(resync_all_project_workflows, hour=3, minute=0)]

    # configuración de conexión a rexdis
    # RedisSettings.from_dsn("redis://redis:6379")
    redis_settings = build_redis_settings()

    # cuántas tareas puede ejecutar en paralelo
    max_jobs = 5

    #reintentos ante fallosa
    max_tries = 3
    
class KbWorkerSettings:
    # worker dedicado a kb, escucha una cola separada para no competir con los tickets
    functions = [process_kb_indexing, process_page_reindex]
    queue_name = KB_QUEUE_NAME

    redis_settings = build_redis_settings()

    max_jobs = 5
    max_tries = 3

    # una indexacion de un space grande puede tardar mas de los 5 minutos que arq da por defecto a cada trabajo
    job_timeout = 3600