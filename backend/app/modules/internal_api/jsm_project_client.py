# M7 InternalAPI: consulta a JSM la lista de proyectos disponibles para dar de alta
# es de solo lectura, en tiempo de configuracion

import httpx
import base64


class JsmProjectClient:

    # trae la lista de proyectos reales de la instancia de JSM
    async def get_projects(self, base_url: str, user_email: str, api_token: str) -> list[dict]:
        headers = self._build_auth_header(user_email, api_token)

        async with httpx.AsyncClient(headers=headers) as client:
            response = await client.get(f"{base_url}/rest/api/3/project/search")
            response.raise_for_status()
            data = response.json()

        return [{"key": p["key"], "name": p["name"]} for p in data.get("values", [])]

    def _build_auth_header(self, user_email: str, api_token: str) -> dict:
        credentials = f"{user_email}:{api_token}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return {
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/json",
        }

    # trae los estados reales configurados para un proyecto puntual de jsm
    async def get_project_statuses(self, base_url: str, user_email: str, api_token: str, project_key: str) -> list[dict]:
        headers = self._build_auth_header(user_email, api_token)

        async with httpx.AsyncClient(headers=headers) as client:
            response = await client.get(f"{base_url}/rest/api/3/project/{project_key}/statuses")
            response.raise_for_status()
            data = response.json()

        # cada tipo de issue trae su propia lista de estados, algunos se repiten entre tipos
        # los junto en un solo diccionario por id para no duplicar
        statuses = {}
        for issue_type in data:
            for status in issue_type.get("statuses", []):
                statuses[status["id"]] = status["name"]

        return [{"id": status_id, "name": name} for status_id, name in statuses.items()]
    
    # trae los campos custom del proyecto que son de tipo lista de seleccion unica
    async def get_select_fields(self, base_url: str, user_email: str, api_token: str) -> list[dict]:
        headers = self._build_auth_header(user_email, api_token)

        async with httpx.AsyncClient(headers=headers) as client:
            response = await client.get(f"{base_url}/rest/api/3/field")
            response.raise_for_status()
            fields = response.json()

        return [
            {"id": f["id"], "name": f["name"]}
            for f in fields
            if f.get("schema", {}).get("type") == "option"
        ]

    # trae los valores reales configurados para un campo custom
    # nota: en instancias donde el campo tiene un unico contexto global (compartido entre proyectos),
    # esta lista puede incluir opciones que no aplican a todos los proyectos, el admin elige cuales usar
    async def get_field_options(self, base_url: str, user_email: str, api_token: str, field_id: str) -> list[str]:
        headers = self._build_auth_header(user_email, api_token)

        async with httpx.AsyncClient(headers=headers) as client:
            contexts_response = await client.get(f"{base_url}/rest/api/3/field/{field_id}/context")
            contexts_response.raise_for_status()
            contexts = contexts_response.json().get("values", [])

            if not contexts:
                return []

            context_id = contexts[0]["id"]

            options_response = await client.get(f"{base_url}/rest/api/3/field/{field_id}/context/{context_id}/option")
            options_response.raise_for_status()
            options = options_response.json().get("values", [])

        return [option["value"] for option in options]