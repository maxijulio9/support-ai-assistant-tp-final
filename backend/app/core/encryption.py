# utilidad compartida para encriptar y desencriptar secretos antes de guardarlos en la bd
# usa fernet (aes-128-cbc + hmac-sha256) de la libreria cryptography, con clave  de app_secret_key

import base64
import hashlib
from cryptography.fernet import Fernet
from app.core.config import settings


class SecretCipher:

    def __init__(self):
        self._fernet = Fernet(self._derive_key())

    # deriva una clave valida para fernet a partir de app_secret_key
    # fernet necesita una clave de 32 bytes en base64 urlsafe, app_secret_key puede ser cualquier string
    def _derive_key(self) -> bytes:
        key_bytes = hashlib.sha256(settings.app_secret_key.encode()).digest()
        return base64.urlsafe_b64encode(key_bytes)

    # encripta un valor de texto plano, devuelve el texto encriptado como string
    def encrypt(self, plain_text: str) -> str:
        return self._fernet.encrypt(plain_text.encode()).decode()

    # desencripta un valor previamente encriptado con encrypt()
    def decrypt(self, encrypted_text: str) -> str:
        return self._fernet.decrypt(encrypted_text.encode()).decode()