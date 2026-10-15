# M7 InternalAPI
# convierte fechas del calendario y un huso horario en un intervalo UTC, para filtrar las metricas por dia

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires"


# devuelve el huso pedido, o el default si no se indico, lanza ValueError si el nombre no existe
def resolve_timezone(tz_name: str | None) -> ZoneInfo:
    name = tz_name or DEFAULT_TIMEZONE

    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError(f"huso horario invalido: '{name}'")


# lee una fecha en formato AAAA-MM-DD, lanza ValueError si el formato no es ese
def _parse_calendar_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValueError(f"fecha invalida: '{value}', se espera el formato AAAA-MM-DD")


# interpreta from_date y to_date como fechas del calendario en el huso indicado, ambas inclusivas
# devuelve el intervalo en UTC, con el inicio incluido y el fin excluido (la medianoche siguiente al to_date)
def resolve_period(from_date: str | None, to_date: str | None, tz: ZoneInfo) -> tuple[datetime | None, datetime | None]:
    start = None
    end = None

    if from_date:
        start = datetime.combine(_parse_calendar_date(from_date), time.min, tzinfo=tz).astimezone(timezone.utc)

    if to_date:
        next_day = _parse_calendar_date(to_date) + timedelta(days=1)
        end = datetime.combine(next_day, time.min, tzinfo=tz).astimezone(timezone.utc)

    if start and end and start >= end:
        raise ValueError("from_date no puede ser posterior a to_date")

    return start, end