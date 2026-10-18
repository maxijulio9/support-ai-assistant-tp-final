"""Tests unitarios para el id interno de ticket_status en los estados de un proyecto.
Se mockean la base de datos, el cliente de JSM y las credenciales, sin tocar nada real."""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from pydantic import ValidationError
from app.modules.internal_api.repositories.ticket_status_repository import TicketStatusRepository
from app.modules.internal_api.services.itsm_status_mapping_service import ItsmStatusMappingService
from app.modules.internal_api.schemas import ProjectStatusesResponse

REPOSITORY_DB = "app.modules.internal_api.repositories.ticket_status_repository.get_db"
SERVICE = "app.modules.internal_api.services.itsm_status_mapping_service"
CREDENTIALS = {"base_url": "https://example.atlassian.net", "user_email": "test@example.com", "api_token": "token-de-prueba"}


# verifica que cada estado vuelve con su id interno, conservando los datos de JSM, y que se confirma la transaccion
@patch(REPOSITORY_DB)
def test_configure_statuses_with_ids_returns_internal_ids(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])

    with patch.object(TicketStatusRepository, "_upsert_status", side_effect=["uuid-1", "uuid-2"]):
        result = TicketStatusRepository().configure_statuses_with_ids(
            [{"id": "10", "name": "Open"}, {"id": "11", "name": "Done"}]
        )

    assert result == [
        {"id": "10", "name": "Open", "status_id": "uuid-1"},
        {"id": "11", "name": "Done", "status_id": "uuid-2"},
    ]
    mock_db.commit.assert_called_once()


# verifica que si falla la base deshace los cambios y relanza el error
@patch(REPOSITORY_DB)
def test_configure_statuses_with_ids_rolls_back_on_error(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])

    with patch.object(TicketStatusRepository, "_upsert_status", side_effect=Exception("falla de bd")):
        with pytest.raises(Exception, match="falla de bd"):
            TicketStatusRepository().configure_statuses_with_ids([{"id": "10", "name": "Open"}])

    mock_db.rollback.assert_called_once()
    mock_db.commit.assert_not_called()


# verifica que el servicio devuelve los estados de JSM con su id interno
@patch(f"{SERVICE}.TicketStatusRepository")
@patch(f"{SERVICE}.JsmProjectClient")
@patch(f"{SERVICE}.JsmCredentialsRepository")
@pytest.mark.asyncio
async def test_list_project_statuses_returns_internal_ids(mock_credentials_class, mock_client_class, mock_repository_class):
    mock_credentials_class.return_value.get_credentials.return_value = CREDENTIALS
    mock_client_class.return_value.get_project_statuses = AsyncMock(return_value=[{"id": "10", "name": "Open"}])
    mock_repository_class.return_value.configure_statuses_with_ids.return_value = [
        {"id": "10", "name": "Open", "status_id": "uuid-1"}
    ]

    result = await ItsmStatusMappingService().list_project_statuses("TARG")

    assert result == [{"id": "10", "name": "Open", "status_id": "uuid-1"}]
    mock_repository_class.return_value.configure_statuses_with_ids.assert_called_once_with([{"id": "10", "name": "Open"}])


# verifica que sin conexion configurada con JSM falla con ValueError y no escribe nada
@patch(f"{SERVICE}.TicketStatusRepository")
@patch(f"{SERVICE}.JsmProjectClient")
@patch(f"{SERVICE}.JsmCredentialsRepository")
@pytest.mark.asyncio
async def test_list_project_statuses_requires_jsm_connection(mock_credentials_class, mock_client_class, mock_repository_class):
    mock_credentials_class.return_value.get_credentials.return_value = None

    with pytest.raises(ValueError, match="conexion con jsm"):
        await ItsmStatusMappingService().list_project_statuses("TARG")

    mock_repository_class.return_value.configure_statuses_with_ids.assert_not_called()


# verifica que la respuesta de estados declara el id interno como obligatorio
def test_project_statuses_response_requires_internal_status_id():
    response = ProjectStatusesResponse(statuses=[{"id": "10", "name": "Open", "status_id": "uuid-1"}])

    assert response.statuses[0].status_id == "uuid-1"

    with pytest.raises(ValidationError):
        ProjectStatusesResponse(statuses=[{"id": "10", "name": "Open"}])
