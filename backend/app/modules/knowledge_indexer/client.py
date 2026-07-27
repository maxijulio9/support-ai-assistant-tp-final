# cliente para consultar la api rest de confluence
# obtiene las paginas de un space y su contenido en texto plano

import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


class ConfluenceClient:

    def __init__(self):
        self.base_url = settings.confluence_base_url
        self.auth = (settings.confluence_user_email, settings.confluence_api_token)

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
        # params = {"expand": "body.storage"}
        params = {"expand": "body.storage,metadata.labels"}
        
        response = httpx.get(url, auth=self.auth, params=params)
        response.raise_for_status()

        return response.json()