# M7 InternalAPI: busca y mapea el workflow completo de un proyecto, por cada tipo de issue

from app.modules.internal_api.repositories.jsm_credentials_repository import JsmCredentialsRepository
from app.modules.internal_api.clients.jsm_project_client import JsmProjectClient


class WorkflowDiscoveryService:

    def __init__(self):
        self.credentials_repository = JsmCredentialsRepository()
        self.jsm_project_client = JsmProjectClient()

    # descubre todos los workflows reales de un proyecto, uno por cada tipo de issue mapeado explicitamente,
    # mas uno de respaldo (issue_type_id None) para el defaultWorkflow, que cubre cualquier tipo de issue
    # no mapeado explicitamente. ninguna organizacion tiene la misma cantidad ni los mismos nombres,
    # esto no asume nada especifico de ninguna empresa
    # devuelve una lista de dicts, cada uno listo para persistir en project_workflow
    async def discover_all_workflows(self, project_key: str) -> list[dict]:
        credentials = self.credentials_repository.get_credentials()
        if credentials is None:
            raise ValueError("todavia no se configuro la conexion con jsm")

        numeric_id = await self.jsm_project_client.get_project_numeric_id(project_key=project_key, **credentials)
        scheme = await self.jsm_project_client.get_workflow_scheme(project_numeric_id=numeric_id, **credentials)
        workflow_scheme = scheme["values"][0]["workflowScheme"]

        # junta todos los nombres de workflow distintos que hay que consultar, sin pedir el mismo dos veces
        # cada entrada es (issue_type_id o None, workflow_name)
        entries = [(issue_type_id, name) for issue_type_id, name in workflow_scheme["issueTypeMappings"].items()]
        entries.append((None, workflow_scheme["defaultWorkflow"]))

        unique_workflow_names = list({name for _, name in entries})
        details = await self.jsm_project_client.get_workflow_details(workflow_names=unique_workflow_names, **credentials)

        # arma un diccionario workflow_name -> (workflow, status_names) para no recorrer la lista de nuevo por cada entrada
        workflows_by_name = {}
        for workflow in details["workflows"]:
            status_names = {s["statusReference"]: s["name"] for s in details["statuses"]}
            workflows_by_name[workflow["name"]] = {"workflow": workflow, "status_names": status_names}

        results = []
        for issue_type_id, workflow_name in entries:
            workflow_info = workflows_by_name.get(workflow_name)
            if workflow_info is None:
                continue

            results.append({
                "issue_type_id": issue_type_id,
                "workflow_name": workflow_name,
                "workflow_data": workflow_info,
            })

        return results