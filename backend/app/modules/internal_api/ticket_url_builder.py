# M7 InternalAPI
# arma el enlace al ticket de jsm a partir de la url base de la conexion y la key del ticket

from urllib.parse import urlparse, quote


# devuelve la url del ticket en jsm, o none si no se puede armar de forma segura
def build_ticket_url(base_url: str | None, ticket_key: str | None) -> str | None:
    if not base_url or not ticket_key:
        return None

    key = ticket_key.strip()
    base = base_url.strip().rstrip("/")

    if not key or not base:
        return None

    try:
        parsed = urlparse(base)
    except ValueError:
        return None

    # solo se aceptan urls https con host, sin credenciales ni parametros incrustados
    if parsed.scheme != "https" or not parsed.netloc:
        return None
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        return None

    return f"{base}/browse/{quote(key, safe='')}"