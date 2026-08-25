"""Tests unitarios para Modulo 7 InternalAPI
Se mockea la sesion de base de datos para verificar que el service arma
las queries correctas, sin tocar la bd real."""

from unittest.mock import patch, MagicMock
import pytest
from app.modules.internal_api.service import ProjectConfigService
from app.modules.internal_api.schemas import ProjectThresholds, ProjectStatusMapping


def _build_thresholds(**overrides):
    defaults = {
        "project_id": "proj-1",
        "threshold_auto_publish": 0.85,
        "threshold_needs_review": 0.60,
        "similarity_threshold": 0.40,
    }
    defaults.update(overrides)
    return ProjectThresholds(**defaults)


def _build_mapping(**overrides):
    defaults = {
        "project_id": "proj-1",
        "status_id": "status-1",
        "system_action": "21",
        "is_active": True,
    }
    defaults.update(overrides)
    return ProjectStatusMapping(**defaults)


# verifica que save_config actualiza umbrales e inserta los mapeos, y confirma con commit
@patch("app.modules.internal_api.service.get_db")
def test_save_config_success(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])

    service = ProjectConfigService()
    thresholds = _build_thresholds()
    mappings = [_build_mapping()]

    result = service.save_config(thresholds, mappings)

    assert result == 1
    assert mock_db.execute.call_count == 2  # 1 update de thresholds + 1 insert de mapping
    mock_db.commit.assert_called_once()
    mock_db.close.assert_called_once()


# verifica que si falta status_id en un mapeo, se levanta ValueError antes de tocar la bd
@patch("app.modules.internal_api.service.get_db")
def test_save_config_rejects_incomplete_mapping(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])

    service = ProjectConfigService()
    thresholds = _build_thresholds()
    mappings = [_build_mapping(status_id="")]

    with pytest.raises(ValueError):
        service.save_config(thresholds, mappings)

    mock_db.execute.assert_not_called()


# verifica que si la bd falla al ejecutar, se hace rollback y se relanza la excepcion
@patch("app.modules.internal_api.service.get_db")
def test_save_config_rolls_back_on_db_error(mock_get_db):
    mock_db = MagicMock()
    mock_db.execute.side_effect = Exception("fallo de conexion")
    mock_get_db.return_value = iter([mock_db])

    service = ProjectConfigService()
    thresholds = _build_thresholds()
    mappings = [_build_mapping()]

    with pytest.raises(Exception):
        service.save_config(thresholds, mappings)

    mock_db.rollback.assert_called_once()
    mock_db.close.assert_called_once()