"""
MODULO 5: JSM  Executor
Es la capa de ejecución de acciones sobre Jira Service Management usando su API REST.
Responsabilidades: publicar comentarios, transicionar estados, asignar tickets a agentes.
"""

import asyncio
import httpx
import base64

# estados con los que jsm pide reintentar, errores del servidor y limite de velocidad
RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
MAX_ATTEMPTS = 4
MAX_RETRY_WAIT_SECONDS = 15.0


class JsmExecutor:
    
    def __init__(self, base_url: str, user_email: str, api_token: str):
        self.base_url = base_url
        self.user_email = user_email
        self.api_token = api_token
        self._headers = self._build_auth_header()
        # tiempos de espera propios y reintentos solo ante fallos de conexion, que no duplican ningun pedido
        self._client = httpx.AsyncClient(
            headers=self._headers,
            timeout=httpx.Timeout(30.0, connect=15.0),
            transport=httpx.AsyncHTTPTransport(retries=3, limits=httpx.Limits(max_keepalive_connections=10, keepalive_expiry=30.0)),
        )

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
        response = await self._send("post", url, json=payload)
        response.raise_for_status()
        return response.json()

    # cambia el estado de un ticket mediante una transición
    async def transition_issue(self, issue_key: str, transition_id: str) -> bool:
        url = f"{self.base_url}/rest/api/3/issue/{issue_key}/transitions"
        payload = {"transition": {"id": transition_id}}
        response = await self._send("post", url, json=payload)
        return response.status_code == 204

    # obtiene las transiciones disponibles para un ticket
    async def get_transitions(self, issue_key: str) -> dict:
        url = f"{self.base_url}/rest/api/3/issue/{issue_key}/transitions"
        response = await self._send("get", url)
        response.raise_for_status()
        return response.json()

    # asigna un ticket a un agente
    async def assign_issue(self, issue_key: str, account_id: str) -> bool:
        url = f"{self.base_url}/rest/api/3/issue/{issue_key}/assignee"
        payload = {"accountId": account_id}
        response = await self._send("put", url, json=payload)
        return response.status_code == 204
    
    
    # envia el pedido y lo reintenta con espera creciente cuando jsm responde con un error del servidor o con limite de velocidad
    # respeta el encabezado Retry-After si viene, los reintentos de conexion ya los hace el transporte
    async def _send(self, method: str, url: str, **kwargs):
        send = getattr(self._client, method)
        response = None

        for attempt in range(MAX_ATTEMPTS):
            response = await send(url, **kwargs)

            if response.status_code not in RETRY_STATUSES or attempt == MAX_ATTEMPTS - 1:
                return response

            await asyncio.sleep(self._retry_wait(response, attempt))

        return response

    # segundos de espera antes del proximo intento, los que pide jsm o una espera que se duplica en cada intento
    def _retry_wait(self, response, attempt: int) -> float:
        try:
            return min(float(response.headers.get("Retry-After")), MAX_RETRY_WAIT_SECONDS)
        except (AttributeError, TypeError, ValueError):
            return float(2 ** attempt)

    # descarga el contenido de un adjunto de un ticket, solo de la misma instancia de jira con la que esta configurado el sistema
    # jira redirige a un almacenamiento temporal, por eso sigue las redirecciones
    async def download_attachment(self, content_url: str) -> bytes:
        if not content_url.startswith(self.base_url.rstrip("/") + "/"):
            raise ValueError("el adjunto no pertenece a la instancia de jira configurada")

        response = await self._send("get", content_url, follow_redirects=True)
        response.raise_for_status()
        return response.content

    async def close(self):
        await self._client.aclose()
    
    # actualiza campos custom o nativos de un ticket (categoria, prioridad, etc)
    async def update_fields(self, issue_key: str, fields_dict: dict) -> bool:
        url = f"{self.base_url}/rest/api/3/issue/{issue_key}"
        payload = {"fields": fields_dict}
        response = await self._send("put", url, json=payload)
        return response.status_code == 204 
    
    # trae el estado actual real del ticket, necesario para el pathfinding de respaldo cuando no hay transicion directa
    async def get_issue_status(self, issue_key: str) -> str:
        url = f"{self.base_url}/rest/api/3/issue/{issue_key}"
        response = await self._send("get", url, params={"fields": "status"})
        response.raise_for_status()
        return response.json()["fields"]["status"]["name"]

    # trae el id del tipo de issue del ticket, se usa para elegir el workflow correcto cuando el evento no lo trae, por ejemplo en un comentario
    async def get_issue_type_id(self, issue_key: str) -> str | None:
        url = f"{self.base_url}/rest/api/3/issue/{issue_key}"
        response = await self._send("get", url, params={"fields": "issuetype"})
        response.raise_for_status()
        issue_type = response.json()["fields"].get("issuetype") or {}
        return issue_type.get("id")
