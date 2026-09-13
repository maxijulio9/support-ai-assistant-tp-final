# M3 KnowledgeRetriever: define en que idiomas hay contenido relevante para un proyecto
# usando los spaces vinculados, para saber si hace falta traducir la consulta antes de buscar en la bd vector

from sqlalchemy import text
from app.core.database import get_db


class ProjectLanguagesRepository:

    # trae los idiomas distintos entre los spaces vinculados a un proyecto
    # excluye nulls, un space sin idioma declarado no aporta informacion util aca
    def get_space_languages(self, project_id: str) -> list[str]:
        db = next(get_db())
        try:
            rows = db.execute(text("""
                SELECT DISTINCT ks.language_code
                FROM project_space ps
                JOIN kb_spaces ks ON ps.space_id = ks.id
                WHERE ps.project_id = :project_id AND ks.language_code IS NOT NULL
            """), {"project_id": project_id}).fetchall()

            return [row.language_code for row in rows]
        finally:
            db.close()