# M2 TicketAnalyzer: repositorio de acceso a datos de configuracion de proyecto
# resuelve project_id, country y categorias validas desde la bd relacional
import logging
from sqlalchemy import text
from app.core.database import get_db
from app.modules.ticket_analyzer.schemas import ProjectContext

logger = logging.getLogger(__name__)


class ProjectRepository:

    # busca el proyecto por su code y arma el contexto completo
    def get_project_context(self, project_key: str) -> ProjectContext:
        db = next(get_db())

        try:
            project_row = self._fetch_project_by_code(db, project_key)

            if project_row is None:
                logger.warning(f"project_key '{project_key}' no encontrado en project, usando fallback")
                return ProjectContext()

            categories = self._fetch_active_categories_for_project(db, project_row.id)

            return ProjectContext(
                project_id=str(project_row.id),
                country=project_row.country_code or "unknown",
                categories=categories,
                threshold_auto_publish=project_row.threshold_auto_publish,
                threshold_needs_review=project_row.threshold_needs_review,
                similarity_threshold=project_row.similarity_threshold,
            )

        finally:
            db.close()

    # busca el proyecto por code, con join a country para traer el code del pais
    # de paso trae los umbrales de decision del pipeline, definidos por proyecto
    def _fetch_project_by_code(self, db, project_key: str):
       query = text("""
            SELECT p.id, c.code AS country_code,
                   p.threshold_auto_publish, p.threshold_needs_review, p.similarity_threshold
            FROM project p
            LEFT JOIN country c ON p.country_id = c.id
            WHERE p.code = :project_key
        """)
       return db.execute(query, {"project_key": project_key}).fetchone()

    # busca las categorias activas configuradas para este proyecto
    def _fetch_active_categories_for_project(self, db, project_id: str) -> list[str]:
        query = text("""
            SELECT tc.code
            FROM project_category pc
            JOIN ticket_category tc ON pc.category_id = tc.id
            WHERE pc.project_id = :project_id AND pc.is_active = TRUE
        """)
        rows = db.execute(query, {"project_id": project_id}).fetchall()
        return [row.code for row in rows]