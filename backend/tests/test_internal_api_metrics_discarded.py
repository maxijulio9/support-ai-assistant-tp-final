"""Tests unitarios para el conteo de interacciones descartadas en las metricas.
Se mockea la base de datos, sin tocar nada real."""

from datetime import date, datetime, timezone
from unittest.mock import patch, MagicMock
from zoneinfo import ZoneInfo
from app.main import app as main_app
from app.modules.internal_api.repositories.interaction_metrics_repository import InteractionMetricsRepository
from app.modules.internal_api.services.interaction_metrics_service import InteractionMetricsService

REPOSITORY_DB = "app.modules.internal_api.repositories.interaction_metrics_repository.get_db"
SEVEN_COUNTS = (
    "auto_publish_count", "needs_review_count", "escalate_count", "request_info_count",
    "resolved_count", "resolved_externally_count", "discarded_count",
)


# arma una fila simulada de interaccion
def _row(decision, channel=None, confidence=None, created_at=None):
    row = MagicMock()
    row.decision = decision
    row.resolution_channel = channel
    row.confidence_score = confidence
    row.created_at = created_at
    return row


# verifica que el resumen cuenta las descartadas y que los siete conteos suman el total
@patch(REPOSITORY_DB)
def test_summary_counts_discarded_and_the_seven_counts_add_up_to_the_total(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    mock_db.execute.return_value.fetchall.return_value = [
        _row("AUTO_PUBLISH", "AUTO", 0.95),
        _row("DISCARDED", "DISCARDED_BY_HUMAN"),
        _row("DISCARDED", "DISCARDED_BY_HUMAN"),
        _row("NEEDS_REVIEW"),
        _row("ESCALATE"),
        _row("REQUEST_INFO"),
        _row("RESOLVED", "AUTO"),
        _row("RESOLVED_EXTERNALLY", "RESOLVED_EXTERNALLY"),
        _row(None),
    ]

    result = InteractionMetricsRepository().get_summary()

    assert result["discarded_count"] == 2
    assert result["total_interactions"] == 8
    assert sum(result[name] for name in SEVEN_COUNTS) == result["total_interactions"]
    assert result["without_decision_count"] == 1
    channels = {item["resolution_channel"]: item["count"] for item in result["by_resolution_channel"]}
    assert channels["DISCARDED_BY_HUMAN"] == 2


# verifica que la serie diaria cuenta las descartadas de cada dia
@patch(REPOSITORY_DB)
def test_daily_counts_discarded_per_day(mock_get_db):
    mock_db = MagicMock()
    mock_get_db.return_value = iter([mock_db])
    moment = datetime(2026, 10, 20, 15, 0, tzinfo=timezone.utc)
    mock_db.execute.return_value.fetchall.return_value = [
        _row("DISCARDED", created_at=moment),
        _row("AUTO_PUBLISH", created_at=moment),
        _row("DISCARDED", created_at=moment),
    ]

    result = InteractionMetricsRepository().get_daily(ZoneInfo("America/Argentina/Buenos_Aires"))

    assert len(result) == 1
    assert result[0]["total_interactions"] == 3
    assert result[0]["discarded_count"] == 2


# verifica que el servicio completa los dias sin interacciones con discarded_count en cero
def test_service_fills_empty_days_with_a_zero_discarded_count():
    service = InteractionMetricsService.__new__(InteractionMetricsService)
    service.metrics_repository = MagicMock()
    service.metrics_repository.get_daily.return_value = [{
        "date": date(2026, 10, 1), "total_interactions": 1, "auto_publish_count": 0, "needs_review_count": 0,
        "escalate_count": 0, "request_info_count": 0, "resolved_count": 0, "resolved_externally_count": 0,
        "discarded_count": 1, "avg_confidence_score": None,
    }]

    result = service.get_daily(from_date="2026-10-01", to_date="2026-10-03", tz="America/Argentina/Buenos_Aires")

    assert [day["discarded_count"] for day in result["days"]] == [1, 0, 0]


# verifica que en el contrato discarded_count es un entero obligatorio en el resumen y en la serie diaria
def test_discarded_count_is_a_required_integer_in_the_contract():
    schemas = main_app.openapi()["components"]["schemas"]

    for name in ("MetricsSummaryResponse", "DailyMetric"):
        assert schemas[name]["properties"]["discarded_count"]["type"] == "integer"
        assert "discarded_count" in schemas[name]["required"]
