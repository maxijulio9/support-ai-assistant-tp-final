"""
MODULO 5: JSM  Executor
Es la capa de ejecución de acciones sobre Jira Service Management usando su API REST.
Responsabilidades: publicar comentarios, transicionar estados, asignar tickets a agentes.
"""

import httpx
import base64
from app.core.config import settings


class JsmExecutor:
    
    def __init__(self):
        self.base_url = settings.jsm_base_url
        self.user_email = settings.jsm_user_email
        self.api_token = settings.jsm_api_token
        self._headers = self._build_auth_header()
        self._client = httpx.AsyncClient(headers=self._headers)

    # genera los headers de Basic auth para la API de JSM
    def _build_auth_header(self) -> dict:
        credentials = f"{self.user_email}:{self.api_token}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return {
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/json",
        }

    # publica un comentario en un ticket de JSM.
    # Argumentos: issue_key: Clave del ticket
    # body: Contenido del comentario.
    # public: True para comentario visible al cliente. False para nota interna visible solo para agentes.
    async def post_comment(self, issue_key: str, body: str, public: bool = True) -> dict:
        url = f"{self.base_url}/rest/servicedeskapi/request/{issue_key}/comment"
        payload = {
            "body": body,
            "public": public,
        }
        response = await self._client.post(url, json=payload)
        response.raise_for_status()
        return response.json()

    # cambia el estado de un ticket mediante una transición
    async def transition_issue(self, issue_key: str, transition_id: str) -> bool:
        url = f"{self.base_url}/rest/api/3/issue/{issue_key}/transitions"
        payload = {"transition": {"id": transition_id}}
        response = await self._client.post(url, json=payload)
        return response.status_code == 204

    # obtiene las transiciones disponibles para un ticket
    async def get_transitions(self, issue_key: str) -> dict:
        url = f"{self.base_url}/rest/api/3/issue/{issue_key}/transitions"
        response = await self._client.get(url)
        response.raise_for_status()
        return response.json()

    # asigna un ticket a un agente
    async def assign_issue(self, issue_key: str, account_id: str) -> bool:
        url = f"{self.base_url}/rest/api/3/issue/{issue_key}/assignee"
        payload = {"accountId": account_id}
        response = await self._client.put(url, json=payload)
        return response.status_code == 204
    
    
    async def close(self):
        await self._client.aclose()