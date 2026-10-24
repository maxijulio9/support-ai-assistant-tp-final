# M7 InternalAPI: lee las credenciales de jsm ya configuradas desde system_config, desencriptadas

import logging
from sqlalchemy import text
from app.core.database import get_db
from app.core.encryption import SecretCipher

logger = logging.getLogger(__name__)


class JsmCredentialsRepository:

    def __init__(self):
        self.cipher = SecretCipher()

    # trae las credenciales de jsm ya guardadas y las desencripta, o none si todavia no se configuro
    def get_credentials(self):
        db = next(get_db())

        try:
            keys = ["jsm_base_url", "jsm_user_email", "jsm_api_token"]
            rows = db.execute(
                text("SELECT key, encrypted_value FROM system_config WHERE key = ANY(:keys)"),
                {"keys": keys},
            ).fetchall()

            valores = {row.key: self.cipher.decrypt(row.encrypted_value) for row in rows}

            if len(valores) < len(keys):
                logger.warning("faltan credenciales de jsm en system_config, todavia no se configuró la conexión")
                return None

            return {
                "base_url": valores["jsm_base_url"],
                "user_email": valores["jsm_user_email"],
                "api_token": valores["jsm_api_token"],
            }

        finally:
            db.close()
    
    # trae solo la url base de jsm ya guardada y la desencripta, o none si todavia no se configuro
    def get_base_url(self) -> str | None:
        db = next(get_db())

        try:
            row = db.execute(
                text("SELECT encrypted_value FROM system_config WHERE key = :key"),
                {"key": "jsm_base_url"},
            ).fetchone()

            if row is None:
                return None

            return self.cipher.decrypt(row.encrypted_value)

        finally:
            db.close()

    # trae solo la url base y el email de la conexion con jsm, sin el token, o none si todavia no se configuro
    # el token se verifica que exista pero no se desencripta, esta lectura se usa para mostrar el estado en el dashboard
    def get_public_settings(self) -> dict | None:
        db = next(get_db())

        try:
            keys = ["jsm_base_url", "jsm_user_email", "jsm_api_token"]
            rows = db.execute(
                text("SELECT key, encrypted_value FROM system_config WHERE key = ANY(:keys)"),
                {"keys": keys},
            ).fetchall()

            if len({row.key for row in rows}) < len(keys):
                return None

            valores = {row.key: self.cipher.decrypt(row.encrypted_value) for row in rows if row.key != "jsm_api_token"}

            return {"base_url": valores["jsm_base_url"], "user_email": valores["jsm_user_email"]}

        finally:
            db.close()

    # trae el secreto compartido del webhook ya guardado y lo desencripta, o none si todavia no se configuro
    def get_webhook_secret(self) -> str | None:
        db = next(get_db())

        try:
            row = db.execute(
                text("SELECT encrypted_value FROM system_config WHERE key = :key"),
                {"key": "jsm_webhook_secret"},
            ).fetchone()

            if row is None:
                return None

            return self.cipher.decrypt(row.encrypted_value)

        finally:
            db.close()
