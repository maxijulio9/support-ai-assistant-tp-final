# M9 AuthModul logica de autenticacion

from app.modules.auth.repositories.app_user_repository import AppUserRepository
from app.modules.auth.password_hasher import verify_password
from app.modules.auth.jwt_handler import create_access_token


class AuthService:

    def __init__(self):
        self.app_user_repository = AppUserRepository()

    # valida credenciales y genera el access token
    # el mensaje de error es el mismo sin importar si el email no existe, la password esta mal,
    # o la cuenta esta inactiva, para no filtrar informacion sobre que cuentas existen
    def login(self, email: str, password: str) -> dict:
        user = self.app_user_repository.get_by_email(email)

        if user is None or not user.is_active:
            raise ValueError("credenciales invalidas")

        if not verify_password(password, user.password_hash):
            raise ValueError("credenciales invalidas")

        token = create_access_token(user.id, user.role)

        return {"access_token": token, "role": user.role}