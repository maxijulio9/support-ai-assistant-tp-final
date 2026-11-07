# cliente para consultar la api rest de confluence
# obtiene las paginas de un space y su contenido en texto plano
# recibe las credenciales ya resueltas, no lee variables de entorno ni las guarda entre trabajos

import logging
import httpx

logger = logging.getLogger(__name__)


# se lanza cuando la conexion con confluence todavia no se configuro, el mensaje dice que falta
class ConfluenceNotConfiguredError(RuntimeError):
    pass


# deja la url base lista para la api rest, con https y terminda en /wiki
# acepta la url con o sin esquema, con barra final o sin /wiki
def normalize_base_url(base_url: str | None) -> str:
    url = (base_url or "").strip().rstrip("/")

    if not url:
        raise ConfluenceNotConfiguredError("Confluence no esta configurado, falta la url base de la conexion")

    if "://" not in url:
        url = f"https://{url}"

    if not url.lower().endswith("/wiki"):
        url = f"{url}/wiki"

    return url


class ConfluenceClient:

    def __init__(self, base_url: str, user_email: str, api_token: str):
        self.base_url = normalize_base_url(base_url)
        self.auth = (user_email, api_token)

    # arma el cliente con lo que devuelve el repositorio de credenciales, o falla con un error claro si no hay
    # el repositorio devuelve none cuando falta la url, el correo o el token, y no se cae en variables de entorno
    @classmethod
    def from_credentials(cls, credentials: dict | None) -> "ConfluenceClient":
        if not credentials:
            raise ConfluenceNotConfiguredError(
                "Confluence no esta configurado, faltan en la base la url base, el correo y el token de la conexion"
            )

        return cls(credentials["base_url"], credentials["user_email"], credentials["api_token"])

    # busca todas las paginas de un space, sin importar el nivel jerarquico
    # usa cql para traer la lista completa en una sola consulta
    def get_pages_from_space(self, space_key: str) -> list[dict]:
        url = f"{self.base_url}/rest/api/content/search"
        params = {
            "cql": f'space="{space_key}" AND type="page"',
            "limit": 100,
        }

        response = httpx.get(url, auth=self.auth, params=params)
        response.raise_for_status()

        data = response.json()
        return data.get("results", [])

    # descarga el contenido completo de una pagina especifica
    # expand=body.storage trae el html/contenido de la pagina
    def get_page_content(self, page_id: str) -> dict:
        url = f"{self.base_url}/rest/api/content/{page_id}"
        params = {"expand": "body.storage,metadata.labels"}

        response = httpx.get(url, auth=self.auth, params=params)
        response.raise_for_status()

        return response.json()
