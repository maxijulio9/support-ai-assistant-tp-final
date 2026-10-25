# M7 InternalAPI: administra el secreto compartido de los webhooks de jsm y de confluence
# vive cifrado en system_config, es uno por instancia de jsm, y rige al instante porque el backend lo lee de la base en cada pedido

import logging
import secrets
from sqlalchemy import text
from app.core.database import get_db
from app.core.encryption import SecretCipher

logger = logging.getLogger(__name__)

# misma clave que lee la validacion de los webhooks
WEBHOOK_SECRET_KEY = "jsm_webhook_secret"


class WebhookSecretService:

    def __init__(self):
        self.cipher = SecretCipher()
        self.key = WEBHOOK_SECRET_KEY

    # genera un secreto aleatorio de 43 caracteres, seguro para usar como encabezado y como campo de jira
    def generate(self) -> str:
        return secrets.token_urlsafe(32)

    # devuelve el secreto guardado ya desencriptado, o none si todavia no hay ninguno
    def get_secret(self) -> str | None:
        db = next(get_db())

        try:
            row = db.execute(text("SELECT encrypted_value FROM system_config WHERE key = :key"), {"key": self.key}).fetchone()
            return self.cipher.decrypt(row.encrypted_value) if row else None

        finally:
            db.close()

    # dice si hay un secreto guardado, sin desencriptarlo
    def is_configured(self) -> bool:
        db = next(get_db())

        try:
            return db.execute(text("SELECT 1 FROM system_config WHERE key = :key"), {"key": self.key}).fetchone() is not None

        finally:
            db.close()

    # genera un secreto nuevo, lo guarda y lo devuelve, el anterior deja de valer al instante
    def regenerate(self) -> str:
        secret = self.generate()
        db = next(get_db())

        try:
            self.save(db, secret)
            db.commit()
            return secret

        except Exception:
            db.rollback()
            raise

        finally:
            db.close()

    # guarda el secreto cifrado en la sesion que llega, sin confirmar, para que quien llama lo confrime en su propia transaccion
    def save(self, db, secret: str):
        db.execute(
            text("""
                INSERT INTO system_config (key, encrypted_value)
                VALUES (:key, :encrypted_value)
                ON CONFLICT (key)
                DO UPDATE SET encrypted_value = :encrypted_value, updated_at = NOW()
            """),
            {"key": self.key, "encrypted_value": self.cipher.encrypt(secret)},
        )

    # deja guardado el secreto de la conexion, el que llega si trae valor, si no el que ya habia, y si no habia ninguno uno nuevo
    def ensure(self, db, provided: str | None):
        cleaned = provided.strip() if provided else None

        if cleaned:
            self.save(db, cleaned)
            return

        exists = db.execute(text("SELECT 1 FROM system_config WHERE key = :key"), {"key": self.key}).fetchone()

        if exists is None:
            self.save(db, self.generate())
