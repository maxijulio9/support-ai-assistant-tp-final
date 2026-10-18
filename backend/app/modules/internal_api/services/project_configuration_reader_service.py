# M7 InternalAPI
# expone la configuracion ya guardada de los proyectos para el dashboard

from app.modules.internal_api.repositories.project_configuration_reader_repository import ProjectConfigurationReaderRepository


class ProjectConfigurationReaderService:

    def __init__(self):
        self.reader_repository = ProjectConfigurationReaderRepository()

    # lista los proyectos dados de alta, con su id interno
    def list_projects(self) -> list[dict]:
        return self.reader_repository.list_projects()

    # trae la configuracion guardada de un proyecto, lanza ValueError si el project_key no existe
    def get_project_configuration(self, project_key: str) -> dict:
        return self.reader_repository.get_project_configuration(project_key)
