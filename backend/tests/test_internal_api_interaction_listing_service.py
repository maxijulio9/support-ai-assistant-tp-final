"""Tests unitarios para InteractionListingService.
Se mockean el repositorio del listado y el de credenciales para no depender de la bd."""

from unittest.mock import patch
from app.modules.internal_api.services.interaction_listing_service import InteractionListingService

LISTING_REPO = "app.modules.internal_api.services.interaction_listing_service.InteractionListingRepository"
CREDENTIALS_REPO = "app.modules.internal_api.services.interaction_listing_service.JsmCredentialsRepository"


# verifica que el listado completa ticket_url en cada item y lee la url base una sola vez
@patch(CREDENTIALS_REPO)
@patch(LISTING_REPO)
def test_list_interactions_adds_ticket_url_and_reads_base_url_once(mock_listing_class, mock_credentials_class):
    mock_listing_class.return_value.list_interactions.return_value = [
        {"interaction_id": "i-1", "issue_key": "TEST-1"},
        {"interaction_id": "i-2", "issue_key": "TEST-2"},
    ]
    mock_credentials_class.return_value.get_base_url.return_value = "https://example.atlassian.net"

    result = InteractionListingService().list_interactions()

    assert result[0]["ticket_url"] == "https://example.atlassian.net/browse/TEST-1"
    assert result[1]["ticket_url"] == "https://example.atlassian.net/browse/TEST-2"
    assert result[0]["issue_key"] == "TEST-1"
    mock_credentials_class.return_value.get_base_url.assert_called_once()


# verifica que una url base con barra final no genera una barra doble
@patch(CREDENTIALS_REPO)
@patch(LISTING_REPO)
def test_list_interactions_handles_base_url_with_trailing_slash(mock_listing_class, mock_credentials_class):
    mock_listing_class.return_value.list_interactions.return_value = [{"interaction_id": "i-1", "issue_key": "TEST-1"}]
    mock_credentials_class.return_value.get_base_url.return_value = "https://example.atlassian.net/"

    result = InteractionListingService().list_interactions()

    assert result[0]["ticket_url"] == "https://example.atlassian.net/browse/TEST-1"


# verifica que ticket_url queda en none cuando la key del ticket es nula
@patch(CREDENTIALS_REPO)
@patch(LISTING_REPO)
def test_list_interactions_returns_none_ticket_url_when_issue_key_is_none(mock_listing_class, mock_credentials_class):
    mock_listing_class.return_value.list_interactions.return_value = [{"interaction_id": "i-1", "issue_key": None}]
    mock_credentials_class.return_value.get_base_url.return_value = "https://example.atlassian.net"

    result = InteractionListingService().list_interactions()

    assert result[0]["ticket_url"] is None


# verifica que ticket_url queda en none cuando la url base no es https
@patch(CREDENTIALS_REPO)
@patch(LISTING_REPO)
def test_list_interactions_returns_none_ticket_url_when_base_is_not_https(mock_listing_class, mock_credentials_class):
    mock_listing_class.return_value.list_interactions.return_value = [{"interaction_id": "i-1", "issue_key": "TEST-1"}]
    mock_credentials_class.return_value.get_base_url.return_value = "http://example.atlassian.net"

    result = InteractionListingService().list_interactions()

    assert result[0]["ticket_url"] is None


# verifica que con una pagina vacia no se lee la url base
@patch(CREDENTIALS_REPO)
@patch(LISTING_REPO)
def test_list_interactions_does_not_read_base_url_when_there_are_no_interactions(mock_listing_class, mock_credentials_class):
    mock_listing_class.return_value.list_interactions.return_value = []

    result = InteractionListingService().list_interactions()

    assert result == []
    mock_credentials_class.return_value.get_base_url.assert_not_called()


# verifica que si falla la lectura de la url base el listado no se cae y ticket_url queda en none
@patch(CREDENTIALS_REPO)
@patch(LISTING_REPO)
def test_list_interactions_does_not_fail_when_base_url_cannot_be_read(mock_listing_class, mock_credentials_class):
    mock_listing_class.return_value.list_interactions.return_value = [{"interaction_id": "i-1", "issue_key": "TEST-1"}]
    mock_credentials_class.return_value.get_base_url.side_effect = Exception("no se pudo descifrar")

    result = InteractionListingService().list_interactions()

    assert result[0]["ticket_url"] is None


# verifica que el detalle completa ticket_url
@patch(CREDENTIALS_REPO)
@patch(LISTING_REPO)
def test_get_detail_adds_ticket_url(mock_listing_class, mock_credentials_class):
    mock_listing_class.return_value.get_detail.return_value = {"interaction_id": "i-1", "issue_key": "TEST-1", "chunks": []}
    mock_credentials_class.return_value.get_base_url.return_value = "https://example.atlassian.net"

    result = InteractionListingService().get_detail("i-1")

    assert result["ticket_url"] == "https://example.atlassian.net/browse/TEST-1"
    assert result["chunks"] == []


# verifica que el detalle devuelve none y no lee la url base cuando la interaccion no existe
@patch(CREDENTIALS_REPO)
@patch(LISTING_REPO)
def test_get_detail_returns_none_when_interaction_does_not_exist(mock_listing_class, mock_credentials_class):
    mock_listing_class.return_value.get_detail.return_value = None

    result = InteractionListingService().get_detail("i-1")

    assert result is None
    mock_credentials_class.return_value.get_base_url.assert_not_called()


# verifica que el detalle deja ticket_url en none cuando todavia no hay conexion configurada
@patch(CREDENTIALS_REPO)
@patch(LISTING_REPO)
def test_get_detail_returns_none_ticket_url_when_base_url_is_not_configured(mock_listing_class, mock_credentials_class):
    mock_listing_class.return_value.get_detail.return_value = {"interaction_id": "i-1", "issue_key": "TEST-1", "chunks": []}
    mock_credentials_class.return_value.get_base_url.return_value = None

    result = InteractionListingService().get_detail("i-1")

    assert result["ticket_url"] is None