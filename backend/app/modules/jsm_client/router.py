from fastapi import APIRouter
from app.modules.jsm_client.schemas import JsmWebhookPayload

router = APIRouter(prefix="/webhook", tags=["JSM Webhook"])

@router.post("/jsm")
def receive_jsm_webhook(payload: JsmWebhookPayload):
    
    #Endpoint para recibir  eventos de JSM via webhook.
    
    event = payload.webhookEvent

    if event == "jira:issue_created":
        issue_key = payload.issue.key if payload.issue else "unknown"
        print(f"[JSM] Nuevo ticket recibido: {issue_key}")
        return {"status": "received", "event": event, "issue": issue_key}

    return {"status": "ignored", "event": event}

from app.modules.jsm_client import client

@router.post("/jsm/test/comment/{issue_key}")
def test_post_comment(issue_key: str, body: str):
    """Endpoint temporal para probar post_comment."""
    result = client.post_comment(issue_key, body)
    return result

@router.post("/jsm/test/internal-comment/{issue_key}")
def test_post_internal_comment(issue_key: str, body: str):
    """Endpoint temporal para probar post_internal_comment."""
    result = client.post_internal_comment(issue_key, body)
    return result