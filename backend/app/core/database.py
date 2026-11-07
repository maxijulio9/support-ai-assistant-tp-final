# conexion a la base de datos relacional postgresql
# todos los modulos que necesiten leer o escribir en la bd usan este archivo

import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

logger = logging.getLogger(__name__)

# crea la conexion a la base de datos usando la url del .env
# TODO: cuando exista M7, la url se va a leer desde sqlite en vez del .env
# el dashboard dispara varios pedidos a la vez y cada uno usa dos sesiones, con pocas conexiones en el pool
# se abrian conexiones nuevas en cada pantalla y cada una tarda mas de un segundo en abrirse
# la conexion corta sola si el otor extremo deja de responder, sin esto una consulta puede quedar esperando para siempre
# son opciones del lado del cliente, el pooler no las ve
DB_CONNECT_ARGS = {
    "connect_timeout": 10,
    "keepalives": 1,
    "keepalives_idle": 30,
    "keepalives_interval": 10,
    "keepalives_count": 3,
    "tcp_user_timeout": 30000,
}
# el tamano del pool sale de variables de entorno, cada proceso de la api y de los workers abre su propio pool
engine = create_engine(settings.database_url, pool_pre_ping=True, pool_size=settings.db_pool_size, max_overflow=settings.db_max_overflow, connect_args=DB_CONNECT_ARGS)

# fabrica de sesiones, cada sesion es como abrir una conversacion con la bd
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    # abre una sesion nueva, la entrega, y la cierra cuando se termina de usar
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_connection() -> bool:
    # hace una consulta simple para verificar que la bd responde
    try:
        conexion = engine.connect()
        conexion.execute(text("SELECT 1"))
        conexion.close()
        return True
    except Exception as e:
        logger.error(f"no se pudo conectar a la bd: {e}")
        return False