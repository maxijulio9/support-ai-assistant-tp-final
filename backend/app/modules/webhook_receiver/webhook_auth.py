# M1 WebhookReceiver
# valida que los webhooks entrantes vengan de quien conoce el secreto compartido de la conexion con jsm

import hashlib
import hmac
import logging
from fastapi import HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from app.modules.internal_api.repositories.jsm_credentials_repository import JsmCredentialsRepository

logger = logging.getLogger(__name__)

# encabezado con el que jira firma sus webhooks de administracion cuando tienen un secreto, formato metodo=firma
SIGNATURE_HEADER = "X-Hub-Signature"

# encabezado alternativo con el secreto tal cual, para las reglas de automation que no firman el cuerpo
SECRET_HEADER = "X-Webhook-Secret"

_credentials_repository = JsmCredentialsRepository()


# trae el secreto guardado, sin secreto configurado el webhook no se puede validar y se responde 503
async def _load_secret() -> str:
    secret = await run_in_threadpool(_credentials_repository.get_webhook_secret)

    if not secret:
        raise HTTPException(status_code=503, detail="El webhook todavía no está configurado")

    return secret


# la firma de jira es el hmac sha256 del cuerpo crudo, la comparacion es en tiempo constnate para no filtrar el secreto
def _signature_matches(secret: str, body: bytes, header_value: str | None) -> bool:
    if not header_value or "=" not in header_value:
        return False

    method, _, received = header_value.partition("=")

    if method.strip().lower() != "sha256":
        return False

    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected.encode("utf-8"), received.strip().lower().encode("utf-8"))


# compara el secreto recibido en el encabezado con el guardado, tambien en tiempo constante
def _secret_matches(secret: str, header_value: str | None) -> bool:
    if not header_value:
        return False

    return hmac.compare_digest(secret.encode("utf-8"), header_value.encode("utf-8"))


# dependencia del webhook de jsm, acepta la firma de jira o el encabezado con el secreto, cualquier otro caso es 401
async def verify_jsm_webhook(request: Request) -> None:
    secret = await _load_secret()
    body = await request.body()

    if _signature_matches(secret, body, request.headers.get(SIGNATURE_HEADER)):
        return

    if _secret_matches(secret, request.headers.get(SECRET_HEADER)):
        return

    origin = request.client.host if request.client else "desconocido"
    logger.warning(f"webhook de jsm rechazado, firma o secreto invalidos, origen {origin}")
    raise HTTPException(status_code=401, detail="Webhook no autorizado")


# dependencia del webhook de confluence, la regla de automation no firma, asi que exige el encabezado con el secreto
async def verify_confluence_webhook(request: Request) -> None:
    secret = await _load_secret()

    if _secret_matches(secret, request.headers.get(SECRET_HEADER)):
        return

    origin = request.client.host if request.client else "desconocido"
    logger.warning(f"webhook de confluence rechazado, secreto invalido, origen {origin}")
    raise HTTPException(status_code=401, detail="Webhook no autorizado")
