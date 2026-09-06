# M7 InternalAPI: 
# expone los spaces reales de confluence para que el admin elija cuales vincular a un proyecto CU29

from app.modules.internal_api.repositories.confluence_credentials_repository import ConfluenceCredentialsRepository
from app.modules.internal_api.clients.confluence_client import ConfluenceClient
from app.modules.internal_api.repositories.space_configuration_repository import SpaceConfigurationRepository


class SpaceConfigurationService:

    def __init__(self):
        self.credentials_repository = ConfluenceCredentialsRepository()
        self.confluence_client = ConfluenceClient()
        self.space_configuration_repository = SpaceConfigurationRepository()

    # trae la lista de spaces disponibles en confluence, usando las credenciales ya configuradas
    async def list_available_spaces(self) -> list[dict]:
        credentials = self.credentials_repository.get_credentials()

        if credentials is None:
            raise ValueError("todavia no se configuro la conexion con confluence")

        return await self.confluence_client.get_spaces(**credentials)

    # vincula los spaces que el admin eligio al proyecto
    def configure_spaces(self, project_key: str, spaces: list[dict]) -> int:
        return self.space_configuration_repository.configure_spaces(project_key, spaces)