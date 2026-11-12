# utilidad de evaluacion, prueba de carga del pipeline de procesamiento
# crea tickets nuevos en jsm a un ritmo creciente, a partir de tickets historicos resueltos por personas, y mide como responde el sistema
# despues manda un cierre simulado del cliente a los tickets que el sistema respondio solo, para medir tambien el procesamiento de comentarios
# los tiempos salen de lo que el sistema ya guarda en la base, no se agrega nada al pipeline
# los cierres se mandan directo al webhook con el secreto, no quedan como comentarios en jsm
# sin --confirm solo muestra el plan y no crea nada, se corre dentro del contenedor del backend
#   python -m app.tools.load_test --projects TARG,TBRA --customer-account-id ID --schedule 2:5,4:5,6:5,10:5 --seed 11 --confirm

import argparse
import random
import time
from collections import Counter
from datetime import datetime, timezone

import httpx

from app.modules.internal_api.repositories.jsm_credentials_repository import JsmCredentialsRepository
from app.tools.replay_tickets import (
    CLOSING_REPLIES,
    check_mapping,
    create_request,
    jsm_request,
    load_original,
    pick_cases,
    project_language,
    query,
    send_closure,
    wait_for_processing,
)

SAMPLE_SECONDS = 15
DEFAULT_SCHEDULE = "2:5,4:5,6:5,10:5"
MAX_TICKETS = 250
# decisiones que tienen que dejar un comentario publico, si no lo dejaron es una falla al publicar
EXPECT_RESPONSE = {"AUTO_PUBLISH", "REQUEST_INFO", "ESCALATE"}


# lee los tramos ritmo:minutos, el ritmo es de tickets por minuto
def parse_schedule(value: str) -> list[tuple[int, int]]:
    steps = []
    for part in value.split(","):
        rate, _, minutes = part.partition(":")
        if not rate.strip().isdigit() or not minutes.strip().isdigit() or int(rate) < 1 or int(minutes) < 1:
            raise SystemExit(f"el tramo '{part}' no es valido, se espera ritmo:minutos, por ejemplo 2:5")
        steps.append((int(rate), int(minutes)))
    return steps


# calcula en que segundo sale cada ticket y de que proyecto, repartiendo los proyectos por turnos
def build_plan(schedule: list[tuple[int, int]], codes: list[str]) -> list[tuple[float, int, str]]:
    slots = []
    offset = 0.0
    for rate, minutes in schedule:
        for i in range(rate * minutes):
            slots.append((offset + i * 60.0 / rate, rate))
        offset += minutes * 60
    return [(at, rate, codes[index % len(codes)]) for index, (at, rate) in enumerate(slots)]


# percentil con interpolacion lineal sobre una lista ya ordenada
def percentile(ordered: list[float], percent: int) -> float:
    if len(ordered) == 1:
        return ordered[0]
    rank = (len(ordered) - 1) * percent / 100
    low = int(rank)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (rank - low)


def stats_text(values: list[float]) -> str:
    if not values:
        return "sin datos"
    ordered = sorted(values)
    return f"promedio {sum(ordered) / len(ordered):.1f} s, p50 {percentile(ordered, 50):.1f} s, p90 {percentile(ordered, 90):.1f} s, p95 {percentile(ordered, 95):.1f} s, maximo {ordered[-1]:.1f} s"


# tickets que el sistema ya proceso, o sea que tienen una interaccion con decision
def processed_keys(keys) -> set:
    rows = query("""
        SELECT DISTINCT t.issue_key
        FROM ticket t JOIN interaction i ON i.ticket_id = t.id
        WHERE t.issue_key = ANY(:keys) AND i.decision IS NOT NULL
    """, keys=list(keys))
    return {row.issue_key for row in rows}


# lo que el sistema guardo de cada ticket, la decision de la primera interaccion y la primera respuesta
def ticket_rows(keys) -> dict:
    rows = query("""
        SELECT t.issue_key, t.jira_created_at, fi.decision, fi.processing_time_ms, fr.first_response_at
        FROM ticket t
        LEFT JOIN LATERAL (
            SELECT decision, processing_time_ms FROM interaction
            WHERE ticket_id = t.id AND decision IS NOT NULL ORDER BY created_at LIMIT 1
        ) fi ON TRUE
        LEFT JOIN LATERAL (
            SELECT MIN(first_response_at) AS first_response_at FROM interaction WHERE ticket_id = t.id
        ) fr ON TRUE
        WHERE t.issue_key = ANY(:keys)
    """, keys=list(keys))
    return {row.issue_key: row for row in rows}


