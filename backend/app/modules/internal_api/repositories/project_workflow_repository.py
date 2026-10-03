# M7 InternalAPI
# persiste y lee el workflow descubierto de jira, por proyecto e issue type

import json
from sqlalchemy import text
from app.core.database import get_db


class ProjectWorkflowRepository:

    # guarda o actualiza el workflow descubierto para una combinacion proyecto + issue type
    # issue_type_id puede ser None, representa el workflow de respaldo (defaultWorkflow)
    def upsert(self, project_id: str, issue_type_id: str | None, workflow_name: str, workflow_data: dict) -> None:
        db = next(get_db())

        try:
            query = text("""
                INSERT INTO project_workflow (project_id, issue_type_id, workflow_name, workflow_data, last_synced_at)
                VALUES (:project_id, :issue_type_id, :workflow_name, :workflow_data, NOW())
                ON CONFLICT (project_id, issue_type_id)
                DO UPDATE SET
                    workflow_name = EXCLUDED.workflow_name,
                    workflow_data = EXCLUDED.workflow_data,
                    last_synced_at = NOW()
            """)
            db.execute(query, {
                "project_id": project_id,
                "issue_type_id": issue_type_id,
                "workflow_name": workflow_name,
                "workflow_data": json.dumps(workflow_data),
            })
            db.commit()

        except Exception:
            db.rollback()
            raise

        finally:
            db.close()

    # busca el workflow persistido para un issue_type_id puntual
    # si no hay fila para ese issue_type_id especifico, cae al de respaldo (issue_type_id NULL)
    def get_workflow_data(self, project_id: str, issue_type_id: str | None) -> dict | None:
        db = next(get_db())

        try:
            query = text("""
                SELECT workflow_data
                FROM project_workflow
                WHERE project_id = :project_id
                  AND issue_type_id IS NOT DISTINCT FROM :issue_type_id
            """)
            row = db.execute(query, {"project_id": project_id, "issue_type_id": issue_type_id}).fetchone()

            if row is None and issue_type_id is not None:
                fallback_query = text("""
                    SELECT workflow_data
                    FROM project_workflow
                    WHERE project_id = :project_id AND issue_type_id IS NULL
                """)
                row = db.execute(fallback_query, {"project_id": project_id}).fetchone()

            return row.workflow_data if row else None

        finally:
            db.close()