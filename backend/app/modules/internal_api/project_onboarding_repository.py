# M7 InternalAPI: persiste en la bd los proyectos que el admin eligio dar de alta desde jsm

import logging
from sqlalchemy import text
from app.core.database import get_db

logger = logging.getLogger(__name__)


class ProjectOnboardingRepository:

    # da de alta los proyectos elegidos, resolviendo el country_id por code
    def onboard_projects(self, projects: list) -> int:
        db = next(get_db())

        try:
            creados = 0
            for proyecto in projects:
                country_id = self._find_country_id(db, proyecto.country_code)
                if country_id is None:
                    raise ValueError(f"country_code '{proyecto.country_code}' no existe")

                self._insert_project(db, proyecto.code, proyecto.name, country_id)
                creados += 1

            db.commit()
            logger.info(f"{creados} proyectos dados de alta")
            return creados

        except Exception as e:
            db.rollback()
            logger.error(f"error al dar de alta proyectos: {e}")
            raise

        finally:
            db.close()

    # busca el id de un pais por su code
    def _find_country_id(self, db, country_code: str):
        row = db.execute(text("SELECT id FROM country WHERE code = :code"), {"code": country_code}).fetchone()
        return row.id if row else None

    # inserta un proyecto nuevo, o lo actualiza si el code ya existia
    def _insert_project(self, db, code: str, name: str, country_id: str):
        query = text("""
            INSERT INTO project (code, name, country_id)
            VALUES (:code, :name, :country_id)
            ON CONFLICT (code)
            DO UPDATE SET name = :name, country_id = :country_id
        """)
        db.execute(query, {"code": code, "name": name, "country_id": country_id})