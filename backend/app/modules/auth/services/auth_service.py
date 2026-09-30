# M9 AuthModul logica de autenticacion

from app.modules.auth.repositories.app_user_repository import AppUserRepository
from app.modules.auth.password_hasher import verify_password, hash_password
from app.modules.auth.token_denylist import add_to_denylist
from app.modules.auth.password_reset_token import create_reset_token, get_user_id_from_token, consume_reset_token
from app.modules.auth.sendgrid_client import SendGridClient

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
    
    # invalida el token actual agregando su jti a la denylist
    async def logout(self, jti: str, exp: int) -> None:
        await add_to_denylist(jti, exp)
        
    # inicia el flujo de reset, genera el token y manda el mail
    # siempre se comporta igual haya o no un usuario con ese email, para no filtrar que cuentas existen
    async def forgot_password(self, email: str) -> None:
        user = self.app_user_repository.get_by_email(email)

        if user is None or not user.is_active:
            return

        token = await create_reset_token(user.id)
        link = f"https://tokenia.example.com/reset-password?token={token}"

        email_client = SendGridClient()
        await email_client.send_email(
            to_email=user.email,
            subject="Restablecer tu contraseña - Tokenia",
            body=f"Usá este link para restablecer tu contraseña, vence en 30 minutos.\n\n{link}",
        )
        await email_client.close()

    # completa el flujo de reset, valida el token, cambia la contraseña y lo consume
    async def reset_password(self, token: str, new_password: str) -> None:
        user_id = await get_user_id_from_token(token)

        if user_id is None:
            raise ValueError("token invalido o vencido")

        password_hash = hash_password(new_password)
        self.app_user_repository.update_password(user_id, password_hash)
        await consume_reset_token(token)