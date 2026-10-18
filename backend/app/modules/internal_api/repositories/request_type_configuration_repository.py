# M7 InternalAPI, persiste los tipos de solicitud reales de jsm en ticket_request_type y los vincula al proyecto

import logging
import re
import unicodedata
from sqlalchemy import text
from app.core.database import get_db

logger = logging.getLogger(__name__)


class RequestTypeConfigurationRepository:

    # vincula un proyecto a una lista de tipos de solicitud, creando los que no existan todavia
    def configure_request_types(self, project_key: str, request_types: list[dict]) -> int:
        db = next(get_db())

        try:
            project_id = self._find_project_id(db, project_key)
            if project_id is None:
                raise ValueError(f"project_key '{project_key}' no existe")

            vinculados = 0
            for rt in request_types:
                request_type_id = self._upsert_request_type(db, rt["name"])
                self._link_project_request_type(db, project_id, request_type_id)
                vinculados += 1

            db.commit()
            logger.info(f"{vinculados} tipos de solicitud configurados para {project_key}")
            return vinculados

        except Exception as e:
            db.rollback()
            logger.error(f"error al configurar tipos de solicitud de {project_key}: {e}")
            raise

        finally:
            db.close()

    # lista los tipos de solicitud vinculados a un proyecto, ordenados por nombre
    # lanza ValueError si el project_key no existe
    def list_project_request_types(self, project_key: str) -> list[dict]:
        db = next(get_db())

        try:
            project_id = self._find_project_id(db, project_key)
            if project_id is None:
                raise ValueError(f"project_key '{project_key}' no existe")

            rows = db.execute(
                text("""
                    SELECT rt.id, rt.name, prt.is_active
                    FROM project_request_type prt
                    JOIN ticket_request_type rt ON rt.id = prt.request_type_id
                    WHERE prt.project_id = :project_id
                    ORDER BY rt.name
                """),
                {"project_id": project_id},
            ).fetchall()

            return [{"id": str(row.id), "name": row.name, "is_active": row.is_active} for row in rows]

        finally:
            db.close()

    # busca el id del proyecto por su code
    def _find_project_id(self, db, project_key: str):
        row = db.execute(text("SELECT id FROM project WHERE code = :code"), {"code": project_key}).fetchone()
        return row.id if row else None

    # crea el tipo de solicitud si no existe (buscando por name exacto), devuelve su id
    def _upsert_request_type(self, db, name: str) -> str:
        existing = db.execute(text("SELECT id FROM ticket_request_type WHERE name = :name"), {"name": name}).fetchone()
        if existing:
            return existing.id

        code = self._slugify(name)
        row = db.execute(
            text("INSERT INTO ticket_request_type (code, name) VALUES (:code, :name) RETURNING id"),
            {"code": code, "name": name},
        ).fetchone()
        return row.id

    # vincula el tipo de solicitud al proyecto, sin duplicar si ya estaba vinculado
    def _link_project_request_type(self, db, project_id: str, request_type_id: str):
        db.execute(
            text("""
                INSERT INTO project_request_type (project_id, request_type_id, is_active)
                VALUES (:project_id, :request_type_id, TRUE)
                ON CONFLICT (project_id, request_type_id) DO NOTHING
            """),
            {"project_id": project_id, "request_type_id": request_type_id},
        )

    # convierte un nombre real en un identificador tecnico simple
    def _slugify(self, name: str) -> str:
        sin_tildes = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
        return re.sub(r"[^a-z0-9]+", "_", sin_tildes.lower()).strip("_")