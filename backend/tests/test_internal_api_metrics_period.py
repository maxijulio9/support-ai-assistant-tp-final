"""Tests unitarios para el calculo del intervalo de fechas de las metricas.
Son funciones puras, no necesitan mocks."""

import pytest
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from app.modules.internal_api.metrics_period import resolve_timezone, resolve_period, DEFAULT_TIMEZONE

BUENOS_AIRES = ZoneInfo("America/Argentina/Buenos_Aires")


# verifica que sin huso usa el default
def test_resolve_timezone_uses_default_when_not_provided():
    assert resolve_timezone(None).key == DEFAULT_TIMEZONE


# verifica que acepta un huso valido
def test_resolve_timezone_accepts_valid_name():
    assert resolve_timezone("America/New_York").key == "America/New_York"


# verifica que un huso inexistente lanza ValueError
def test_resolve_timezone_rejects_unknown_name():
    with pytest.raises(ValueError):
        resolve_timezone("Marte/Olympus")


# verifica que el intervalo se arma con la medianoche local convertida a UTC
def test_resolve_period_converts_local_midnight_to_utc():
    start, end = resolve_period("2026-09-14", "2026-10-14", BUENOS_AIRES)

    assert start == datetime(2026, 9, 14, 3, 0, tzinfo=timezone.utc)
    assert end == datetime(2026, 10, 15, 3, 0, tzinfo=timezone.utc)


# verifica que el to_date incluye el dia completo, el fin es la medianoche siguiente
def test_resolve_period_includes_the_whole_last_day():
    start, end = resolve_period("2026-10-14", "2026-10-14", BUENOS_AIRES)

    assert (end - start).total_seconds() == 24 * 3600


# verifica que sin fechas no hay limites
def test_resolve_period_without_dates_has_no_limits():
    assert resolve_period(None, None, BUENOS_AIRES) == (None, None)


# verifica que puede venir solo una de las dos fechas
def test_resolve_period_accepts_only_one_date():
    start, end = resolve_period("2026-09-14", None, BUENOS_AIRES)
    assert start is not None and end is None

    start, end = resolve_period(None, "2026-09-14", BUENOS_AIRES)
    assert start is None and end is not None


# verifica que un formato de fecha invalido lanza ValueError
def test_resolve_period_rejects_invalid_date_format():
    with pytest.raises(ValueError):
        resolve_period("14/09/2026", None, BUENOS_AIRES)


# verifica que un rango invertido lanza ValueError
def test_resolve_period_rejects_inverted_range():
    with pytest.raises(ValueError):
        resolve_period("2026-10-14", "2026-09-14", BUENOS_AIRES)


# verifica que respeta el cambio de hora de un huso con horario de verano, ese dia dura 23 horas
def test_resolve_period_handles_daylight_saving_day():
    start, end = resolve_period("2026-03-08", "2026-03-08", ZoneInfo("America/New_York"))

    assert (end - start).total_seconds() == 23 * 3600