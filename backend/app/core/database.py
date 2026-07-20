# conexion a la base de datos relacional postgresql
# todos los modulos que necesiten leer o escribir en la bd usan este archivo

import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

logger = logging.getLogger(__name__)

# crea la conexion a la base de datos usando la url del .env
# TODO: cuando exista M7, la url se va a leer desde sqlite en vez del .env
engine = create_engine(settings.database_url, pool_pre_ping=True)

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