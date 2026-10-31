# M7 InternalAPI
# lee la configuracion ya guardada de los proyectos, para precargar las pantallas de configuracion

from sqlalchemy import text
from app.core.database import get_db
from app.modules.internal_api.repositories.project_thresholds_repository import (
    DEFAULT_THRESHOLD_AUTO_PUBLISH,
    DEFAULT_THRESHOLD_NEEDS_REVIEW,
    DEFAULT_SIMILARITY_THRESHOLD,
    DEFAULT_FIRST_RESPONSE_TARGET_SECONDS,
)

PROJECTS_QUERY = """
    SELECT p.id, p.code, p.name, c.code AS country_code, p.language_code, p.is_active,
           p.threshold_auto_publish, p.threshold_needs_review, p.similarity_threshold,
           p.first_response_target_seconds, p.multi_step_transitions_enabled
    FROM project p
    LEFT JOIN country c ON c.id = p.country_id
"""


class ProjectConfigurationReaderRepository:

    # lista los proyectos dados de alta, ordenados por key, con sus umbrales efectivos
    def list_projects(self) -> list[dict]:
        db = next(get_db())

        try:
            rows = db.execute(text(PROJECTS_QUERY + " ORDER BY p.code")).fetchall()
            return [self._row_to_project(row) for row in rows]

        finally:
            db.close()

    # trae un proyecto con todo lo que tiene guardado, lanza ValueError si el project_key no existe
    def get_project_configuration(self, project_key: str) -> dict:
        db = next(get_db())

        try:
            row = db.execute(text(PROJECTS_QUERY + " WHERE p.code = :code"), {"code": project_key}).fetchone()
            if row is None:
                raise ValueError(f"project_key '{project_key}' no existe")

            project = self._row_to_project(row)
            params = {"project_id": project["project_id"]}

            categories = db.execute(text("""
                SELECT tc.id, tc.name, pc.is_active
                FROM project_category pc
                JOIN ticket_category tc ON tc.id = pc.category_id
                WHERE pc.project_id = :project_id
                ORDER BY tc.name
            """), params).fetchall()

            request_types = db.execute(text("""
                SELECT rt.id, rt.name, prt.is_active
                FROM project_request_type prt
                JOIN ticket_request_type rt ON rt.id = prt.request_type_id
                WHERE prt.project_id = :project_id
                ORDER BY rt.name
            """), params).fetchall()

            priorities = db.execute(text("""
                SELECT tp.code, pp.system_priority_id
                FROM project_priority pp
                JOIN ticket_priority tp ON tp.id = pp.priority_id
                WHERE pp.project_id = :project_id
                ORDER BY tp.level, pp.system_priority_id
            """), params).fetchall()

            status_mappings = db.execute(text("""
                SELECT ts.id AS status_id, ts.name AS status_name, pcfg.system_action, pcfg.is_active
                FROM project_config pcfg
                JOIN ticket_status ts ON ts.id = pcfg.status_id
                WHERE pcfg.project_id = :project_id
                ORDER BY ts.name
            """), params).fetchall()

            spaces = db.execute(text("""
                SELECT ks.space_key, ks.description, ks.language_code, c.code AS country_code, ps.is_active
                FROM project_space ps
                JOIN kb_spaces ks ON ks.id = ps.space_id
                LEFT JOIN country c ON c.id = ks.country_id
                WHERE ps.project_id = :project_id
                ORDER BY ks.space_key
            """), params).fetchall()

            # el mapeo de prioridades vuelve con la misma forma que recibe el POST, nivel universal y lista de ids reales
            priority_mapping = {}
            for priority in priorities:
                priority_mapping.setdefault(priority.code, []).append(priority.system_priority_id)

            return {
                "project": project,
                "categories": [{"id": str(r.id), "name": r.name, "is_active": r.is_active} for r in categories],
                "request_types": [{"id": str(r.id), "name": r.name, "is_active": r.is_active} for r in request_types],
                "priority_mapping": priority_mapping,
                "status_mappings": [
                    {"status_id": str(r.status_id), "status_name": r.status_name, "system_action": r.system_action, "is_active": r.is_active}
                    for r in status_mappings
                ],
                "spaces": [
                    {"space_key": r.space_key, "description": r.description, "language_code": r.language_code, "country_code": r.country_code, "is_active": r.is_active}
                    for r in spaces
                ],
            }

        finally:
            db.close()

    # arma el dict de un proyecto a partir de una fila, un umbral vacio se completa con el valor por defecto del pipeline
    def _row_to_project(self, row) -> dict:
        return {
            "project_id": str(row.id),
            "key": row.code,
            "name": row.name,
            "country_code": row.country_code,
            "language_code": row.language_code,
            "is_active": row.is_active,
            "threshold_auto_publish": self._to_float(row.threshold_auto_publish, DEFAULT_THRESHOLD_AUTO_PUBLISH),
            "threshold_needs_review": self._to_float(row.threshold_needs_review, DEFAULT_THRESHOLD_NEEDS_REVIEW),
            "similarity_threshold": self._to_float(row.similarity_threshold, DEFAULT_SIMILARITY_THRESHOLD),
            "first_response_target_seconds": row.first_response_target_seconds if row.first_response_target_seconds is not None else DEFAULT_FIRST_RESPONSE_TARGET_SECONDS,
            "multi_step_transitions_enabled": row.multi_step_transitions_enabled is True,
        }

    # convierte el numeric de la base a float, o devuelve el valor por defecto si viene vacio
    def _to_float(self, value, default: float) -> float:
        if value is None:
            return default
        return float(value)
