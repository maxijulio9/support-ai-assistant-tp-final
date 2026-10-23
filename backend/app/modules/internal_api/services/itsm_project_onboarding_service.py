# M7 InternalAPI: expone la lista de proyectos reales de JSM para que el admin elija cuales dar de alta
# CU27


from app.modules.internal_api.repositories.jsm_credentials_repository import JsmCredentialsRepository
from app.modules.internal_api.clients.jsm_project_client import JsmProjectClient
from app.modules.internal_api.repositories.project_onboarding_repository import ProjectOnboardingRepository
from app.modules.internal_api.repositories.request_type_configuration_repository import RequestTypeConfigurationRepository
from app.modules.internal_api.priority_mapping_suggester import PriorityMappingSuggester
from app.modules.internal_api.repositories.priority_mapping_repository import PriorityMappingRepository
from app.modules.internal_api.repositories.category_configuration_repository import CategoryConfigurationRepository

class ItsmProjectOnboardingService:

    def __init__(self):
        self.credentials_repository = JsmCredentialsRepository()
        self.jsm_project_client = JsmProjectClient()
        self.project_onboarding_repository = ProjectOnboardingRepository()
        self.request_type_configuration_repository = RequestTypeConfigurationRepository()
        self.priority_mapping_suggester = PriorityMappingSuggester()
        self.priority_mapping_repository = PriorityMappingRepository()
        self.category_configuration_repository = CategoryConfigurationRepository()
        
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
    # la lista es el conjunto activo del proyecto, las categorias que no vienen se desactivan sin borrarse
    # una lista vacia o con nombres en blanco se rechza, y los repetidos se descartan conservando el orden
    def configure_categories(self, project_key: str, categories: list[str]) -> dict:
        names = list(dict.fromkeys(categories))

        if not names:
            raise ValueError("Hay que indicar al menos una categoría")

        if any(not name.strip() for name in names):
            raise ValueError("Las categorías no pueden estar vacías")

        return self.category_configuration_repository.configure_categories(project_key, names)
    
    
    # trae los tipos de solicitud reales del proyecto y los persiste, sin lista incorpora todos
    # con una lista de ids de jsm incorpora solo esos, un id que no exista en el service desk o una lista vacia se rechazan
    async def configure_request_types(self, project_key: str, request_type_ids: list[str] | None = None) -> int:
        if request_type_ids is not None and len(request_type_ids) == 0:
            raise ValueError("hay que indicar al menos un tipo de solicitud")

        credentials = self.credentials_repository.get_credentials()

        if credentials is None:
            raise ValueError("todavia no se configuro la conexion con jsm")

        service_desk_id = await self.jsm_project_client.get_service_desk_id(project_key=project_key, **credentials)

        if service_desk_id is None:
            raise ValueError(f"no se encontro un service desk para el proyecto '{project_key}'")

        request_types = await self.jsm_project_client.get_request_types(service_desk_id=service_desk_id, **credentials)

        if request_type_ids is not None:
            chosen_ids = set(request_type_ids)
            unknown_ids = sorted(chosen_ids - {str(rt["id"]) for rt in request_types})

            if unknown_ids:
                raise ValueError(f"los tipos de solicitud {', '.join(unknown_ids)} no existen en el service desk del proyecto '{project_key}'")

            request_types = [rt for rt in request_types if str(rt["id"]) in chosen_ids]

        return self.request_type_configuration_repository.configure_request_types(project_key, request_types)

    # trae los tipos de solicitud reales del service desk del proyecto, e indica cuales ya estan incorporados
    # un tipo se considera incorporado si esta vinculado al proyecto y activo, se compara por nombre porque es como se guardan
    async def list_available_request_types(self, project_key: str) -> list[dict]:
        credentials = self.credentials_repository.get_credentials()

        if credentials is None:
            raise ValueError("todavia no se configuro la conexion con jsm")

        service_desk_id = await self.jsm_project_client.get_service_desk_id(project_key=project_key, **credentials)

        if service_desk_id is None:
            raise ValueError(f"no se encontro un service desk para el proyecto '{project_key}'")

        incorporated = self.request_type_configuration_repository.list_project_request_types(project_key)
        incorporated_names = {rt["name"] for rt in incorporated if rt["is_active"]}

        request_types = await self.jsm_project_client.get_request_types(service_desk_id=service_desk_id, **credentials)

        return [{"id": str(rt["id"]), "name": rt["name"], "incorporated": rt["name"] in incorporated_names} for rt in request_types]

    # lista los tipos de solicitud ya incorporados a un proyecto, sin consultar jsm
    def list_project_request_types(self, project_key: str) -> list[dict]:
        return self.request_type_configuration_repository.list_project_request_types(project_key)
    
    # trae las prioridades reales de jsm junto con una sugerencia automatica de mapeo
    async def list_priorities_with_suggestion(self) -> dict:
        credentials = self.credentials_repository.get_credentials()

        if credentials is None:
            raise ValueError("todavia no se configuro la conexion con jsm")

        priorities = await self.jsm_project_client.get_priorities(**credentials)
        suggestions = self.priority_mapping_suggester.suggest(priorities)

        return {"priorities": priorities, "suggestions": suggestions}

    # persiste el mapeo que el admin confirmo, con o sin ajustes sobre la sugerencia
    def configure_priority_mapping(self, project_key: str, mapping: dict) -> int:
        return self.priority_mapping_repository.configure_priority_mapping(project_key, mapping)