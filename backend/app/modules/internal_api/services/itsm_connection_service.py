# M7 InternalAPI: configura la conexion con JSM 
# valida las credenciales contra jsm real antes de guardarlas, las persiste encriptadas en system_config

import logging
from sqlalchemy import text
from app.core.database import get_db
from app.core.encryption import SecretCipher
from app.modules.internal_api.clients.jsm_connection_checker import JsmConnectionChecker
from app.modules.internal_api.services.webhook_secret_service import WebhookSecretService
from app.modules.internal_api.repositories.jsm_credentials_repository import JsmCredentialsRepository

logger = logging.getLogger(__name__)


class ItsmConnectionService:

    def __init__(self):
        self.checker = JsmConnectionChecker()
        self.cipher = SecretCipher()
        self.secret_service = WebhookSecretService()
        self.credentials_repository = JsmCredentialsRepository()

    # valida las credenciales contra jsm real, si funcionan las guarda encriptadas
    # el secreto del webhook es opcional, si no llega se conserva el guardado y, si no hay ninguno, se genera uno aleatorio
    # el token tambien es opcional, si no llega se usa el guardado, siempre que la url y el correo no hayan cambiado
    async def configure_connection(self, base_url: str, user_email: str, api_token: str | None = None, webhook_secret: str | None = None):
        api_token = self._resolve_api_token(base_url, user_email, api_token)
        await self.checker.check_connection(base_url, user_email, api_token)

        credentials = {
            "jsm_base_url": base_url,
            "jsm_user_email": user_email,
            "jsm_api_token": api_token,
        }

        db = next(get_db())

        try:
            for key, value in credentials.items():
                self._upsert_secret(db, key, value)
            self.secret_service.ensure(db, webhook_secret)
            db.commit()
            logger.info("conexion con jsm configurada y guardada")

        except Exception as e:
            db.rollback()
            logger.error(f"error al guardar la configuracion de jsm: {e}")
            raise

        finally:
            db.close()

    # devuelve el token con el que se valida la conexion, el que llego o, si no llego ninguno, el guardado
    # el guardado solo se reutiliza si la url y el correo son los mismos, para no mandar el token a otra direccion
    # lanza ValueError si no hay ningun token o si cambio la url o el correo sin volver a ingresarlo
    def _resolve_api_token(self, base_url: str, user_email: str, api_token: str | None) -> str:
        provided = api_token.strip() if api_token else ""

        if provided:
            return provided

        saved = self.credentials_repository.get_credentials()

        if saved is None:
            raise ValueError("Hay que ingresar el token de API, todavía no hay uno guardado")

        same_url = saved["base_url"].strip().rstrip("/").lower() == base_url.strip().rstrip("/").lower()
        same_email = saved["user_email"].strip().lower() == user_email.strip().lower()

        if not (same_url and same_email):
            raise ValueError("Cambiaste la URL o el correo, hay que ingresar el token de API de nuevo")

        return saved["api_token"]

    # guarda un secreto encriptado, actualiza si la key ya existia
    def _upsert_secret(self, db, key: str, value: str):
        encrypted_value = self.cipher.encrypt(value)
        query = text("""
            INSERT INTO system_config (key, encrypted_value)
            VALUES (:key, :encrypted_value)
            ON CONFLICT (key)
            DO UPDATE SET encrypted_value = :encrypted_value, updated_at = NOW()
        """)
        db.execute(query, {"key": key, "encrypted_value": encrypted_value})