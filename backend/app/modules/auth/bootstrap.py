# M9 AuthModule bootstrap del primer admin
# se ejecuta en cada arranque del servidor, pero solo actua una vez en la vida de la base de datos
# dos guardas, si cualquiera falla, no hace nada: app_user debe estar vacia y las dos
# variables de entorno deben estar seteadas

import logging
from app.core.config import settings
from app.modules.auth.repositories.app_user_repository import AppUserRepository
from app.modules.auth.password_hasher import hash_password

logger = logging.getLogger(__name__)
# las lineas de arranque salen por el logger de uvicorn para que se vean en los registros del servicio
startup_logger = logging.getLogger("uvicorn.error")


def bootstrap_admin() -> None:
    if not settings.admin_email or not settings.admin_password:
        startup_logger.info("bootstrap: administrador omitido, ADMIN_EMAIL y ADMIN_PASSWORD no estan definidos")
        return

    repo = AppUserRepository()

    existing_users = repo.count_users()
    if existing_users > 0:
        startup_logger.info(f"bootstrap: administrador omitido, ya hay {existing_users} usuarios en la base")
        return

    password_hash = hash_password(settings.admin_password)
    repo.create(settings.admin_email, password_hash, "Administrador", "admin")
    startup_logger.info(f"bootstrap: primer admin creado ({settings.admin_email})")