# M7 InternalAPI: consulta y regenera el secreto compartido de los webhooks, solo para administradores
# el secreto es uno por instancia de jsm y rige al instante, porque el backend lo lee de la base en cada pedidio

import logging
from fastapi import APIRouter, Depends, HTTPException, Response
from app.modules.auth.dependencies import require_admin
from app.modules.auth.schemas import AppUser
from app.modules.internal_api.schemas import ErrorResponse, WebhookSecretResponse
from app.modules.internal_api.services.webhook_secret_service import WebhookSecretService

logger = logging.getLogger(__name__)

router = APIRouter()
_service = WebhookSecretService()

# el secreto no se guarda en cache, ni en el navegador ni en un intermediario
NO_STORE = "no-store"


# devuelve el secreto guardado en texto plano, para que el administrador lo copie y lo pegue en jira y en confluence
@router.get("/api/config/itsm/webhook-secret", response_model=WebhookSecretResponse,
            responses={404: {"model": ErrorResponse, "description": "Todavia no hay un secreto configurado"},
                       503: {"model": ErrorResponse, "description": "No se pudo consultar el secreto"}})
def get_webhook_secret(response: Response, admin: AppUser = Depends(require_admin)):
    try:
        secret = _service.get_secret()
    except Exception:
        logger.exception("error al leer el secreto del webhook")
        raise HTTPException(status_code=503, detail="No se pudo consultar el secreto del webhook")

    if secret is None:
        raise HTTPException(status_code=404, detail="Todavía no hay un secreto configurado")

    response.headers["Cache-Control"] = NO_STORE
    logger.info(f"el usuario {admin.id} consulto el secreto del webhook")
    return WebhookSecretResponse(webhook_secret=secret)


# genera un secreto nuevo y lo devuelve, el anterior deja de valer al instante y los avisos de jira y de confluence dan 401 hasta que se actualicen
@router.post("/api/config/itsm/webhook-secret/regenerate", response_model=WebhookSecretResponse,
             responses={503: {"model": ErrorResponse, "description": "No se pudo regenerar el secreto"}})
def regenerate_webhook_secret(response: Response, admin: AppUser = Depends(require_admin)):
    try:
        secret = _service.regenerate()
    except Exception:
        logger.exception("error al regenerar el secreto del webhook")
        raise HTTPException(status_code=503, detail="No se pudo regenerar el secreto del webhook")

    response.headers["Cache-Control"] = NO_STORE
    logger.info(f"el usuario {admin.id} regenero el secreto del webhook")
    return WebhookSecretResponse(webhook_secret=secret)
