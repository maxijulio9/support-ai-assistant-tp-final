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
    
        # trae todos los usuarios, ordenados por fecha de creacion
    def list_all(self) -> list[AppUser]:
        db = next(get_db())

        try:
            query = text("""
                SELECT id, email, password_hash, full_name, role, is_active, created_at, updated_at
                FROM app_user
                ORDER BY created_at
            """)
            rows = db.execute(query).fetchall()

            return [self._row_to_app_user(row) for row in rows]

        finally:
            db.close()

    # inserta un usuario nuevo y devuelve la fila creada
    # el password_hash ya viene hasheado, el repositorio no hashea nada
    def create(self, email: str, password_hash: str, full_name: str, role: str) -> AppUser:
        db = next(get_db())

        try:
            query = text("""
                INSERT INTO app_user (email, password_hash, full_name, role)
                VALUES (:email, :password_hash, :full_name, :role)
                RETURNING id, email, password_hash, full_name, role, is_active, created_at, updated_at
            """)
            row = db.execute(query, {
                "email": email,
                "password_hash": password_hash,
                "full_name": full_name,
                "role": role,
            }).fetchone()
            db.commit()

            return self._row_to_app_user(row)

        except Exception:
            db.rollback()
            raise

        finally:
            db.close()

    
    # actualiza full_name y role de un usuario existente, devuelve None si el id no existe
    def update(self, user_id: str, full_name: str, role: str) -> AppUser | None:
        db = next(get_db())

        try:
            query = text("""
                UPDATE app_user
                SET full_name = :full_name, role = :role, updated_at = NOW()
                WHERE id = :user_id
                RETURNING id, email, password_hash, full_name, role, is_active, created_at, updated_at
            """)
            row = db.execute(query, {
                "user_id": user_id,
                "full_name": full_name,
                "role": role,
            }).fetchone()
            db.commit()

            if row is None:
                return None

            return self._row_to_app_user(row)

        except Exception:
            db.rollback()
            raise

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

    # desactiva un usuario, devuelve None si el id no existe
    def deactivate(self, user_id: str) -> AppUser | None:
        db = next(get_db())

        try:
            query = text("""
                UPDATE app_user
                SET is_active = FALSE, updated_at = NOW()
                WHERE id = :user_id
                RETURNING id, email, password_hash, full_name, role, is_active, created_at, updated_at
            """)
            row = db.execute(query, {"user_id": user_id}).fetchone()
            db.commit()

            if row is None:
                return None

            return self._row_to_app_user(row)

        except Exception:
            db.rollback()
            raise

        finally:
            db.close()      
    
    # actualiza el password_hash de un usuario, usado por el flujo de restablecimiento de contraseña
    def update_password(self, user_id: str, password_hash: str) -> AppUser | None:
        db = next(get_db())

        try:
            query = text("""
                UPDATE app_user
                SET password_hash = :password_hash, updated_at = NOW()
                WHERE id = :user_id
                RETURNING id, email, password_hash, full_name, role, is_active, created_at, updated_at
            """)
            row = db.execute(query, {"user_id": user_id, "password_hash": password_hash}).fetchone()
            db.commit()

            if row is None:
                return None

            return self._row_to_app_user(row)

        except Exception:
            db.rollback()
            raise

        finally:
            db.close()
            
    # cuenta cuantos usuarios existen, usado por el bootstrap del primer admin
    def count_users(self) -> int:
        db = next(get_db())

        try:
            query = text("SELECT COUNT(*) FROM app_user")
            return db.execute(query).scalar()

        finally:
            db.close()