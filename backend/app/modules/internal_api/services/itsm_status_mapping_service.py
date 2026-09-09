# M7 InternalAPI: expone los estados reales de un proyecto de JSM ya configurado 
# CU28, TF-122


from app.modules.internal_api.repositories.jsm_credentials_repository import JsmCredentialsRepository
from app.modules.internal_api.clients.jsm_project_client import JsmProjectClient
from app.modules.internal_api.repositories.ticket_status_repository import TicketStatusRepository


class ItsmStatusMappingService:

    def __init__(self):
        self.credentials_repository = JsmCredentialsRepository()
        self.jsm_project_client = JsmProjectClient()
        self.ticket_status_repository = TicketStatusRepository()

    # trae los estados reales del proyecto, usando las credenciales ya configuradas
    async def list_project_statuses(self, project_key: str) -> list[dict]:
        credentials = self.credentials_repository.get_credentials()
        if credentials is None:
            raise ValueError("todavia no se configuro la conexion con jsm")

        statuses = await self.jsm_project_client.get_project_statuses(project_key=project_key, **credentials)
        self.ticket_status_repository.configure_statuses(statuses)

        return statuses