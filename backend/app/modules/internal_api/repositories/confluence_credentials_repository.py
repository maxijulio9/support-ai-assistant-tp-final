# M7 InternalAPI: lee las credenciales de confluence ya configuradas desde system_config, desencriptadas

import logging
from sqlalchemy import text
from app.core.database import get_db
from app.core.encryption import SecretCipher

logger = logging.getLogger(__name__)


class ConfluenceCredentialsRepository:

    def __init__(self):
        self.cipher = SecretCipher()

    # trae las credenciales de confluence ya guardadas y las desencripta, o none si todavia no se configuro
    def get_credentials(self):
        db = next(get_db())

        try:
            keys = ["confluence_base_url", "confluence_user_email", "confluence_api_token"]
            rows = db.execute(
                text("SELECT key, encrypted_value FROM system_config WHERE key = ANY(:keys)"),
                {"keys": keys},
            ).fetchall()

            valores = {row.key: self.cipher.decrypt(row.encrypted_value) for row in rows}

            if len(valores) < len(keys):
                logger.warning("faltan credenciales de confluence en system_config, todavia no se configuro la conexion")
                return None

            return {
                "base_url": valores["confluence_base_url"],
                "user_email": valores["confluence_user_email"],
                "api_token": valores["confluence_api_token"],
            }

        finally:
            db.close()