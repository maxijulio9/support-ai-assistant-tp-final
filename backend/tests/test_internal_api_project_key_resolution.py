"""Tests unitarios para la resolucion del proyecto por project_key en ProjectConfigService.
Se mockea la sesion de base de datos, sin tocar la bd real."""

import pytest
from unittest.mock import patch, MagicMock
from app.modules.internal_api.services.project_config_service import ProjectConfigService
from app.modules.internal_api.schemas import ProjectThresholds, ProjectStatusMapping

MODULE = "app.modules.internal_api.services.project_config_service"


# arma una sesion simulada, project_row es lo que devuelve la consulta del proyecto por code
def _mock_db(project_row=None):
    mock_db = MagicMock()
    mock_db.execute.return_value.fetchone.return_value = project_row
    return mock_db


# verifica que con project_key resuelve el id del proyecto y lo usa en los umbrales y en cada mapeo
@patch(f"{MODULE}.get_db")
def test_save_config_resolves_project_key_to_id(mock_get_db):
    mock_db = _mock_db(MagicMock(id="uuid-1"))
    mock_get_db.return_value = iter([mock_db])

    result = ProjectConfigService().save_config(
        ProjectThresholds(), [ProjectStatusMapping(status_id="status-1")], "TARG"
    )

    calls = mock_db.execute.call_args_list
    assert result == 1
    assert calls[0][0][1] == {"code": "TARG"}
    assert calls[1][0][1]["project_id"] == "uuid-1"
    assert calls[2][0][1]["project_id"] == "uuid-1"
    mock_db.commit.assert_called_once()


# verifica que un project_key que no existe se rechaza, sin guardar nada
@patch(f"{MODULE}.get_db")
def test_save_config_rejects_unknown_project_key(mock_get_db):
    mock_db = _mock_db(None)
    mock_get_db.return_value = iter([mock_db])

    with pytest.raises(ValueError, match="no existe"):
        ProjectConfigService().save_config(ProjectThresholds(), [], "NOEXISTE")

    assert mock_db.execute.call_count == 1
    mock_db.rollback.assert_called_once()
    mock_db.commit.assert_not_called()


# verifica que sin project_key ni project_id se rechaza, sin tocar la base
@patch(f"{MODULE}.get_db")
def test_save_config_requires_project_key_or_project_id(mock_get_db):
    mock_db = _mock_db()
    mock_get_db.return_value = iter([mock_db])

    with pytest.raises(ValueError, match="project_key o project_id"):
        ProjectConfigService().save_config(ProjectThresholds(), [ProjectStatusMapping(status_id="status-1")])

    mock_db.execute.assert_not_called()


# verifica que si vienen project_key y un project_id de otro proyecto se rechaza
@patch(f"{MODULE}.get_db")
def test_save_config_rejects_project_id_that_does_not_match_project_key(mock_get_db):
    mock_db = _mock_db(MagicMock(id="uuid-1"))
    mock_get_db.return_value = iter([mock_db])

    with pytest.raises(ValueError, match="mismo proyecto"):
        ProjectConfigService().save_config(ProjectThresholds(project_id="uuid-2"), [], "TARG")

    mock_db.commit.assert_not_called()


# verifica que sin project_key se mantiene el comportamiento de antes, sin consulta previa del proyecto
@patch(f"{MODULE}.get_db")
def test_save_config_without_project_key_keeps_previous_behavior(mock_get_db):
    mock_db = _mock_db()
    mock_get_db.return_value = iter([mock_db])

    result = ProjectConfigService().save_config(
        ProjectThresholds(project_id="proj-1"),
        [ProjectStatusMapping(project_id="proj-1", status_id="status-1", system_action="21")],
    )

    calls = mock_db.execute.call_args_list
    assert result == 1
    assert len(calls) == 2
    assert "UPDATE project" in str(calls[0][0][0])
    assert calls[0][0][1]["project_id"] == "proj-1"
    assert calls[1][0][1]["project_id"] == "proj-1"


# verifica que un mapeo de otro proyecto se rechaza, sin guardar nada
@patch(f"{MODULE}.get_db")
def test_save_config_rejects_mapping_from_another_project(mock_get_db):
    mock_db = _mock_db()
    mock_get_db.return_value = iter([mock_db])

    with pytest.raises(ValueError, match="mismo proyecto"):
        ProjectConfigService().save_config(
            ProjectThresholds(project_id="proj-1"),
            [ProjectStatusMapping(project_id="proj-2", status_id="status-1")],
        )

    mock_db.commit.assert_not_called()
