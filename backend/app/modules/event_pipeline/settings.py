# Configuración del worker ARQ para el pipeline de procesamiento de eventos

import asyncio
import faulthandler

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


# si el ciclo de eventos del worker queda bloqueado mas de este tiempo el proceso termina y docker lo reinicia
# una consulta o una llamada que no vuelve congela todo el worker sin dejar ningun error, asi se hace visible y se recupera solo
WATCHDOG_SECONDS = 180
HEARTBEAT_SECONDS = 15


# renueva el temporiazdor cada pocos segundos mientras el ciclo de eventos esta libre
async def _heartbeat():
    while True:
        faulthandler.cancel_dump_traceback_later()
        faulthandler.dump_traceback_later(WATCHDOG_SECONDS, exit=True)
        await asyncio.sleep(HEARTBEAT_SECONDS)


async def start_watchdog(ctx):
    ctx["heartbeat_task"] = asyncio.create_task(_heartbeat())


async def stop_watchdog(ctx):
    task = ctx.get("heartbeat_task")
    if task is not None:
        task.cancel()
    faulthandler.cancel_dump_traceback_later()


class WorkerSettings:
    # funciones que este worker sabe ejecutar
    functions = [process_issue_created, process_comment_created, process_agent_resolution]

    # si el ciclo principal queda bloqueado mas de unos minutos el proceso termina y docker lo reinicia
    on_startup = start_watchdog
    on_shutdown = stop_watchdog

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