# momento en que el sistema registro el cierre del cliente en cada ticket
def resolved_times(keys) -> dict:
    rows = query("""
        SELECT t.issue_key, MIN(i.created_at) AS at
        FROM interaction i JOIN ticket t ON t.id = i.ticket_id
        WHERE t.issue_key = ANY(:keys) AND i.decision = 'RESOLVED'
        GROUP BY t.issue_key
    """, keys=list(keys))
    return {row.issue_key: row.at for row in rows}


# segundos entre la creacion del ticket en jsm y la primera respuesta, none si falta alguna de las dos horas
def latency(row) -> float | None:
    if row is None or row.jira_created_at is None or row.first_response_at is None:
        return None
    seconds = (row.first_response_at - row.jira_created_at).total_seconds()
    return seconds if seconds >= 0 else None


# resumen de un grupo de tickets, con lo procesado, las fallas y la latencia de la primera respuesta
def summarize(label: str, items: list[dict], rows: dict, target: int):
    processed = [i for i in items if rows.get(i["key"]) is not None and rows[i["key"]].decision is not None]
    values = [v for v in (latency(rows.get(i["key"])) for i in items) if v is not None]
    missing = sum(1 for i in processed if rows[i["key"]].decision in EXPECT_RESPONSE and rows[i["key"]].first_response_at is None)
    within = f", dentro de {target} s {sum(1 for v in values if v <= target) / len(values):.0%}" if values else ""
    print(f"{label}: creados {len(items)} | procesados {len(processed)} | sin procesar {len(items) - len(processed)} | sin primera respuesta esperada {missing}")
    print(f"   primera respuesta: {stats_text(values)}{within}")
    print(f"   decisiones: {dict(Counter(rows[i['key']].decision for i in processed))}")


