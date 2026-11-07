# core: verificaciones que corren al arrancar la api, antes de atender pedidos

from app.core.config import settings

# claves que no pueden estar vacias, con una clave vacia los tokens se firman y las credenciales se cifran sin proteccion real
REQUIRED_SECRETS = {"JWT_SECRET_KEY": "jwt_secret_key", "APP_SECRET_KEY": "app_secret_key"}


# corta el arranque si falta alguna de las claves obligatorias, el mensaje dice cuales son
def validate_required_secrets() -> None:
    missing = [name for name, attribute in REQUIRED_SECRETS.items() if not (getattr(settings, attribute) or "").strip()]

    if missing:
        raise RuntimeError(f"faltan variables de entorno obligatorias: {', '.join(missing)}")
