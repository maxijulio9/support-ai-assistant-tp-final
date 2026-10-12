"""Tests unitarios para los schemas de interacciones de M7.
Verifican que el contrato publico conserve los campos que consume el frontend."""

from app.modules.internal_api.schemas import InteractionListItem, InteractionDetailResponse

# campos que el frontend ya consume, no pueden desaparecer ni renombrarse
EXISTING_LIST_FIELDS = ["interaction_id", "issue_key", "summary", "category", "priority", "decision", "confidence_score", "created_at"]
EXISTING_DETAIL_FIELDS = EXISTING_LIST_FIELDS + ["text_input", "generated_response", "chunks"]
NEW_FIELDS = ["ticket_url", "system_decision", "resolution_channel"]


# verifica que el item del listado conserva sus campos y suma los nuevos
def test_interaction_list_item_keeps_existing_fields_and_adds_new_ones():
    for field in EXISTING_LIST_FIELDS + NEW_FIELDS:
        assert field in InteractionListItem.model_fields


# verifica que el detalle conserva sus campos y suma los nuevos
def test_interaction_detail_response_keeps_existing_fields_and_adds_new_ones():
    for field in EXISTING_DETAIL_FIELDS + NEW_FIELDS:
        assert field in InteractionDetailResponse.model_fields


# verifica que los campos nuevos aceptan null
def test_new_fields_accept_null():
    item = InteractionListItem(
        interaction_id="i-1", issue_key="TEST-1", ticket_url=None, summary=None, category=None, priority=None,
        decision=None, system_decision=None, resolution_channel=None, confidence_score=None, created_at=None,
    )
    assert item.ticket_url is None
    assert item.system_decision is None
    assert item.resolution_channel is None
