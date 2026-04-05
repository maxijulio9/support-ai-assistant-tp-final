import httpx
import base64
from app.core.config import settings

# id del agente por defecto para escalación, pruebass
DEFAULT_AGENT_ACCOUNT_ID = settings.jsm_default_agent_id

def _get_auth_header() -> dict:
    credentials = f"{settings.jsm_user_email}:{settings.jsm_api_token}"
    encoded = base64.b64encode(credentials.encode()).decode()
    return {
        "Authorization": f"Basic {encoded}",
        "Content-Type": "application/json",
    }

def post_public_comment(issue_key: str, body: str) -> dict:
    #publica un comentario público en un ticket de JSM 
    #url = f"{settings.jsm_base_url}/rest/api/3/issue/{issue_key}/comment"
    # url = f"{settings.jsm_base_url}/rest/servicedeskapi/request/{issue_key}/comment"
    url = f"{settings.jsm_base_url}/rest/servicedeskapi/request/{issue_key}/comment"
    payload = {
        "body": body,
        "public": True
    }
    with httpx.Client() as client:
        response = client.post(url, json=payload, headers=_get_auth_header())
        response.raise_for_status()
        return response.json()
    # payload = {
    #     "body": {
    #         "type": "doc",
    #         "version": 1,
    #         "content": [
    #             {
    #                 "type": "paragraph",
    #                 "content": [{"type": "text", "text": body}],
    #             }
    #         ],
    #     },
    #     "properties": [
    #         {"key": "sd.public.comment", "value": {"internal": False}}
    #     ]
    # }
    # import base64
    # credentials = f"{settings.jsm_user_email}:{settings.jsm_api_token}"
    # encoded = base64.b64encode(credentials.encode()).decode()
    # print(f"[DEBUG] Email: {settings.jsm_user_email}")
    # print(f"[DEBUG] Token primeros 10 chars: {settings.jsm_api_token[:10]}")
    # print(f"[DEBUG] Auth header: Basic {encoded[:20]}...")
    # with httpx.Client() as client:
    #     response = client.post(url, json=payload, headers=_get_auth_header())
    #     response.raise_for_status()
    #     return response.json()


def post_internal_comment(issue_key: str, body: str) -> dict:
    # publica un comentario interno en un ticket de JSM 
    # url = f"{settings.jsm_base_url}/rest/api/3/issue/{issue_key}/comment"
    url = f"{settings.jsm_base_url}/rest/servicedeskapi/request/{issue_key}/comment"
    payload = {
        "body": body,
        "public": False
    }
    # payload = {
    #     "body": {
    #         "type": "doc",
    #         "version": 1,
    #         "content": [
    #             {
    #                 "type": "paragraph",
    #                 "content": [{"type": "text", "text": body}],
    #             }
    #         ],
    #     },
    #     "properties": [
    #         {"key": "sd.public.comment", "value": {"internal": True}}
    #     ]
    # }
    with httpx.Client() as client:
        response = client.post(url, json=payload, headers=_get_auth_header())
        return response.status_code == 204

def transition_issue(issue_key: str, transition_id: str) -> bool:

    #Cambia el estado de un ticket.    
    url = f"{settings.jsm_base_url}/rest/api/3/issue/{issue_key}/transitions"
    payload = {"transition": {"id": transition_id}}
    with httpx.Client() as client:
        response = client.post(url, json=payload, headers=_get_auth_header())
        return response.status_code == 204

def get_transitions(issue_key: str) -> dict:
    # obtiene las transiciones disponibles para un ticket
    url = f"{settings.jsm_base_url}/rest/api/3/issue/{issue_key}/transitions"
    with httpx.Client() as client:
        response = client.get(url, headers=_get_auth_header())
        response.raise_for_status()
        return response.json()
    
# def assign_issue(issue_key: str, account_id: str) -> bool:

#     #Asigna un ticket a un agente.
#     url = f"{settings.jsm_base_url}/rest/api/3/issue/{issue_key}/assignee"
#     payload = {"accountId": account_id}
#     with httpx.Client() as client:
#         response = client.put(url, json=payload, headers=_get_auth_header())
#         return response.status_code == 204
    
def assign_issue(issue_key: str, account_id: str) -> bool:
    # asigna un ticket a un agente
    url = f"{settings.jsm_base_url}/rest/api/3/issue/{issue_key}/assignee"
    payload = {"accountId": account_id}
    with httpx.Client() as http_client:
        response = http_client.put(url, json=payload, headers=_get_auth_header())
        print(f"[DEBUG] assign_issue status: {response.status_code}")
        print(f"[DEBUG] assign_issue response: {response.text}")
        return response.status_code == 204


def get_agents():
    # obtiene los id de usuarios cuenta atlassian en JSM
    url = f"{settings.jsm_base_url}/rest/api/3/users/search?accountType=atlassian"
    
    with httpx.Client() as http_client:
        response = http_client.get(url, headers=_get_auth_header())
        response.raise_for_status()
        return response.json()
