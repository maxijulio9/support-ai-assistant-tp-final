# M7 InternalAPI: persiste las categorias reales de jsm en ticket_category y las vincula al proyecto

import logging
import re
import unicodedata
from sqlalchemy import text
from app.core.database import get_db

logger = logging.getLogger(__name__)


class CategoryConfigurationRepository:

    # deja activas en el proyecto exactamente las categorias de la lista, creando las que no existan todavia
    # las que ya estaban vinculadas y no vienen se desactivan sin borrarse, para conservar el hisorial de las interacciones
    # devuelve cuantas categorias quedaron activas y cuantas se desactivaron en esta llamada
    def configure_categories(self, project_key: str, categories: list[str]) -> dict:
        db = next(get_db())

        try:
            project_id = self._find_project_id(db, project_key)
            if project_id is None:
                raise ValueError(f"project_key '{project_key}' no existe")

            active_ids = []
            for name in categories:
                category_id = self._upsert_category(db, name)
                self._link_project_category(db, project_id, category_id)
                active_ids.append(str(category_id))

            deactivated = self._deactivate_missing(db, project_id, active_ids)

            db.commit()
            logger.info(f"{len(active_ids)} categorias activas y {deactivated} desactivadas para {project_key}")
            return {"categories_configured": len(active_ids), "categories_deactivated": deactivated}

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

    # vincula la categoria al proyecto, si ya estaba vinculada la deja activa, aunque estuviera desactivada
    def _link_project_category(self, db, project_id: str, category_id: str):
        db.execute(
            text("""
                INSERT INTO project_category (project_id, category_id, is_active)
                VALUES (:project_id, :category_id, TRUE)
                ON CONFLICT (project_id, category_id)
                DO UPDATE SET is_active = TRUE
            """),
            {"project_id": project_id, "category_id": category_id},
        )

    # desactiva las categorias activas del proyecto que no estan en la lista, devuelve cuantas desactivo
    def _deactivate_missing(self, db, project_id: str, active_ids: list[str]) -> int:
        rows = db.execute(
            text("SELECT category_id FROM project_category WHERE project_id = :project_id AND is_active = TRUE"),
            {"project_id": project_id},
        ).fetchall()
        to_deactivate = [row.category_id for row in rows if str(row.category_id) not in active_ids]

        for category_id in to_deactivate:
            db.execute(
                text("UPDATE project_category SET is_active = FALSE WHERE project_id = :project_id AND category_id = :category_id"),
                {"project_id": project_id, "category_id": category_id},
            )

        return len(to_deactivate)

    # convierte un nombre real (con espacios, tildes, mayusculas) en un identificador tecnico simple
    def _slugify(self, name: str) -> str:
        sin_tildes = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
        return re.sub(r"[^a-z0-9]+", "_", sin_tildes.lower()).strip("_")
