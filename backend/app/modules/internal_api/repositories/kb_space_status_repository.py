# M7 InternalAPI
# informa el estado de indexacion de cada space de la kb, con lo que realmente hay guardado, para el dashboard

import logging
from sqlalchemy import text
from app.core.database import get_db
from app.modules.event_pipeline.indexing_status_repository import (
    STALE_AFTER_MINUTES,
    STALE_QUEUED_DETAIL,
    STALE_RUNNING_DETAIL,
)

logger = logging.getLogger(__name__)

# fragmentos y paginas de cada space, contados sobre los fragmentos reales y no sobre los numeros de las corridas
# porque una corrida puede cubrir varios spaces a la vez, el filtro opcional deja solo los spaces vinculados a un proyecto
SPACES_QUERY = """
    SELECT ks.space_key, ks.description, c.code AS country_code, ks.language_code,
           COUNT(DISTINCT kc.page_id) AS documents,
           COUNT(kc.id) AS chunks,
           MAX(kc.updated_at) AS last_updated_at
    FROM kb_spaces ks
    LEFT JOIN country c ON c.id = ks.country_id
    LEFT JOIN knowledge_chunk kc ON kc.space_key = ks.space_key
    {project_filter}
    GROUP BY ks.id, c.code
    ORDER BY ks.space_key
"""

PROJECT_FILTER = "WHERE ks.id IN (SELECT ps.space_id FROM project_space ps WHERE ps.project_id = :project_id)"

# la corrida mas reciente que incluyo a cada space, una corrida puede cubrir varios
RUNS_QUERY = """
    SELECT DISTINCT ON (sk) sk AS space_key, id, status, error_detail, started_at, updated_at, is_stale
    FROM (
        SELECT unnest(space_keys) AS sk, id, status, error_detail, started_at, updated_at,
               (status IN ('queued', 'running')
                AND updated_at < NOW() - make_interval(mins => :stale_minutes)) AS is_stale
        FROM kb_indexing_status
    ) runs
    ORDER BY sk, started_at DESC
"""


class KbSpaceStatusRepository:

    # lista los spaces con sus fragmentos, paginas, ultima escritura y ultima corrida
    # con project_key solo trae los spaces vinculados a ese proyecto, lanza ValueError si no existe
    def list_spaces(self, project_key: str | None = None) -> list[dict]:
        db = next(get_db())

        try:
            params = {}
            project_filter = ""

            if project_key:
                project = db.execute(text("SELECT id FROM project WHERE code = :code"), {"code": project_key}).fetchone()
                if project is None:
                    raise ValueError(f"project_key '{project_key}' no existe")
                project_filter = PROJECT_FILTER
                params["project_id"] = project.id

            spaces = db.execute(text(SPACES_QUERY.format(project_filter=project_filter)), params).fetchall()
            runs = db.execute(text(RUNS_QUERY), {"stale_minutes": STALE_AFTER_MINUTES}).fetchall()
            runs_by_space = {run.space_key: run for run in runs}

            return [
                {
                    "space_key": space.space_key,
                    "description": space.description,
                    "country_code": space.country_code,
                    "language_code": space.language_code,
                    "documents": space.documents,
                    "chunks": space.chunks,
                    "last_updated_at": space.last_updated_at.isoformat() if space.last_updated_at else None,
                    "last_run": self._run_to_dict(runs_by_space.get(space.space_key)),
                }
                for space in spaces
            ]

        finally:
            db.close()

    # arma la ultma corrida de un space, una corrida abandonada se informa como fallida, igual que en el estado general
    def _run_to_dict(self, run) -> dict | None:
        if run is None:
            return None

        error_detail = run.error_detail
        status = run.status

        if run.is_stale:
            status = "failed"
            if not error_detail:
                error_detail = STALE_QUEUED_DETAIL if run.status == "queued" else STALE_RUNNING_DETAIL

        return {
            "id": str(run.id),
            "status": status,
            "started_at": run.started_at.isoformat(),
            "updated_at": run.updated_at.isoformat(),
            "error_detail": error_detail,
        }
