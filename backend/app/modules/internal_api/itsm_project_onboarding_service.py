# M7 InternalAPI: expone la lista de proyectos reales de JSM para que el admin elija cuales dar de alta
# CU27


from app.modules.internal_api.jsm_credentials_repository import JsmCredentialsRepository
from app.modules.internal_api.jsm_project_client import JsmProjectClient
from app.modules.internal_api.project_onboarding_repository import ProjectOnboardingRepository



class ItsmProjectOnboardingService:

    def __init__(self):
        self.credentials_repository = JsmCredentialsRepository()
        self.jsm_project_client = JsmProjectClient()
        self.project_onboarding_repository = ProjectOnboardingRepository()

    # trae la lista de proyectos disponibles en jsm, usando las credenciales ya configuradas
    async def list_available_projects(self) -> list[dict]:
        credentials = self.credentials_repository.get_credentials()

        if credentials is None:
            raise ValueError("todavia no se configuro la conexion con jsm")

        return await self.jsm_project_client.get_projects(**credentials)

    # da de alta los proyectos que el admin eligio
    def onboard_projects(self, projects: list) -> int:
        return self.project_onboarding_repository.onboard_projects(projects)
    
    
    # trae los campos custom de jsm de tipo lista de seleccion unica, para que el admin elija cual es categoria
    async def list_select_fields(self) -> list[dict]:
        credentials = self.credentials_repository.get_credentials()

        if credentials is None:
            raise ValueError("todavia no se configuro la conexion con jsm")

        return await self.jsm_project_client.get_select_fields(**credentials)