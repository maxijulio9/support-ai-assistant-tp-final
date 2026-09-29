# M9 AuthModule: logica de gestion de usuarioss

from app.modules.auth.repositories.app_user_repository import AppUserRepository
from app.modules.auth.password_hasher import hash_password
from app.modules.auth.schemas import AppUser


class UserManagementService:

    def __init__(self):
        self.app_user_repository = AppUserRepository()

    # lista todos los usuarios del sistema
    def list_users(self) -> list[AppUser]:
        return self.app_user_repository.list_all()

    # crea un usuario nuevo, rechaza si el email ya existe
    def create_user(self, email: str, password: str, full_name: str, role: str) -> AppUser:
        existente = self.app_user_repository.get_by_email(email)

        if existente is not None:
            raise ValueError("el email ya esta registrado")

        password_hash = hash_password(password)

        return self.app_user_repository.create(email, password_hash, full_name, role)
    

    # actualiza nombre y rol de un usuario existente, lanza ValueError si no existe
    def update_user(self, user_id: str, full_name: str, role: str) -> AppUser:
        usuario_actualizado = self.app_user_repository.update(user_id, full_name, role)

        if usuario_actualizado is None:
            raise ValueError("usuario no encontrado")

        return usuario_actualizado