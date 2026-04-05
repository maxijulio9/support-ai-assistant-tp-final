from fastapi import APIRouter
from app.modules.jsm_client.schemas import JsmWebhookPayload
from app.modules.jsm_client import client

router = APIRouter( tags=["JSM"])

@router.post("/webhook/jsm")
def receive_jsm_webhook(payload: JsmWebhookPayload):
    
    #Endpoint para recibir  eventos de JSM via webhook.
    
    event = payload.webhookEvent

    if event == "jira:issue_created":
        issue_key = payload.issue.key if payload.issue else "unknown"
        print(f"[JSM] Nuevo ticket recibido: {issue_key}")
        return {"status": "received", "event": event, "issue": issue_key}

    return {"status": "ignored", "event": event}


@router.post("/jsm/comment/{issue_key}")
def post_public_comment(issue_key: str, body: str):
    # endpoint temporal para probar post_comment
    result = client.post_public_comment(issue_key, body)
    return result

@router.post("/jsm/internal-comment/{issue_key}")
def post_internal_comment(issue_key: str, body: str):
    # endpoint temporal para probar post_internal_comment
    result = client.post_internal_comment(issue_key, body)
    return result

@router.get("/jsm/test/transitions/{issue_key}")
def get_transitions(issue_key: str):
    # Obtiene transiciones disponibles para un ticket
    result = client.get_transitions(issue_key)
    return result

@router.post("/jsm/test/transition/{issue_key}/{transition_id}")
def transition_issue(issue_key: str, transition_id: str):
    # prueba cambio de estado de un ticket
    result = client.transition_issue(issue_key, transition_id)
    return {"success": result}

@router.post("/jsm/assign/{issue_key}/{account_id}")
def assign_issue(issue_key: str, account_id: str):
    # asigna un ticket a un agente
    result = client.assign_issue(issue_key, account_id)
    return {"success": result}

@router.get("/jsm/agents")
def get_agents():
    # obtiene los agentes disponibles en la instancia
    result = client.get_agents()
    return result