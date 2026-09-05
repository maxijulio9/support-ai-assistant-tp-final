#  consulta a Confluence la lista de spaces disponibles CU29
# es de solo lectura, en tiempo de configuracion
#

import httpx
import base64


class ConfluenceClient:

    # trae la lista de spaces reales de la instancia de confluence
    async def get_spaces(self, base_url: str, user_email: str, api_token: str) -> list[dict]:
        headers = self._build_auth_header(user_email, api_token)

        async with httpx.AsyncClient(headers=headers) as client:
            response = await client.get(f"{base_url}/api/v2/spaces")
            response.raise_for_status()
            data = response.json()

        return [{"id": s["id"], "key": s["key"], "name": s["name"]} for s in data.get("results", [])]

    def _build_auth_header(self, user_email: str, api_token: str) -> dict:
        credentials = f"{user_email}:{api_token}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return {
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/json",
        }