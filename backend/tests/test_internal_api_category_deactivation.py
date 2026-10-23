"""Tests unitarios para desactivar y reactivar las categorias de un proyecto.
Se mockean la base de datos y los servicios, sin tocar nada real."""

from types import SimpleNamespace
from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from app.main import app as main_app
from app.modules.auth.dependencies import require_admin
from app.modules.internal_api.router import router
from app.modules.internal_api.repositories.category_configuration_repository import CategoryConfigurationRepository
from app.modules.internal_api.services.itsm_project_onboarding_service import ItsmProjectOnboardingService

REPOSITORY_DB = "app.modules.internal_api.repositories.category_configuration_repository.get_db"
ROUTER_SERVICE = "app.modules.internal_api.router._project_onboarding_service"
CATALOG = {"Acceso": "cat-a", "Pagos": "cat-b", "Cuenta": "cat-c"}

app = FastAPI()
app.include_router(router)
client = TestClient(app)


# arma una base simulada, reconoce cada consulta por su texto y deja registradas las que se ejecutaron
def _fake_db(currently_active, project_exists=True):
    executed = []

    def execute(sql, params=None):
        statement = str(sql)
        executed.append((statement, params))
        result = MagicMock()
        if "SELECT id FROM project WHERE code" in statement:
            result.fetchone.return_value = SimpleNamespace(id="proj-1") if project_exists else None
        elif "SELECT id FROM ticket_category WHERE name" in statement:
            result.fetchone.return_value = SimpleNamespace(id=CATALOG[params["name"]])
        elif "SELECT category_id FROM project_category" in statement:
            result.fetchall.return_value = [SimpleNamespace(category_id=category_id) for category_id in currently_active]
        return result

    db = MagicMock()
    db.execute.side_effect = execute
    return db, executed


# arma el servicio sin construir sus clientes, con el repositorio de categorias simulado
def _service():
    service = ItsmProjectOnboardingService.__new__(ItsmProjectOnboardingService)
    service.category_configuration_repository = MagicMock()
    return service


# hace que el endpoint vea a un admin autenticado
def _as_admin():
    app.dependency_overrides[require_admin] = lambda: MagicMock(id="admin-1", role="admin")


# verfica que las categorias de la lista quedan activas y las que no vienen se desactivan, sin borrar nada
@patch(REPOSITORY_DB)
def test_listed_categories_stay_active_and_the_missing_ones_are_deactivated(mock_get_db):
    db, executed = _fake_db(["cat-a", "cat-b", "cat-c"])
    mock_get_db.return_value = iter([db])

    result = CategoryConfigurationRepository().configure_categories("TARG", ["Acceso", "Pagos"])

    updates = [params for statement, params in executed if "UPDATE project_category SET is_active = FALSE" in statement]
    assert result == {"categories_configured": 2, "categories_deactivated": 1}
    assert updates == [{"project_id": "proj-1", "category_id": "cat-c"}]
    assert not [statement for statement, _ in executed if "DELETE" in statement]
    db.commit.assert_called_once()


# verifica que vincular una categoria ya vinculada la reactiva, en lugar de ignorar el conflicto
@patch(REPOSITORY_DB)
def test_linking_a_category_reactivates_it_instead_of_ignoring_the_conflict(mock_get_db):
    db, executed = _fake_db(["cat-a"])
    mock_get_db.return_value = iter([db])

    CategoryConfigurationRepository().configure_categories("TARG", ["Acceso"])

    link = [statement for statement, _ in executed if "INSERT INTO project_category" in statement][0]
    assert "DO UPDATE SET is_active = TRUE" in link
    assert "DO NOTHING" not in link


# verifica que si la lista coincide con las activas no se desactiva ninguna
@patch(REPOSITORY_DB)
def test_a_list_that_matches_the_active_set_deactivates_nothing(mock_get_db):
    db, executed = _fake_db(["cat-a", "cat-b"])
    mock_get_db.return_value = iter([db])

    result = CategoryConfigurationRepository().configure_categories("TARG", ["Pagos", "Acceso"])

    assert result == {"categories_configured": 2, "categories_deactivated": 0}
    assert not [statement for statement, _ in executed if "UPDATE project_category" in statement]


