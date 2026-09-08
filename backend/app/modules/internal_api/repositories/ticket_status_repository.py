# M7 InternalAPI:
# persiste los estados reales de jsm en ticket_status TF-145
# ticket_status es un catalogo global, no por proyecto, project_config ya resuelve el vinculo por proyecto

import logging
import re
import unicodedata
from sqlalchemy import text
from app.core.database import get_db

logger = logging.getLogger(__name__)


class TicketStatusRepository:

    # crea en el catalogo los estados que todavia no existan, buscando por name exacto
    def configure_statuses(self, statuses: list[dict]) -> int:
        db = next(get_db())

        try:
            creados = 0
            for status in statuses:
                self._upsert_status(db, status["name"])
                creados += 1

            db.commit()
            logger.info(f"{creados} estados procesados en ticket_status")
            return creados

        except Exception as e:
            db.rollback()
            logger.error(f"error al configurar ticket_status: {e}")
            raise

        finally:
            db.close()

    # crea el estado si no existe (buscando por name exacto), no hace nada si ya estaba
    def _upsert_status(self, db, name: str):
        existing = db.execute(text("SELECT id FROM ticket_status WHERE name = :name"), {"name": name}).fetchone()
        if existing:
            return existing.id

        code = self._slugify(name)
        row = db.execute(
            text("INSERT INTO ticket_status (code, name) VALUES (:code, :name) RETURNING id"),
            {"code": code, "name": name},
        ).fetchone()
        return row.id

    # convierte un nombre real en un identificador tecnico simple
    def _slugify(self, name: str) -> str:
        sin_tildes = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
        return re.sub(r"[^a-z0-9]+", "_", sin_tildes.lower()).strip("_")