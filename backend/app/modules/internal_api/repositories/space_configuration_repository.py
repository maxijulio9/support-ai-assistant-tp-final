# M7 InternalAPI: vincula spaces de confluence a un proyecto, creando el space en el catalogo si no existe

import logging
from sqlalchemy import text
from app.core.database import get_db

logger = logging.getLogger(__name__)


class SpaceConfigurationRepository:

    # vincula un proyecto a una lista de spaces, creando los que no existan todavia en kb_spaces
    # cada space es un dict con space_key obligatorio, country_code y description opcionales
    def configure_spaces(self, project_key: str, spaces: list[dict]) -> int:
        db = next(get_db())

        try:
            project_id = self._find_project_id(db, project_key)
            if project_id is None:
                raise ValueError(f"project_key '{project_key}' no existe")

            vinculados = 0
            for space in spaces:
                space_id = self._upsert_space(db, space)
                self._link_project_space(db, project_id, space_id)
                vinculados += 1

            db.commit()
            logger.info(f"{vinculados} spaces configurados para {project_key}")
            return vinculados

        except Exception as e:
            db.rollback()
            logger.error(f"error al configurar spaces de {project_key}: {e}")
            raise

        finally:
            db.close()

    def _find_project_id(self, db, project_key: str):
        row = db.execute(text("SELECT id FROM project WHERE code = :code"), {"code": project_key}).fetchone()
        return row.id if row else None

    # crea el space en kb_spaces si no existe (buscando por space_key exacto), devuelve su id
    # si ya existe, actualiza country_id y description solo si vinieron con valor nuevo
    def _upsert_space(self, db, space: dict) -> str:
        existing = db.execute(text("SELECT id FROM kb_spaces WHERE space_key = :space_key"), {"space_key": space["space_key"]}).fetchone()

        country_id = self._find_country_id(db, space.get("country_code")) if space.get("country_code") else None

        if existing:
            if space.get("country_code") or space.get("description"):
                db.execute(
                    text("""
                        UPDATE kb_spaces
                        SET country_id = COALESCE(:country_id, country_id),
                            description = COALESCE(:description, description)
                        WHERE id = :id
                    """),
                    {"id": existing.id, "country_id": country_id, "description": space.get("description")},
                )
            return existing.id

        row = db.execute(
            text("""
                INSERT INTO kb_spaces (space_key, country_id, description)
                VALUES (:space_key, :country_id, :description)
                RETURNING id
            """),
            {"space_key": space["space_key"], "country_id": country_id, "description": space.get("description")},
        ).fetchone()
        return row.id

    def _find_country_id(self, db, country_code: str):
        row = db.execute(text("SELECT id FROM country WHERE code = :code"), {"code": country_code}).fetchone()
        return row.id if row else None

    # vincula el space al proyecto, sin duplicar si ya estaba vinculado
    def _link_project_space(self, db, project_id: str, space_id: str):
        db.execute(
            text("""
                INSERT INTO project_space (project_id, space_id, is_active)
                VALUES (:project_id, :space_id, TRUE)
                ON CONFLICT (project_id, space_id) DO NOTHING
            """),
            {"project_id": project_id, "space_id": space_id},
        )