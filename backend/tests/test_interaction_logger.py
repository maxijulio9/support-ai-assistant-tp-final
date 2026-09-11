"""Tests unitarios para M6 InteractionLogger.

Se mockea la sesion de base de datos para verificar que arma bien las consultas,
sin tocar la bd real"""

from unittest.mock import patch, MagicMock
from app.modules.interaction_logger.service import InteractionLogger
from app.modules.ticket_analyzer.schemas import TicketAnalysis


# arma un TicketAnalysis basico para usar en los tests
def _build_analysis(**overrides) -> TicketAnalysis:
    defaults = dict(
        issue_key="TEST-1",
        event_type="jira:issue_created",
        summary="no puedo iniciar sesion",
        country="AR",
        project_id="proj-1",
        category="acceso_autenticacion",
        priority="High",
        sentiment="negativo",
        intent="reporte_problema",
        info_sufficient=True,
        status="Open",
        request_type="Portal Tokenia",
    )
    defaults.update(overrides)
    return TicketAnalysis(**defaults)


# verifica que _find_catalog_id busca por code por defecto
@patch("app.modules.interaction_logger.service.get_db")
def test_find_catalog_id_busca_por_code_por_defecto(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchone.return_value = MagicMock(id="cat-1")

    logger_service = InteractionLogger()
    result = logger_service._find_catalog_id(mock_db, "ticket_category", "acceso_autenticacion")

    assert result == "cat-1"
    query_text = str(mock_db.execute.call_args[0][0])
    assert "code = :value" in query_text


# verifica que _find_catalog_id busca por name cuando se lo pide explicitamente
@patch("app.modules.interaction_logger.service.get_db")
def test_find_catalog_id_busca_por_name_si_se_especifica(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchone.return_value = MagicMock(id="rt-1")

    logger_service = InteractionLogger()
    result = logger_service._find_catalog_id(mock_db, "ticket_request_type", "Portal Tokenia", search_column="name")

    assert result == "rt-1"
    query_text = str(mock_db.execute.call_args[0][0])
    assert "name = :value" in query_text


# verifica que _find_catalog_id devuelve None sin romper si no encuentra nada
@patch("app.modules.interaction_logger.service.get_db")
def test_find_catalog_id_devuelve_none_si_no_encuentra(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchone.return_value = None

    logger_service = InteractionLogger()
    result = logger_service._find_catalog_id(mock_db, "ticket_status", "Open")

    assert result is None


# verifica que _get_or_create_ticket crea un ticket nuevo con project_id y request_type_id completos
@patch("app.modules.interaction_logger.service.get_db")
def test_get_or_create_ticket_crea_ticket_nuevo_con_ids_completos(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])

    # primera llamada (buscar ticket existente) no encuentra nada
    # las siguientes llamadas (catalogos) devuelven ids simulados
    # la ultima llamada (insert) devuelve el id del ticket creado
    mock_db.execute.return_value.fetchone.side_effect = [
        None,  # ticket no existe todavia
        MagicMock(id="country-1"),  # country
        MagicMock(id="priority-1"),  # priority
        MagicMock(id="category-1"),  # category
        MagicMock(id="rt-1"),  # request_type
        None,  # status, ticket_status vacia (TF-145)
        MagicMock(id="ticket-nuevo"),  # insert final
    ]

    logger_service = InteractionLogger()
    analysis = _build_analysis()
    ticket_id = logger_service._get_or_create_ticket(mock_db, analysis)

    assert ticket_id == "ticket-nuevo"

    # confirma que el insert incluyo project_id tomado directo de analysis, sin buscarlo en ningun catalogo
    insert_call = mock_db.execute.call_args_list[-1]
    insert_params = insert_call[0][1]
    assert insert_params["project_id"] == "proj-1"
    assert insert_params["request_type_id"] == "rt-1"
    assert insert_params["status_id"] is None


# verifica que si el ticket ya existe, no se vuelve a crear
@patch("app.modules.interaction_logger.service.get_db")
def test_get_or_create_ticket_reusa_ticket_existente(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchone.return_value = MagicMock(id="ticket-existente")

    logger_service = InteractionLogger()
    analysis = _build_analysis()
    ticket_id = logger_service._get_or_create_ticket(mock_db, analysis)

    assert ticket_id == "ticket-existente"
    assert mock_db.execute.call_count == 1  

# verifica que _to_semantic_event_name saca el prefijo jira: de los eventos crudos
def test_to_semantic_event_name_saca_prefijo_jira():
    logger_service = InteractionLogger()

    assert logger_service._to_semantic_event_name("jira:issue_created") == "issue_created"
    assert logger_service._to_semantic_event_name("jira:issue_updated") == "issue_updated"


# verifica que un valor sin el prefijo jira: queda igual
def test_to_semantic_event_name_sin_prefijo_queda_igual():
    logger_service = InteractionLogger()

    assert logger_service._to_semantic_event_name("issue_created") == "issue_created"