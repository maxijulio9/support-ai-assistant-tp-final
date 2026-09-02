# M7 InternalAPI: persiste las categorias reales de jsm en ticket_category y las vincula al proyecto

import logging
import re
import unicodedata
from sqlalchemy import text
from app.core.database import get_db

logger = logging.getLogger(__name__)


class CategoryConfigurationRepository:

    # vincula un proyecto a una lista de categorias, creando las que no existan todavia
    def configure_categories(self, project_key: str, categories: list[str]) -> int:
        db = next(get_db())

        try:
            project_id = self._find_project_id(db, project_key)
            if project_id is None:
                raise ValueError(f"project_key '{project_key}' no existe")

            vinculadas = 0
            for name in categories:
                category_id = self._upsert_category(db, name)
                self._link_project_category(db, project_id, category_id)
                vinculadas += 1

            db.commit()
            logger.info(f"{vinculadas} categorias configuradas para {project_key}")
            return vinculadas

        except Exception as e:
            db.rollback()
            logger.error(f"error al configurar categorias de {project_key}: {e}")
            raise

        finally:
            db.close()

    # busca el id del proyecto por su code
    def _find_project_id(self, db, project_key: str):
        row = db.execute(text("SELECT id FROM project WHERE code = :code"), {"code": project_key}).fetchone()
        return row.id if row else None

    # crea la categoria si no existe (buscando por name exacto), devuelve su id
    # el code se genera solo como identificador tecnico, el name queda igual al valor real de jsm
    def _upsert_category(self, db, name: str) -> str:
        existing = db.execute(text("SELECT id FROM ticket_category WHERE name = :name"), {"name": name}).fetchone()
        if existing:
            return existing.id

        code = self._slugify(name)
        row = db.execute(
            text("INSERT INTO ticket_category (code, name) VALUES (:code, :name) RETURNING id"),
            {"code": code, "name": name},
        ).fetchone()
        return row.id

    # vincula la categoria al proyecto, sin duplicar si ya estaba vinculada
    def _link_project_category(self, db, project_id: str, category_id: str):
        db.execute(
            text("""
                INSERT INTO project_category (project_id, category_id, is_active)
                VALUES (:project_id, :category_id, TRUE)
                ON CONFLICT (project_id, category_id) DO NOTHING
            """),
            {"project_id": project_id, "category_id": category_id},
        )

    # convierte un nombre real (con espacios, tildes, mayusculas) en un identificador tecnico simple
    def _slugify(self, name: str) -> str:
        sin_tildes = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
        return re.sub(r"[^a-z0-9]+", "_", sin_tildes.lower()).strip("_")