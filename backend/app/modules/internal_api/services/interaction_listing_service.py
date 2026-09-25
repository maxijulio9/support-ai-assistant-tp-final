# M7 InternalAPI
# expone el listado de interacciones para el dashboard 

from app.modules.internal_api.repositories.interaction_listing_repository import InteractionListingRepository


class InteractionListingService:

    def __init__(self):
        self.listing_repository = InteractionListingRepository()

    # lista interacciones paginadas, con filtros opcionales
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
        return self.listing_repository.list_interactions(project_id, category, decision, from_date, to_date, limit, offset)

    # trae el detalle completo de una interaccion puntual, o none si no existe
    def get_detail(self, interaction_id: str) -> dict | None:
        return self.listing_repository.get_detail(interaction_id)