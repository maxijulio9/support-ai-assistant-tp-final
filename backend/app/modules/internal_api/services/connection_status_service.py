# M7 InternalAPI
# expone si las conexiones con JSM y con Confluence estan configuradas, sin devolver nunca los secretos

from app.modules.internal_api.repositories.jsm_credentials_repository import JsmCredentialsRepository
from app.modules.internal_api.repositories.confluence_credentials_repository import ConfluenceCredentialsRepository


class ConnectionStatusService:

    def __init__(self):
        self.jsm_credentials_repository = JsmCredentialsRepository()
        self.confluence_credentials_repository = ConfluenceCredentialsRepository()

    # estado de la conexion con jsm
    def get_jsm_connection(self) -> dict:
        return self._to_status(self.jsm_credentials_repository.get_public_settings())

    # estado de la conexion con confluence
    def get_confluence_connection(self) -> dict:
        return self._to_status(self.confluence_credentials_repository.get_public_settings())

    # arma la respuesta a partir de la url y el email guardados, o de none si todavia no se configuro
    def _to_status(self, settings: dict | None) -> dict:
        if settings is None:
            return {"configured": False, "base_url": None, "user_email": None}

        return {"configured": True, "base_url": settings["base_url"], "user_email": settings["user_email"]}
