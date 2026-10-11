"""Tests unitarios para los schemas de interacciones de M7.
Verifican que el contrato publico conserve los campos que consume el frontend."""

from app.modules.internal_api.schemas import InteractionListItem, InteractionDetailResponse


# verifica que el item del listado conserva issue_key y suma ticket_url
def test_interaction_list_item_keeps_issue_key_and_adds_ticket_url():
    assert "issue_key" in InteractionListItem.model_fields
    assert "ticket_url" in InteractionListItem.model_fields


# verifica que el detalle conserva issue_key y suma ticket_url
def test_interaction_detail_response_keeps_issue_key_and_adds_ticket_url():
    assert "issue_key" in InteractionDetailResponse.model_fields
    assert "ticket_url" in InteractionDetailResponse.model_fields