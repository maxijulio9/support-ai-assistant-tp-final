# M7 InternalAPI
# lee los umbrales configurados de cada proyecto

from sqlalchemy import text
from app.core.database import get_db

# valores por defecto del pipeline, se usan si un proyecto no tiene el umbral cargado
DEFAULT_THRESHOLD_AUTO_PUBLISH = 0.85
DEFAULT_THRESHOLD_NEEDS_REVIEW = 0.60
DEFAULT_SIMILARITY_THRESHOLD = 0.40


class ProjectThresholdsRepository:

    # devuelve los umbrales de un proyecto, o de todos si no se indica ninguno, ordenados por id para que el orden no cambie entre llamadas
    # un umbral vacio se completa con el mismo valor por defecto que usa el pipeline
    def get_thresholds(self, project_id: str | None = None) -> list[dict]:
        db = next(get_db())
        try:
            query = "SELECT id, threshold_auto_publish, threshold_needs_review, similarity_threshold FROM project"
            params = {}

            if project_id:
                query += " WHERE id = :project_id"
                params["project_id"] = project_id

            query += " ORDER BY id"

            rows = db.execute(text(query), params).fetchall()

            result = []
            for row in rows:
                result.append({
                    "project_id": str(row.id),
                    "threshold_auto_publish": self._to_float(row.threshold_auto_publish, DEFAULT_THRESHOLD_AUTO_PUBLISH),
                    "threshold_needs_review": self._to_float(row.threshold_needs_review, DEFAULT_THRESHOLD_NEEDS_REVIEW),
                    "similarity_threshold": self._to_float(row.similarity_threshold, DEFAULT_SIMILARITY_THRESHOLD),
                })

            return result
        finally:
            db.close()

    # convierte el numeric de la base a float, o devuelve el valor por defecto si viene vacio
    def _to_float(self, value, default: float) -> float:
        if value is None:
            return default
        return float(value)
