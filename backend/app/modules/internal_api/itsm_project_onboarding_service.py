# M7 InternalAPI: expone la lista de proyectos reales de JSM para que el admin elija cuales dar de alta
# CU27


from app.modules.internal_api.jsm_credentials_repository import JsmCredentialsRepository
from app.modules.internal_api.jsm_project_client import JsmProjectClient
from app.modules.internal_api.project_onboarding_repository import ProjectOnboardingRepository
from app.modules.internal_api.request_type_configuration_repository import RequestTypeConfigurationRepository



class ItsmProjectOnboardingService:

    def __init__(self):
        self.credentials_repository = JsmCredentialsRepository()
        self.jsm_project_client = JsmProjectClient()
        self.project_onboarding_repository = ProjectOnboardingRepository()
        self.request_type_configuration_repository = RequestTypeConfigurationRepository()
        
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
    
      # trae los valores reales de un campo elegido por el admin, para que confirme cuales aplican al proyecto
    async def list_field_options(self, field_id: str) -> list[str]:
        credentials = self.credentials_repository.get_credentials()

        if credentials is None:
            raise ValueError("todavia no se configuro la conexion con jsm")

        return await self.jsm_project_client.get_field_options(field_id=field_id, **credentials)

    # vincula el proyecto a las categorias que el admin confirmo
    def configure_categories(self, project_key: str, categories: list[str]) -> int:
        return self.category_configuration_repository.configure_categories(project_key, categories)
    
    
    # trae los tipos de solicitud reales del proyecto y los persiste automaticamente, sin necesitar seleccion del admin
    async def configure_request_types(self, project_key: str) -> int:
        credentials = self.credentials_repository.get_credentials()

        if credentials is None:
            raise ValueError("todavia no se configuro la conexion con jsm")

        service_desk_id = await self.jsm_project_client.get_service_desk_id(project_key=project_key, **credentials)

        if service_desk_id is None:
            raise ValueError(f"no se encontro un service desk para el proyecto '{project_key}'")

        request_types = await self.jsm_project_client.get_request_types(service_desk_id=service_desk_id, **credentials)

        return self.request_type_configuration_repository.configure_request_types(project_key, request_types)
    