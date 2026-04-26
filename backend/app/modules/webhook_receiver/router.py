"""
Modulo 1: Webhook receiver
es el endpoint único de entrada para eventos de JSM vía webhook.
"""

from fastapi import APIRouter, HTTPException
from app.modules.webhook_receiver.schemas import JsmWebhookPayload
from app.modules.webhook_receiver import service

router = APIRouter(tags=["Webhook"])


@router.post("/webhook/jsm")
def receive_jsm_webhook(payload: JsmWebhookPayload):
    # punto de entrada único para todos los eventos de JSM
    # valida, normaliza y despacha el evento al módulo correspondiente

    event = service.normalize_payload(payload)

    if event is None:
        raise HTTPException(status_code=400, detail="Payload inválido o sin issue asociado")

    result = service.dispatch_event(event)
    return result