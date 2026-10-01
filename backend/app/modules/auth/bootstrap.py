# M9 AuthModule bootstrap del primer admin
# se ejecuta en cada arranque del servidor, pero solo actua una vez en la vida de la base de datos
# dos guardas, si cualquiera falla, no hace nada: app_user debe estar vacia y las dos
# variables de entorno deben estar seteadas

import logging
from app.core.config import settings
from app.modules.auth.repositories.app_user_repository import AppUserRepository
from app.modules.auth.password_hasher import hash_password

logger = logging.getLogger(__name__)


def bootstrap_admin() -> None:
    if not settings.admin_email or not settings.admin_password:
        return

    repo = AppUserRepository()

    if repo.count_users() > 0:
        return

    password_hash = hash_password(settings.admin_password)
    repo.create(settings.admin_email, password_hash, "Administrador", "admin")
    logger.info(f"bootstrap: primer admin creado ({settings.admin_email})")