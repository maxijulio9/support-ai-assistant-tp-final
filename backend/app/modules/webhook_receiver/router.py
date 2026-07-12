"""
Modulo 1: Webhook receiver
es el endpoint único de entrada para eventos de JSM vía webhook.
"""

from fastapi import APIRouter, HTTPException
from app.modules.webhook_receiver.schemas import JsmWebhookPayload
from app.modules.webhook_receiver.service import WebhookReceiver

router = APIRouter(tags=["Webhook"])

# instancia única del servicio para toda la aplicación
_receiver = WebhookReceiver()

# unico punto de entrada  para todos los eventos de JSM
# valida, normaliza y despacha el evento al módulo que lo consuma
@router.post("/webhook/jsm")
async def receive_jsm_webhook(payload: JsmWebhookPayload):
  
    event = _receiver.normalize_payload(payload)

    if event is None:
        raise HTTPException(status_code=400, detail="Payload invalido o sin issue asociado")

    result = await _receiver.dispatch_event(event)
    return result