# verifica que un proyecto que no existe se rechaza y no se confirma nada
@patch(REPOSITORY_DB)
def test_an_unknown_project_is_rejected_without_committing(mock_get_db):
    db, executed = _fake_db([], project_exists=False)
    mock_get_db.return_value = iter([db])

    with pytest.raises(ValueError, match="no existe"):
        CategoryConfigurationRepository().configure_categories("NOEXISTE", ["Acceso"])

    db.rollback.assert_called_once()
    db.commit.assert_not_called()


# verifica que un error de la base deshace la transaccion y se relanza
@patch(REPOSITORY_DB)
def test_a_database_error_rolls_back_and_is_raised_again(mock_get_db):
    db = MagicMock()
    db.execute.side_effect = Exception("falla de bd")
    mock_get_db.return_value = iter([db])

    with pytest.raises(Exception, match="falla de bd"):
        CategoryConfigurationRepository().configure_categories("TARG", ["Acceso"])

    db.rollback.assert_called_once()
    db.commit.assert_not_called()


# verifica que el servicio rechaza una lista vacia antes de llegar al repositorio
def test_service_rejects_an_empty_list():
    service = _service()

    with pytest.raises(ValueError, match="al menos una categoría"):
        service.configure_categories("TARG", [])

    service.category_configuration_repository.configure_categories.assert_not_called()


# verifica que el servicio rechaza los nombres en blanco antes de llegar al repositorio
def test_service_rejects_blank_names():
    service = _service()

    with pytest.raises(ValueError, match="vacías"):
        service.configure_categories("TARG", ["Acceso", "   "])

    service.category_configuration_repository.configure_categories.assert_not_called()


# verifica que el servicio descarta los repetidos conservando el orden
def test_service_removes_duplicates_keeping_the_order():
    service = _service()
    service.category_configuration_repository.configure_categories.return_value = {"categories_configured": 2, "categories_deactivated": 0}

    service.configure_categories("TARG", ["Pagos", "Acceso", "Pagos"])

    service.category_configuration_repository.configure_categories.assert_called_once_with("TARG", ["Pagos", "Acceso"])


# verifica que el endpoint devuelve las dos cantidades
@patch(ROUTER_SERVICE)
def test_endpoint_returns_both_counts(mock_service):
    mock_service.configure_categories.return_value = {"categories_configured": 2, "categories_deactivated": 1}
    _as_admin()

    response = client.post("/api/config/itsm/projects/TARG/categories", json={"categories": ["Acceso", "Pagos"]})

    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "categories_configured": 2, "categories_deactivated": 1}
    mock_service.configure_categories.assert_called_once_with("TARG", ["Acceso", "Pagos"])


# verifica que una lista vacia se traduce en HTTP 400 con el mensaje en texto legible
@patch(ROUTER_SERVICE)
def test_endpoint_empty_list_returns_400_with_a_readable_detail(mock_service):
    mock_service.configure_categories.side_effect = ValueError("Hay que indicar al menos una categoría")
    _as_admin()

    response = client.post("/api/config/itsm/projects/TARG/categories", json={"categories": []})

    app.dependency_overrides.clear()

    assert response.status_code == 400
    assert response.json()["detail"] == "Hay que indicar al menos una categoría"


# verifica en el contrato que categories_deactivated es un entero obligatorio y que el 400 esta declarado
def test_contract_declares_the_new_field_and_the_400():
    spec = main_app.openapi()
    schema = spec["components"]["schemas"]["ConfigureCategoriesResponse"]
    post = spec["paths"]["/api/config/itsm/projects/{project_key}/categories"]["post"]

    assert schema["properties"]["categories_deactivated"]["type"] == "integer"
    assert "categories_deactivated" in schema["required"]
    assert "400" in post["responses"]
