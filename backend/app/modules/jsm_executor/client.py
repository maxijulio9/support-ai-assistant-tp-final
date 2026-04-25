"""
MODULO 5: JSM  Executor
Es la capa de ejecución de acciones sobre Jira Service Management usando su API REST.
Responsabilidades: publicar comentarios, transicionar estados, asignar tickets a agentes.
"""

import httpx
import base64
from app.core.config import settings


def _get_auth_header() -> dict:
    # genera los headers de Basic auth para la API de JSM 
    credentials = f"{settings.jsm_user_email}:{settings.jsm_api_token}"
    encoded = base64.b64encode(credentials.encode()).decode()
    return {
        "Authorization": f"Basic {encoded}",
        "Content-Type": "application/json",
    }


# publica un comentario en un ticket de JSM.
# Args: issue_key: Clave del ticket
# body: Contenido del comentario.
#  public:  True para comentario visible al cliente. False para nota interna visible solo para agentes.   
def post_comment(issue_key: str, body: str, public: bool = True) -> dict:
   
    url = f"{settings.jsm_base_url}/rest/servicedeskapi/request/{issue_key}/comment"
    payload = {
        "body": body,
        "public": public,
    }
    with httpx.Client() as client:
        response = client.post(url, json=payload, headers=_get_auth_header())
        response.raise_for_status()
        return response.json()


#Cambia el estado de un ticket mediante una transición.    
def transition_issue(issue_key: str, transition_id: str) -> bool:
   
    url = f"{settings.jsm_base_url}/rest/api/3/issue/{issue_key}/transitions"
    payload = {"transition": {"id": transition_id}}
    with httpx.Client() as client:
        response = client.post(url, json=payload, headers=_get_auth_header())
        return response.status_code == 204


# obtiene las transiciones disponibles para un ticket
def get_transitions(issue_key: str) -> dict:
 
    url = f"{settings.jsm_base_url}/rest/api/3/issue/{issue_key}/transitions"
    with httpx.Client() as client:
        response = client.get(url, headers=_get_auth_header())
        response.raise_for_status()
        return response.json()

# asigna un ticket a un agente
def assign_issue(issue_key: str, account_id: str) -> bool:
   
    url = f"{settings.jsm_base_url}/rest/api/3/issue/{issue_key}/assignee"
    payload = {"accountId": account_id}
    with httpx.Client() as client:
        response = client.put(url, json=payload, headers=_get_auth_header())
        return response.status_code == 204