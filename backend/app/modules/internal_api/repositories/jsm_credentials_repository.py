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