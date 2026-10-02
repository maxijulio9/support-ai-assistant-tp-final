# M7 InternalAPI: busca y mapae el workflow completo de un proyecto 


from app.modules.internal_api.repositories.jsm_credentials_repository import JsmCredentialsRepository
from app.modules.internal_api.clients.jsm_project_client import JsmProjectClient


class WorkflowDiscoveryService:

    def __init__(self):
        self.credentials_repository = JsmCredentialsRepository()
        self.jsm_project_client = JsmProjectClient()

    # trae el workflow completo real de un proyecto, resolviendo primero su id numerico
    async def get_project_workflow(self, project_key: str) -> dict:
        credentials = self.credentials_repository.get_credentials()
        if credentials is None:
            raise ValueError("todavia no se configuro la conexion con jsm")

        numeric_id = await self.jsm_project_client.get_project_numeric_id(project_key=project_key, **credentials)
        scheme = await self.jsm_project_client.get_workflow_scheme(project_numeric_id=numeric_id, **credentials)

        workflow_name = scheme["values"][0]["workflowScheme"]["defaultWorkflow"]
        details = await self.jsm_project_client.get_workflow_details(workflow_names=[workflow_name], **credentials)

        return details["workflows"][0]