# M7 InternalAPI
# arma los tiempos de respuesta por cohorte, para comparar al sistema contra los tickets anteriores a su puesta en marcha

from datetime import timedelta
from uuid import UUID
from app.modules.internal_api.metrics_period import resolve_timezone, resolve_period
from app.modules.internal_api.repositories.response_times_repository import ResponseTimesRepository

# cantidad minima de tickets para informar promedio y percentiles de una cohorte, una categoria o un desenlace
# las series diarias y semanales no la aplican, el frontend marca los dias con pocos tickets
MIN_SAMPLE = 5

# canales en los que una persona resolvio la interaccion que el sistema dejo en revision
HUMAN_CHANNELS = {
    "REVIEWED_APPROVED", "REVIEWED_EDITED", "REVIEWED_REGENERATED",
    "ESCALATED_BY_HUMAN", "DISCARDED_BY_HUMAN", "RESOLVED_EXTERNALLY",
}

# nombre de la cohorte, que es la primera respuesta del ticket y como se mide el cierre
COHORTS = [
    ("automatic", "answer", "detected_confirmation"),
    ("reviewed", "answer", "detected_confirmation"),
    ("escalated", "acknowledgment", "detected_confirmation"),
    ("info_requested", "information_request", "detected_confirmation"),
    ("baseline", "answer", "last_customer_comment"),
]


