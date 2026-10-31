# utilidad de evaluacion, reenvia al sistema las preguntas de tickets historicos que una persona ya resolvio
# toma tickets de ticket_response_baseline con respuesta de una persona y confirmacion del cliente, o sea resueltos en el nivel 1
# crea tickets nuevos en jsm con el mismo titulo y descripcion, con la fecha de ahora y a nombre de un cliente de prueba,
# espera que el sistema los procese por el webhook y simula en una parte de ellos la respuesta de cierre del cliente
# los cierres se mandan directo al webhook con el secreto, no quedan como comentarios en jsm
# sin --confirm solo muestra el plan y no crea nada, por ejemplo
#   python -m app.tools.replay_tickets --projects TARG,TBRA --customer-account-id ID --count 5 --seed 1

import argparse
import random
import time
import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import text

from app.core.database import get_db
from app.modules.internal_api.repositories.jsm_credentials_repository import JsmCredentialsRepository

MAX_RETRIES = 5
MAX_COUNT = 200
REQUIRED_ACTIONS = ("escalate", "resolved", "awaiting_customer")

# respuestas de cierre del cliente por idioma del proyecto, sin idioma conocido se usa espanol
CLOSING_REPLIES = {
    "es": ["gracias, ya quedo resuelto", "perfecto, ya funciono. gracias", "listo, entendido. muchas gracias", "ok, gracias por la ayuda", "ya lo solucione, gracias"],
    "pt": ["obrigado, ja resolvi", "perfeito, funcionou. obrigado", "entendi, muito obrigado", "ok, obrigado pela ajuda", "ja esta resolvido, valeu"],
    "en": ["thanks, it is solved now", "perfect, it worked. thank you", "got it, thanks a lot", "ok, thanks for the help", "all good now, thanks"],
}


def query(sql: str, **params):
    db = next(get_db())
    try:
        return db.execute(text(sql), params).fetchall()
    finally:
        db.close()


# pide a jsm y reintenta cuando responde que hay demasiados pedidos o que no esta disponible
def jsm_request(client: httpx.Client, method: str, url: str, **kwargs) -> dict:
    for attempt in range(MAX_RETRIES):
        response = client.request(method, url, **kwargs)

        if response.status_code in (429, 502, 503, 504):
            time.sleep(float(response.headers.get("Retry-After", 2 ** attempt)))
            continue

        if response.status_code >= 400:
            raise RuntimeError(f"jsm respondio {response.status_code} en {url}: {response.text[:300]}")

        return response.json() if response.content else {}

    raise RuntimeError(f"jsm sigue sin responder despues de {MAX_RETRIES} intentos: {url}")


# idioma del proyecto, o none si el proyecto no esta dado de alta
def project_language(code: str):
    rows = query("SELECT language_code FROM project WHERE code = :code", code=code)
    if not rows:
        return None
    return rows[0].language_code or "es"


# estados mapeados del proyecto para las acciones que el flujo necesita, devuelve el mapa y las acciones que faltan
def check_mapping(code: str):
    rows = query("""
        SELECT pc.system_action, ts.name AS status_name
        FROM project_config pc
        JOIN project p ON p.id = pc.project_id
        JOIN ticket_status ts ON ts.id = pc.status_id
        WHERE p.code = :code AND pc.is_active AND pc.system_action = ANY(:actions)
    """, code=code, actions=list(REQUIRED_ACTIONS))
    mapped = {row.system_action: row.status_name for row in rows}
    return mapped, [action for action in REQUIRED_ACTIONS if action not in mapped]


# elige al azar tickets de la linea base que tuvieron respuesta de una persona y confirmacion del cliente
def pick_cases(code: str, count: int, rng: random.Random) -> list[dict]:
    rows = query("""
        SELECT b.issue_key, b.category
        FROM ticket_response_baseline b
        JOIN project p ON p.id = b.project_id
        WHERE p.code = :code AND b.first_response_at IS NOT NULL AND b.last_customer_comment_at IS NOT NULL
        ORDER BY b.issue_key
    """, code=code)
    chosen = rng.sample(list(rows), min(count, len(rows)))
    return [{"original": row.issue_key, "category": row.category} for row in chosen]


# lee de jsm el titulo, la descripcion y el tipo de solicitud del ticket original
def load_original(client: httpx.Client, base: str, key: str, request_type_field: str) -> dict:
    data = jsm_request(client, "GET", f"{base}/rest/api/2/issue/{key}", params={"fields": f"summary,description,{request_type_field}"})
    fields = data["fields"]
    request_type = (fields.get(request_type_field) or {}).get("requestType") or {}
    return {"summary": fields["summary"], "description": fields.get("description"), "request_type_id": request_type.get("id")}


# crea la solicitud en jsm a nombre del cliente de prueba, el webhook de jsm avisa al sistema
def create_request(client: httpx.Client, base: str, desk_id: str, case: dict, customer: str) -> tuple[str, str]:
    values = {"summary": case["summary"]}
    if case["description"]:
        values["description"] = case["description"]

    data = jsm_request(client, "POST", f"{base}/rest/servicedeskapi/request", json={
        "serviceDeskId": desk_id,
        "requestTypeId": case["request_type_id"],
        "requestFieldValues": values,
        "raiseOnBehalfOf": customer,
    })
    return data["issueKey"], data["issueId"]


# espera hasta timeout segundos a que el sistema tenga una interaccion con decision para el ticket
def wait_for_processing(key: str, timeout: float):
    deadline = time.monotonic() + timeout

    while time.monotonic() < deadline:
        rows = query("""
            SELECT i.decision, i.first_response_at
            FROM ticket t JOIN interaction i ON i.ticket_id = t.id
            WHERE t.issue_key = :key AND i.decision IS NOT NULL
            ORDER BY i.created_at
        """, key=key)

        if rows:
            return rows[0]

        time.sleep(3)

    return None


# manda al webhook el evento de un comentario publico del cliente, igual al que mandaria jsm
# el sistema solo lo procesa si el ticket esta en un estado de espera, por eso se lee el estado actual antes
def send_closure(client: httpx.Client, base: str, backend_url: str, secret: str, item: dict, reply: str):
    issue = jsm_request(client, "GET", f"{base}/rest/api/2/issue/{item['key']}", params={"fields": "status,reporter,summary,created"})
    fields = issue["fields"]
    status_name = fields["status"]["name"]

    if status_name != item["mapped"]["awaiting_customer"]:
        return f"omitido, el ticket esta en {status_name} y no en espera del cliente"

    payload = {
        "webhookEvent": "comment_created",
        "timestamp": int(time.time() * 1000),
        "issue": {"id": item["issue_id"], "key": item["key"], "fields": {
            "summary": fields["summary"], "created": fields["created"],
            "status": {"id": fields["status"]["id"], "name": status_name},
            "reporter": {"accountId": fields["reporter"]["accountId"]},
        }},
        "comment": {"id": f"sim-{uuid.uuid4().hex[:12]}", "body": reply, "author": {"accountId": fields["reporter"]["accountId"]}, "jsdPublic": True},
    }
    response = httpx.post(f"{backend_url}/webhook/jsm", json=payload, headers={"X-Webhook-Secret": secret}, timeout=30)
    return f"enviado ({response.status_code})" if response.status_code == 200 else f"el webhook respondio {response.status_code}: {response.text[:120]}"


# muestra para cada ticket nuevo que decidio el sistema y cuanto tardo, y avisa si falto registrar la fecha de jsm
def print_report(created: list[dict]):
    zone = ZoneInfo("America/Argentina/La_Rioja")
    moments, measured, closed = [], 0, 0

    for item in created:
        rows = query("""
            SELECT t.jira_created_at, i.decision, i.first_response_at, i.resolved_at
            FROM ticket t JOIN interaction i ON i.ticket_id = t.id
            WHERE t.issue_key = :key ORDER BY i.created_at
        """, key=item["key"])

        if not rows:
            print(f"{item['key']} | de {item['original']} | el sistema no lo proceso")
            continue

        created_at = rows[0].jira_created_at
        responses = [row.first_response_at for row in rows if row.first_response_at is not None]
        resolutions = [row.resolved_at for row in rows if row.decision == "RESOLVED" and row.resolved_at is not None]

        if created_at is None:
            first_text = "SIN MEDIR, no se registro la fecha de creacion de jsm"
        elif responses:
            first_text = f"{(min(responses) - created_at).total_seconds():.1f} s"
            measured += 1
            moments.append(created_at)
        else:
            first_text = "sin primera respuesta"

        closure_text = "-"
        if created_at is not None and resolutions:
            closure_text = f"{(min(resolutions) - created_at).total_seconds():.1f} s"
            closed += 1

        decisions = [row.decision for row in rows]
        print(f"{item['key']} | de {item['original']} | {item['category']} | decisiones {decisions} | primera respuesta {first_text} | cierre {closure_text}")

    print("creados:", len(created), "| con primera respuesta medida:", measured, "| con cierre:", closed)

    if moments:
        local = sorted(moment.astimezone(zone) for moment in moments)
        print("rango de fechas para filtrar en la pantalla:", local[0].date().isoformat(), "a", local[-1].date().isoformat())


def main():
    parser = argparse.ArgumentParser(description="reenvia al sistema preguntas de tickets historicos resueltos por personas")
    parser.add_argument("--projects", required=True, help="claves de los proyectos separadas por coma")
    parser.add_argument("--customer-account-id", required=True, help="accountId del cliente de prueba a cuyo nombre se crean los tickets")
    parser.add_argument("--count", type=int, default=5, help="tickets por proyecto")
    parser.add_argument("--seed", type=int, help="semilla para repetir la misma seleccion")
    parser.add_argument("--interval-seconds", type=int, default=30, help="espera entre un ticket y el siguiente")
    parser.add_argument("--close-ratio", type=float, default=0.8, help="proporcion de los tickets respondidos solos que recibe un cierre simulado")
    parser.add_argument("--close-delay-min", type=int, default=20)
    parser.add_argument("--close-delay-max", type=int, default=60)
    parser.add_argument("--request-type-field", default="customfield_10010")
    parser.add_argument("--backend-url", default="http://localhost:8000")
    parser.add_argument("--canary-timeout", type=int, default=90, help="segundos que se espera al primer ticket antes de abortar")
    parser.add_argument("--confirm", action="store_true", help="crea los tickets, sin esto solo muestra el plan")
    args = parser.parse_args()

    if not 1 <= args.count <= MAX_COUNT:
        raise SystemExit(f"--count tiene que estar entre 1 y {MAX_COUNT}")
    if not 0 <= args.close_ratio <= 1 or args.close_delay_min > args.close_delay_max or args.interval_seconds < 1:
        raise SystemExit("revisa --close-ratio, --close-delay-min, --close-delay-max e --interval-seconds")
    if args.interval_seconds < 20:
        print("aviso, menos de 20 segundos entre tickets puede formar cola y agrandar la primera respuesta")

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
    plan = []

    with httpx.Client(auth=(credentials["user_email"], credentials["api_token"]), timeout=30, headers={"Accept": "application/json"}) as client:
        desks = {d["projectKey"]: d["id"] for d in jsm_request(client, "GET", f"{base}/rest/servicedeskapi/servicedesk", params={"limit": 50})["values"]}

        for code in [c.strip() for c in args.projects.split(",") if c.strip()]:
            language = project_language(code)
            mapped, missing = check_mapping(code)

            if language is None or code not in desks:
                print(f"{code}: se omite, no esta dado de alta en la base o no tiene service desk")
                continue
            if missing:
                print(f"{code}: se omite, faltan los estados de {missing} en la configuracion del proyecto")
                continue

            cases = []
            for case in pick_cases(code, args.count, rng):
                original = load_original(client, base, case["original"], args.request_type_field)
                if original["request_type_id"] is None:
                    print(f"{case['original']}: se omite, no tiene tipo de solicitud")
                    continue
                cases.append({**case, **original})

            plan.append({"code": code, "desk_id": desks[code], "language": language, "mapped": mapped, "cases": cases})
            print(f"--- {code} | service desk {desks[code]} | idioma {language} | estados {mapped}")
            for case in cases:
                print(f"  {case['original']} | {case['category']} | tipo de solicitud {case['request_type_id']} | {case['summary'][:70]}")

        if not args.confirm:
            print("solo plan, no se creo nada, agrega --confirm para crear los tickets")
            return

        created, first = [], True
        total = sum(len(item["cases"]) for item in plan)

        for item in plan:
            for case in item["cases"]:
                key, issue_id = create_request(client, base, item["desk_id"], case, args.customer_account_id)
                created.append({"key": key, "issue_id": issue_id, "original": case["original"], "category": case["category"],
                                "language": item["language"], "mapped": item["mapped"]})
                print(f"creado {key} a partir de {case['original']} ({len(created)} de {total})")

                if first:
                    first = False
                    print(f"espero hasta {args.canary_timeout} s a que el sistema procese el primer ticket")
                    if wait_for_processing(key, args.canary_timeout) is None:
                        raise SystemExit(f"el sistema no proceso {key}, revisa el secreto del webhook en jira y los registros del backend, no se crearon mas tickets")
                    print("el sistema lo proceso, sigo con el resto")

                if len(created) < total:
                    time.sleep(args.interval_seconds)

        print("espero a que el sistema termine de procesar los tickets")
        deadline = time.monotonic() + 240
        for item in created:
            item["decision"] = (wait_for_processing(item["key"], max(5, deadline - time.monotonic())) or {None: None}) and None
            result = query("""
                SELECT i.decision FROM ticket t JOIN interaction i ON i.ticket_id = t.id
                WHERE t.issue_key = :key AND i.decision IS NOT NULL ORDER BY i.created_at LIMIT 1
            """, key=item["key"])
            item["decision"] = result[0].decision if result else None

        answered = [item for item in created if item["decision"] == "AUTO_PUBLISH"]
        how_many = min(len(answered), round(len(answered) * args.close_ratio))
        if answered and args.close_ratio > 0:
            how_many = max(1, how_many)

        for item in rng.sample(answered, how_many):
            time.sleep(rng.uniform(args.close_delay_min, args.close_delay_max))
            reply = rng.choice(CLOSING_REPLIES.get(item["language"], CLOSING_REPLIES["es"]))
            print(f"cierre simulado de {item['key']}:", send_closure(client, base, args.backend_url, secret, item, reply))

        print("espero 90 s a que el sistema procese los cierres")
        time.sleep(90)

    print_report(created)
    print("los cierres fueron simulados enviando el evento al webhook, no hay comentarios del cliente en jsm")


if __name__ == "__main__":
    main()
