# consulta la tabla kb_spaces para obtener metadata de un space
# se usa durante la indexacion para obtener el country_id de cada pagina

import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


class KbSpaceRepository:

    # busca el country_code asociado a un space_key en la tabla kb_spaces
    # devuelve None si el space no esta registrado o no tiene pais 
    def get_country_code(self, db, space_key: str) -> str | None:
        query = text("""
            SELECT c.code 
            FROM kb_spaces ks
            LEFT JOIN country c ON c.id = ks.country_id
            WHERE ks.space_key = :space_key AND ks.is_active = true
        """)


        row = db.execute(query, {"space_key": space_key}).fetchone()

        if not row:
            logger.warning(f"space '{space_key}' no encontrado en kb_space")
            return None

        if not row.code:
            logger.info(f"space '{space_key}' no tiene pais. se indexa como global")
            return None

        return str(row.code)