def main():
    parser = argparse.ArgumentParser(description="prueba de carga del pipeline, crea tickets a un ritmo creciente y mide como responde el sistema")
    parser.add_argument("--projects", required=True, help="claves de los proyectos separadas por coma, los tickets se reparten por turnos")
    parser.add_argument("--customer-account-id", required=True, help="accountId del cliente de prueba a cuyo nombre se crean los tickets")
    parser.add_argument("--schedule", default=DEFAULT_SCHEDULE, help="tramos ritmo:minutos separados por coma, el ritmo es de tickets por minuto")
    parser.add_argument("--seed", type=int, default=1, help="semilla para repetir la misma seleccion de tickets historicos")
    parser.add_argument("--target-seconds", type=int, default=30, help="objetivo de primera respuesta para calcular el porcentaje que lo cumple")
    parser.add_argument("--max-backlog", type=int, default=80, help="si hay mas tickets sin procesar que este numero se deja de crear")
    parser.add_argument("--max-wait-minutes", type=int, default=30, help="minutos de espera para que el sistema vacie la cola despues del ultimo ticket")
    parser.add_argument("--max-comments", type=int, default=40, help="cantidad maxima de cierres simulados, 0 los desactiva")
    parser.add_argument("--comment-gap-seconds", type=float, default=1.0, help="espera entre un cierre simulado y el siguiente")
    parser.add_argument("--comment-wait-seconds", type=int, default=300, help="segundos de espera para que el sistema procese los cierres")
    parser.add_argument("--canary-timeout", type=int, default=90, help="segundos que se espera al primer ticket antes de abortar")
    parser.add_argument("--request-type-field", default="customfield_10010")
    parser.add_argument("--backend-url", default="http://localhost:8000")
    parser.add_argument("--confirm", action="store_true", help="corre la prueba, sin esto solo muestra el plan")
    args = parser.parse_args()

    schedule = parse_schedule(args.schedule)
    codes = [code.strip() for code in args.projects.split(",") if code.strip()]
    plan = build_plan(schedule, codes)

    if len(plan) > MAX_TICKETS:
        raise SystemExit(f"el plan crea {len(plan)} tickets y el maximo es {MAX_TICKETS}")

    repository = JsmCredentialsRepository()
    credentials = repository.get_credentials()
    secret = repository.get_webhook_secret()
    if credentials is None or not secret:
        raise SystemExit("faltan las credenciales de jsm o el secreto del webhook")

    try:
        httpx.get(f"{args.backend_url}/health", timeout=10).raise_for_status()
    except Exception as error:
        raise SystemExit(f"el backend no responde en {args.backend_url}: {error}")

    base = credentials["base_url"].rstrip("/")
    rng = random.Random(args.seed)
    languages, mapped = {}, {}

    with httpx.Client(auth=(credentials["user_email"], credentials["api_token"]), timeout=30, headers={"Accept": "application/json"}) as client:
        desks = {d["projectKey"]: d["id"] for d in jsm_request(client, "GET", f"{base}/rest/servicedeskapi/servicedesk", params={"limit": 50})["values"]}

        for code in codes:
            language = project_language(code)
            project_mapped, missing = check_mapping(code)
            if language is None or code not in desks:
                raise SystemExit(f"{code}: no esta dado de alta en la base o no tiene service desk")
            if missing:
                raise SystemExit(f"{code}: faltan los estados de {missing} en la configuracion del proyecto")
            languages[code] = language
            mapped[code] = project_mapped

        per_project = Counter(code for _, _, code in plan)
        print("tramos, tickets por minuto y minutos:", schedule)
        print(f"tickets a crear: {len(plan)} {dict(per_project)} | duracion de la creacion: {sum(m for _, m in schedule)} minutos | llamados al modelo estimados: unos {len(plan) * 5}")
        print(f"corte si hay mas de {args.max_backlog} tickets sin procesar | cierres simulados: hasta {args.max_comments}")

        if not args.confirm:
            print("solo plan, no se creo nada, agrega --confirm para correr la prueba")
            return

        cases = {}
        for code in codes:
            needed = per_project[code]
            loaded = []
            for case in pick_cases(code, needed * 2, rng):
                original = load_original(client, base, case["original"], args.request_type_field)
                if original["request_type_id"] is None:
                    continue
                loaded.append({**case, **original})
                if len(loaded) == needed:
                    break
            if len(loaded) < needed:
                raise SystemExit(f"{code}: hay {len(loaded)} tickets historicos utilizables y hacen falta {needed}")
            cases[code] = loaded
            print(f"{code}: {needed} tickets historicos leidos de jsm")

        created, timeline = [], []
        started = time.monotonic()
        last_sample = started
        backlog = 0
        stopped = False

        def sample() -> int:
            done = processed_keys(item["key"] for item in created) if created else set()
            timeline.append((round(time.monotonic() - started), len(created), len(done)))
            return len(created) - len(done)

        for index, (at, rate, code) in enumerate(plan):
            while True:
                remaining = started + at - time.monotonic()
                if remaining <= 0:
                    break
                time.sleep(min(remaining, 1.0))
                if time.monotonic() - last_sample >= SAMPLE_SECONDS:
                    backlog = sample()
                    last_sample = time.monotonic()

            if backlog > args.max_backlog:
                stopped = True
                print(f"se deja de crear tickets, hay {backlog} sin procesar y el maximo es {args.max_backlog}")
                break

            case = cases[code].pop()
            key, issue_id = create_request(client, base, desks[code], case, args.customer_account_id)
            created.append({"key": key, "issue_id": issue_id, "project": code, "rate": rate, "language": languages[code], "original": case["original"]})
            print(f"{round(time.monotonic() - started):5d} s | creado {key} | {rate} por minuto | sin procesar {backlog}")

            if index == 0:
                print(f"espero hasta {args.canary_timeout} s a que el sistema procese el primer ticket")
                if wait_for_processing(key, args.canary_timeout) is None:
                    raise SystemExit(f"el sistema no proceso {key}, revisa el secreto del webhook en jira y los registros del backend, no se crearon mas tickets")
                started = time.monotonic()
                last_sample = started
                print("el sistema lo proceso, empieza la prueba")

        creation_end = round(time.monotonic() - started)
        print(f"creacion terminada a los {creation_end} s, espero hasta {args.max_wait_minutes} minutos a que el sistema procese lo pendiente")
        deadline = time.monotonic() + args.max_wait_minutes * 60
        while time.monotonic() < deadline:
            if sample() == 0:
                break
            time.sleep(SAMPLE_SECONDS)
        final_backlog = sample()

        keys = [item["key"] for item in created]
        rows = ticket_rows(keys)

        comments = []
        auto = [i for i in created if rows.get(i["key"]) is not None and rows[i["key"]].decision == "AUTO_PUBLISH"][:args.max_comments]
        for item in auto:
            reply = rng.choice(CLOSING_REPLIES.get(item["language"], CLOSING_REPLIES["es"]))
            sent_at = datetime.now(timezone.utc)
            result = send_closure(client, base, args.backend_url, secret, {**item, "mapped": mapped[item["project"]]}, reply)
            comments.append({"key": item["key"], "sent_at": sent_at, "result": result})
            time.sleep(args.comment_gap_seconds)

        sent = [c for c in comments if c["result"].startswith("enviado")]
        if sent:
            print(f"cierres enviados: {len(sent)}, espero hasta {args.comment_wait_seconds} s a que el sistema los procese")
            comment_deadline = time.monotonic() + args.comment_wait_seconds
            while time.monotonic() < comment_deadline and len(resolved_times([c["key"] for c in sent])) < len(sent):
                time.sleep(5)

    resolved = resolved_times([c["key"] for c in comments]) if comments else {}

    print()
    print("=== evolucion de la cola, un renglon por minuto")
    for elapsed, created_count, done_count in timeline[::4]:
        print(f"{elapsed:5d} s | creados {created_count:3d} | procesados {done_count:3d} | sin procesar {created_count - done_count:3d}")

    print()
    print("=== por tramo de ritmo")
    for rate in sorted({i["rate"] for i in created}):
        summarize(f"{rate} tickets por minuto", [i for i in created if i["rate"] == rate], rows, args.target_seconds)

    print()
    print("=== en total")
    summarize("todos los tickets", created, rows, args.target_seconds)
    internal = [r.processing_time_ms / 1000 for r in rows.values() if r.processing_time_ms is not None]
    print(f"   tiempo interno de procesamiento: {stats_text(internal)}")
    if stopped:
        print("   la creacion se detuvo antes de terminar el plan porque la cola superaba el maximo")

    during = [e for e in timeline if 0 < e[0] <= creation_end]
    if during:
        elapsed, _, done_count = during[-1]
        print(f"   ritmo de procesamiento durante la creacion: {done_count / (elapsed / 60):.1f} tickets por minuto")
    drained = next((e[0] for e in timeline if e[0] > creation_end and e[1] - e[2] == 0), None)
    print(f"   cola vaciada {drained - creation_end} s despues del ultimo ticket" if drained is not None else f"   la cola no se vacio en el tiempo de espera, quedaron {final_backlog} sin procesar")

    print()
    print("=== comentarios, cierres simulados del cliente")
    if not comments:
        print("no se enviaron, ningun ticket salio automatico o estan desactivados")
    else:
        values = [(resolved[c["key"]] - c["sent_at"]).total_seconds() for c in sent if c["key"] in resolved]
        print(f"enviados {len(sent)} de {len(comments)} | omitidos o rechazados {len(comments) - len(sent)} | registrados como cierre por el sistema {len(values)}")
        print(f"   latencia hasta el cierre: {stats_text([v for v in values if v >= 0])}")
        print("   los tiempos comparan la hora de esta maquina con la de la base, una diferencia de reloj los desplaza unos segundos")

    print()
    print("=== detalle por ticket: ticket, ritmo, decision, primera respuesta en segundos, procesamiento interno en milisegundos")
    for item in created:
        row = rows.get(item["key"])
        value = latency(row)
        decision = row.decision if row is not None and row.decision else "sin procesar"
        print(f"{item['key']},{item['rate']},{decision},{'' if value is None else round(value, 1)},{'' if row is None or row.processing_time_ms is None else row.processing_time_ms}")


if __name__ == "__main__":
    main()
