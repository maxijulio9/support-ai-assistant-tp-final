# M9 AuthModule
# acceso a la tabla app_user

from sqlalchemy import text
from app.core.database import get_db
from app.modules.auth.schemas import AppUser


class AppUserRepository:

    # busca un usuario por email, sin importar si esta activo o no
    # la decision de que hacer con un usuario inactivo es del service, no del repositorio
    def get_by_email(self, email: str) -> AppUser | None:
        db = next(get_db())

        try:
            query = text("""
                SELECT id, email, password_hash, full_name, role, is_active, created_at, updated_at
                FROM app_user
                WHERE LOWER(email) = LOWER(:email)
            """)
            row = db.execute(query, {"email": email}).fetchone()

            if row is None:
                return None

            return self._row_to_app_user(row)

        finally:
            db.close()

    # busca un usuario por id, usado por el middleware para revalidar la cuenta en cada request
    def get_by_id(self, user_id: str) -> AppUser | None:
        db = next(get_db())

        try:
            query = text("""
                SELECT id, email, password_hash, full_name, role, is_active, created_at, updated_at
                FROM app_user
                WHERE id = :user_id
            """)
            row = db.execute(query, {"user_id": user_id}).fetchone()

            if row is None:
                return None

            return self._row_to_app_user(row)

        finally:
            db.close()

    # arma un AppUser a partir de una fila de la query, evita repetir el mismo mapeo en cada metodo
    def _row_to_app_user(self, row) -> AppUser:
        return AppUser(
            id=str(row.id),
            email=row.email,
            password_hash=row.password_hash,
            full_name=row.full_name,
            role=row.role,
            is_active=row.is_active,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )