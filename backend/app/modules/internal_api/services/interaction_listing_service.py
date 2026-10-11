# M7 InternalAPI
# expone el listado de interacciones para el dashboard 

import logging
from app.modules.internal_api.repositories.interaction_listing_repository import InteractionListingRepository
from app.modules.internal_api.repositories.jsm_credentials_repository import JsmCredentialsRepository
from app.modules.internal_api.ticket_url_builder import build_ticket_url

logger = logging.getLogger(__name__)


class InteractionListingService:

    def __init__(self):
        self.listing_repository = InteractionListingRepository()
        self.credentials_repository = JsmCredentialsRepository()

    # lista interacciones paginadas, con filtros opcionales, y completa el enlace al ticket de cada una
    def list_interactions(
        self,
        project_id: str | None = None,
        category: str | None = None,
        decision: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict]:
        interactions = self.listing_repository.list_interactions(project_id, category, decision, from_date, to_date, limit, offset)

        if not interactions:
            return interactions

        # la url base se lee una sola vez por pedido, no una por interaccion
        base_url = self._get_base_url()
        for interaction in interactions:
            interaction["ticket_url"] = build_ticket_url(base_url, interaction["issue_key"])

        return interactions

    # trae el detalle completo de una interaccion puntual con el enlace al ticket, o none si no existe
    def get_detail(self, interaction_id: str) -> dict | None:
        detail = self.listing_repository.get_detail(interaction_id)

        if detail is None:
            return None

        detail["ticket_url"] = build_ticket_url(self._get_base_url(), detail["issue_key"])
        return detail

    # lee la url base de jsm, si falla devuelve none para que el listado no se caiga por un enlace
    def _get_base_url(self) -> str | None:
        try:
            return self.credentials_repository.get_base_url()
        except Exception as e:
            logger.warning(f"no se pudo leer la url base de jsm, ticket_url queda en null: {e}")
            return None