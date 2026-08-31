# M7 InternalAPI: expone la lista de proyectos reales de JSM para que el admin elija cuales dar de alta
# CU27

import logging
from app.modules.internal_api.jsm_credentials_repository import JsmCredentialsRepository
from app.modules.internal_api.jsm_project_client import JsmProjectClient

logger = logging.getLogger(__name__)


class ItsmProjectOnboardingService:

    def __init__(self):
        self.credentials_repository = JsmCredentialsRepository()
        self.jsm_project_client = JsmProjectClient()

    # trae la lista de proyectos disponibles en jsm, usando las credenciales ya configuradas
    async def list_available_projects(self) -> list[dict]:
        credentials = self.credentials_repository.get_credentials()

        if credentials is None:
            raise ValueError("todavia no se configuró la conexión con jsm")

        return await self.jsm_project_client.get_projects(**credentials)