class ResponseTimesService:

    def __init__(self):
        self.repository = ResponseTimesRepository()

    # arma las cinco cohortes con sus tiempos de primera respuesta y de cierre
    # from_date y to_date son dias del calendario en el huso pedido y filtran por la creacion del ticket en jsm, la linea base no se filtra por fechas
    # lanza ValueError si el project_id, el huso o las fechas no son validos
    def get_response_times(self, project_id: str | None = None, from_date: str | None = None, to_date: str | None = None,
                           category: str | None = None, tz: str | None = None) -> dict:
        if project_id:
            try:
                UUID(project_id)
            except ValueError:
                raise ValueError(f"project_id invalido: '{project_id}', se espera un uuid")

        zone = resolve_timezone(tz)
        start, end = resolve_period(from_date, to_date, zone)

        target = self.repository.get_first_response_target(project_id) if project_id else None
        tickets_by_cohort = {name: [] for name, _, _ in COHORTS}

        for row in self.repository.list_system_tickets(project_id, start, end, category):
            cohort = self._cohort_of(row)
            if cohort is not None:
                tickets_by_cohort[cohort].append({
                    "created": row["jira_created_at"],
                    "category": row["category"],
                    "channel": row["resolution_channel"],
                    "first_response": self._seconds(row["jira_created_at"], row["first_response_at"]),
                    "closure": self._seconds(row["jira_created_at"], row["closure_at"]),
                })

        for row in self.repository.list_baseline_tickets(project_id, category):
            tickets_by_cohort["baseline"].append({
                "created": row["jira_created_at"],
                "category": row["category"],
                "channel": None,
                "first_response": self._seconds(row["jira_created_at"], row["first_response_at"]),
                "closure": self._seconds(row["jira_created_at"], row["last_customer_comment_at"]),
            })

        return {
            "timezone": zone.key,
            "min_sample": MIN_SAMPLE,
            "first_response_target_seconds": target,
            "cohorts": [
                self._build_cohort(name, kind, basis, tickets_by_cohort[name], zone, target)
                for name, kind, basis in COHORTS
            ],
        }

    # la cohorte sale de lo que decidio el sistema en la primera interaccion, una revision humana no la cambia
    # las filas viejas sin system_decision usan decision, y los canales de revision humana siempre son reviewed
    # devuelve none si la interaccion no tiene una decision que clasificar
    def _cohort_of(self, row: dict) -> str | None:
        original = row["system_decision"] or row["decision"]

        if original == "NEEDS_REVIEW" or row["decision"] == "NEEDS_REVIEW" or row["resolution_channel"] in HUMAN_CHANNELS:
            return "reviewed"
        if original == "AUTO_PUBLISH":
            return "automatic"
        if original == "ESCALATE":
            return "escalated"
        if original == "REQUEST_INFO":
            return "info_requested"

        return None

    # segundos entre dos momentos, none si falta alguno
    # se descartan los tiempos negativos, que indicarian un reloj desalinaedo entre jsm y la base
    def _seconds(self, start, end) -> float | None:
        if start is None or end is None:
            return None

        seconds = (end - start).total_seconds()
        return seconds if seconds >= 0 else None

    # arma una cohorte completa con sus estadisticas, desenlaces, categorias y series
    def _build_cohort(self, name: str, kind: str, basis: str, tickets: list[dict], zone, target: int | None) -> dict:
        first_values = [t["first_response"] for t in tickets if t["first_response"] is not None]
        closure_values = [t["closure"] for t in tickets if t["closure"] is not None]
        is_baseline = name == "baseline"

        return {
            "cohort": name,
            "first_response_kind": kind,
            "closure_basis": basis,
            "tickets": len(tickets),
            "first_response": self._stats(first_values, target, True),
            "closure": self._stats(closure_values, None, True),
            "outcomes": self._outcomes(tickets, target) if name == "reviewed" else [],
            "by_category": self._by_category(tickets, target),
            "daily": [] if is_baseline else self._series(tickets, zone, target, "day"),
            "weekly": [] if is_baseline else self._series(tickets, zone, target, "week"),
        }

    # promedio y percentiles de una lista de segundos, con el minimo de tickets si se pide
    # within_target_rate solo se calcula si hay objetivo, y se usa solo para la primera respuesta
    def _stats(self, values: list[float], target: int | None, apply_minimum: bool) -> dict:
        count = len(values)
        stats = {"count": count, "mean_seconds": None, "p50_seconds": None, "p90_seconds": None, "within_target_rate": None}

        if count == 0 or (apply_minimum and count < MIN_SAMPLE):
            return stats

        ordered = sorted(values)
        stats["mean_seconds"] = round(sum(ordered) / count, 1)
        stats["p50_seconds"] = round(self._percentile(ordered, 50), 1)
        stats["p90_seconds"] = round(self._percentile(ordered, 90), 1)

        if target is not None:
            stats["within_target_rate"] = round(sum(1 for value in ordered if value <= target) / count, 4)

        return stats

    # percentil con interpolacion lineal entre los dos valores vecinos, sobre una lista ya ordenada
    def _percentile(self, ordered: list[float], percent: int) -> float:
        if len(ordered) == 1:
            return ordered[0]

        rank = (len(ordered) - 1) * percent / 100
        low = int(rank)
        high = min(low + 1, len(ordered) - 1)
        return ordered[low] + (ordered[high] - ordered[low]) * (rank - low)

    # desglose de la cohorte reviewed por la forma en que una persona la resolvio, el canal null son las pendientes
    def _outcomes(self, tickets: list[dict], target: int | None) -> list[dict]:
        groups = {}
        for ticket in tickets:
            groups.setdefault(ticket["channel"], []).append(ticket)

        result = []
        for channel, group in groups.items():
            values = [t["first_response"] for t in group if t["first_response"] is not None]
            result.append({
                "resolution_channel": channel,
                "tickets": len(group),
                "first_response": self._stats(values, target, True),
            })

        result.sort(key=lambda r: (-r["tickets"], r["resolution_channel"] is None, r["resolution_channel"] or ""))
        return result

    # desglose por categoria, los tickets sin categoria cuentan en la cohorte pero no aparecen aca
    def _by_category(self, tickets: list[dict], target: int | None) -> list[dict]:
        groups = {}
        for ticket in tickets:
            if ticket["category"] is not None:
                groups.setdefault(ticket["category"], []).append(ticket)

        result = []
        for category, group in groups.items():
            first_values = [t["first_response"] for t in group if t["first_response"] is not None]
            closure_values = [t["closure"] for t in group if t["closure"] is not None]
            result.append({
                "category": category,
                "tickets": len(group),
                "first_response": self._stats(first_values, target, True),
                "closure": self._stats(closure_values, None, True),
            })

        result.sort(key=lambda r: (-r["tickets"], r["category"]))
        return result

    # serie por dia o por semana de creacion en el huso pedido, sin minimo de tickets
    # la semana empieza el lunes, y solo salen los periodos con al menos un ticket con primera respuesta
    def _series(self, tickets: list[dict], zone, target: int | None, period: str) -> list[dict]:
        groups = {}
        for ticket in tickets:
            if ticket["first_response"] is None or ticket["created"] is None:
                continue

            day = ticket["created"].astimezone(zone).date()
            key = day - timedelta(days=day.weekday()) if period == "week" else day
            groups.setdefault(key, []).append(ticket["first_response"])

        field = "week_start" if period == "week" else "date"
        return [
            {field: key.isoformat(), "first_response": self._stats(values, target, False)}
            for key, values in sorted(groups.items())
        ]
