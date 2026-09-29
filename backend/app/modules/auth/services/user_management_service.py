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
    
    # desactiva un usuario, rechaza si el admin intenta desactivarse a si mismo
    def deactivate_user(self, user_id: str, admin_id: str) -> AppUser:
        if user_id == admin_id:
            raise PermissionError("no podes desactivarte a vos mismo")

        usuario_desactivado = self.app_user_repository.deactivate(user_id)

        if usuario_desactivado is None:
            raise ValueError("usuario no encontrado")

        return usuario_desactivado
    
    # actualiza el nombre del propio usuario logueado, el rol no se toca aca
    # se mantiene separado de update_user (que es admin editando a otro) para no acoplar
    # dos casos de uso conceptualmente distintos en un solo metodo
    def update_profile(self, user_id: str, full_name: str, role_actual: str) -> AppUser:
        usuario_actualizado = self.app_user_repository.update(user_id, full_name, role_actual)

        if usuario_actualizado is None:
            raise ValueError("usuario no encontrado")

        return usuario_actualizado    