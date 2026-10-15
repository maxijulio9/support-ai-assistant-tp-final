# M7 InternalAPI
# expone los umbrales configurados de los proyectos para el dashboard

from uuid import UUID
from app.modules.internal_api.repositories.project_thresholds_repository import ProjectThresholdsRepository


class ProjectThresholdsService:

    def __init__(self):
        self.thresholds_repository = ProjectThresholdsRepository()

    # devuelve los umbrales de un proyecto o de todos, lanza ValueError si el project_id no tiene formato de uuid
    def get_thresholds(self, project_id: str | None = None) -> list[dict]:
        if project_id:
            try:
                UUID(project_id)
            except ValueError:
                raise ValueError(f"project_id invalido: '{project_id}', se espera un uuid")

        return self.thresholds_repository.get_thresholds(project_id)
