# M7 InternalAPI: persiste el mapeo entre prioridades universales y las reales de jsm para un proyecto

import logging
from sqlalchemy import text
from app.core.database import get_db

logger = logging.getLogger(__name__)


class PriorityMappingRepository:

    # guarda el mapeo confirmado, cada universal puede apuntar a mas de un id real
    # mapping viene como {"Highest": ["1"], "High": ["2"], "Medium": ["3"], "Low": ["4", "5"]}
    def configure_priority_mapping(self, project_key: str, mapping: dict[str, list[str]]) -> int:
        db = next(get_db())

        try:
            project_id = self._find_project_id(db, project_key)
            if project_id is None:
                raise ValueError(f"project_key '{project_key}' no existe")

            vinculados = 0
            for universal_name, system_priority_ids in mapping.items():
                priority_id = self._find_priority_id(db, universal_name)
                if priority_id is None:
                    raise ValueError(f"'{universal_name}' no es un nivel de prioridad valido")

                for system_priority_id in system_priority_ids:
                    self._link_project_priority(db, project_id, priority_id, system_priority_id)
                    vinculados += 1

            db.commit()
            logger.info(f"{vinculados} mapeos de prioridad configurados para {project_key}")
            return vinculados

        except Exception as e:
            db.rollback()
            logger.error(f"error al configurar mapeo de prioridad de {project_key}: {e}")
            raise

        finally:
            db.close()

    def _find_project_id(self, db, project_key: str):
        row = db.execute(text("SELECT id FROM project WHERE code = :code"), {"code": project_key}).fetchone()
        return row.id if row else None

    # busca el id de uno de los 4 niveles universales fijos, por su code
    def _find_priority_id(self, db, universal_name: str):
        row = db.execute(text("SELECT id FROM ticket_priority WHERE code = :code"), {"code": universal_name}).fetchone()
        return row.id if row else None

    # vincula el universal con un id real de jsm, sin duplicar si ya estaba
    def _link_project_priority(self, db, project_id: str, priority_id: str, system_priority_id: str):
        db.execute(
            text("""
                INSERT INTO project_priority (project_id, priority_id, system_priority_id)
                VALUES (:project_id, :priority_id, :system_priority_id)
                ON CONFLICT (project_id, priority_id, system_priority_id) DO NOTHING
            """),
            {"project_id": project_id, "priority_id": priority_id, "system_priority_id": system_priority_id},
        )