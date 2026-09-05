# M7 InternalAPI, lista los paises validos del catalogo global

from sqlalchemy import text
from app.core.database import get_db


class CountryRepository:

    # trae todos los paises del catalogo, code y name
    def list_countries(self) -> list[dict]:
        db = next(get_db())
        try:
            rows = db.execute(text("SELECT code, name FROM country ORDER BY name")).fetchall()
            return [{"code": row.code, "name": row.name} for row in rows]
        finally:
            db.close()