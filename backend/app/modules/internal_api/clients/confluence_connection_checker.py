# M7 InternalAPI:valida que unas credenciales de Confluence funcionen antes de persistirlas

import httpx
import base64


class ConfluenceConnectionChecker:

    # prueba las credenciales a confluence, devuelve true si son validas
    # lanza httpx.HTTPStatusError si confluence responde con 401
    # lanza httpx.RequestError si confluence no responde
    async def check_connection(self, base_url: str, user_email: str, api_token: str) -> bool:
        headers = self._build_auth_header(user_email, api_token)

        async with httpx.AsyncClient(headers=headers) as client:
            response = await client.get(f"{base_url}/rest/api/user/current")
            response.raise_for_status()
            return True

    def _build_auth_header(self, user_email: str, api_token: str) -> dict:
        credentials = f"{user_email}:{api_token}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return {
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/json",
        }