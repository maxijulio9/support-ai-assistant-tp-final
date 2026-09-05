# M7 InternalAPI: configura la conexion con Confluence CU28
# valida las credenciales contra confluence real antes de guardarlas, las persiste encriptadas en system_config

import logging
from sqlalchemy import text
from app.core.database import get_db
from app.core.encryption import SecretCipher
from app.modules.internal_api.clients.confluence_connection_checker import ConfluenceConnectionChecker

logger = logging.getLogger(__name__)


class ConfluenceConnectionService:

    def __init__(self):
        self.checker = ConfluenceConnectionChecker()
        self.cipher = SecretCipher()

    # valida las credenciales contra confluence real, si esan ok las guarda encriptadas
    async def configure_connection(self, base_url: str, user_email: str, api_token: str):
        await self.checker.check_connection(base_url, user_email, api_token)

        credentials = {
            "confluence_base_url": base_url,
            "confluence_user_email": user_email,
            "confluence_api_token": api_token,
        }

        db = next(get_db())

        try:
            for key, value in credentials.items():
                self._upsert_secret(db, key, value)
            db.commit()
            logger.info("conexión con confluence configurada y guardada")

        except Exception as e:
            db.rollback()
            logger.error(f"error al guardar la configuración de confluence: {e}")
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