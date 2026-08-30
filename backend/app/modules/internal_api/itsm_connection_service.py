# M7 InternalAPI: configura la conexion con JSM 
# valida las credenciales contra jsm real antes de guardarlas, las persiste encriptadas en system_config

import logging
from sqlalchemy import text
from app.core.database import get_db
from app.core.encryption import SecretCipher
from app.modules.internal_api.jsm_connection_checker import JsmConnectionChecker

logger = logging.getLogger(__name__)


class ItsmConnectionService:

    def __init__(self):
        self.checker = JsmConnectionChecker()
        self.cipher = SecretCipher()

    # valida las credenciales contra jsm real, si funcionan las guarda encriptadas
    async def configure_connection(self, base_url: str, user_email: str, api_token: str, webhook_secret: str):
        await self.checker.check_connection(base_url, user_email, api_token)

        credentials = {
            "jsm_base_url": base_url,
            "jsm_user_email": user_email,
            "jsm_api_token": api_token,
            "jsm_webhook_secret": webhook_secret,
        }

        db = next(get_db())

        try:
            for key, value in credentials.items():
                self._upsert_secret(db, key, value)
            db.commit()
            logger.info("conexion con jsm configurada y guardada")

        except Exception as e:
            db.rollback()
            logger.error(f"error al guardar la configuracion de jsm: {e}")
            raise

        finally:
            db.close()

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