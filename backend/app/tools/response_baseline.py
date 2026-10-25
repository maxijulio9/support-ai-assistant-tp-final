# utilidad de mantenimiento, reconstruye la linea base de tiempos de respuesta leyendo jsm
# toma los tickets creados antes de la puesta en marcha del sistema y guarda en ticket_response_baseline
# cuanto tardo el primer comentario publico de una persona y cuando comento por ultima vez el cliente
# se corre dentro del contenedor del backend, por ejemplo
#   python -m app.tools.response_baseline --projects TARG,TBRA --category-field customfield_10113 --dry-run
# sin --dry-run guarda el resultado, y se puede repetir porque actualiza lo ya cargado y no duplica nada

import argparse
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import text

from app.core.database import get_db
from app.modules.internal_api.repositories.jsm_credentials_repository import JsmCredentialsRepository

PAGE_SIZE = 100
MAX_RETRIES = 5
INSERT_CHUNK = 100


# convierte una fecha de jsm, con o sin zona horaria, en un datetime con zona, sin zona se asume utc
def parse_timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


# pide a jsm y reintenta cuando responde que hay demasiados pedidos o que no esta disponible
# espera lo que jsm indica, y si no indica nada va duplicando la espera entre reintntos
def jsm_request(client: httpx.Client, method: str, url: str, **kwargs) -> dict:
    for attempt in range(MAX_RETRIES):
        response = client.request(method, url, **kwargs)

        if response.status_code in (429, 502, 503, 504):
            time.sleep(float(response.headers.get("Retry-After", 2 ** attempt)))
            continue

        response.raise_for_status()
        return response.json()

    raise RuntimeError(f"jsm sigue sin responder despues de {MAX_RETRIES} intentos: {url}")


# trae todos los tickets de la consulta, paginando con el token que devulve jsm
def search_issues(client: httpx.Client, base: str, jql: str, fields: list[str]) -> list[dict]:
    issues, token = [], None

    while True:
        body = {"jql": jql, "fields": fields, "maxResults": PAGE_SIZE}
        if token:
            body["nextPageToken"] = token

        data = jsm_request(client, "POST", f"{base}/rest/api/3/search/jql", json=body)
        issues.extend(data.get("issues", []))
        token = data.get("nextPageToken")

        if not token or data.get("isLast"):
            return issues


# trae los comentarios de un ticket, cada uno con su marca de publico o interno en jsdPublic
def fetch_comments(client: httpx.Client, base: str, key: str) -> list[dict]:
    comments, start = [], 0

    while True:
        data = jsm_request(client, "GET", f"{base}/rest/api/2/issue/{key}/comment", params={"startAt": start, "maxResults": 100})
        batch = data.get("comments", [])
        comments.extend(batch)
        start += len(batch)

        if not batch or start >= data.get("total", 0):
            return comments


def author_id(comment: dict) -> str | None:
    return (comment.get("author") or {}).get("accountId")


# calcula los tiempos de un ticket a partir de sus comentarios
# primera respuesta, el primer comentario publico de alguien que no es el reportante
# ultimo comentario del cliente, el ultimo del reportante posterior a esa primera respuesta, uno anterior no confirma nada
# un comentario sin la marca jsdPublic, de un proyecto que no es de servicio, se toma como publico
def build_row(issue: dict, comments: list[dict], category_field: str, project_id: str | None) -> dict:
    fields = issue["fields"]
    reporter = (fields.get("reporter") or {}).get("accountId")
    public = sorted((c for c in comments if c.get("jsdPublic", True)), key=lambda c: parse_timestamp(c["created"]))

    first_response = next((parse_timestamp(c["created"]) for c in public if author_id(c) != reporter), None)

    last_customer = None
    if first_response is not None:
        for comment in public:
            moment = parse_timestamp(comment["created"])
            if author_id(comment) == reporter and moment > first_response:
                last_customer = moment

    category = fields.get(category_field)
    if isinstance(category, dict):
        category = category.get("value")

    return {
        "issue_key": issue["key"],
        "project_id": project_id,
        "category": category,
        "jira_created_at": parse_timestamp(fields["created"]),
        "first_response_at": first_response,
        "last_customer_comment_at": last_customer,
    }


# lee de la base lo que hace falta antes de hablar con jsm, asi la sesion no queda abierta durante toda la carga
# el corte es la primera interaccion con decision, salvo que se indique otro
def read_context(codes: list[str], cutoff_arg: str | None):
    db = next(get_db())

    try:
        if cutoff_arg:
            cutoff = parse_timestamp(cutoff_arg)
        else:
            cutoff = db.execute(text("SELECT MIN(created_at) AS first_moment FROM interaction WHERE decision IS NOT NULL")).fetchone().first_moment

        processed = {row.issue_key for row in db.execute(text("SELECT issue_key FROM ticket")).fetchall()}
        projects = {
            row.code: str(row.id)
            for row in db.execute(text("SELECT code, id FROM project WHERE code = ANY(:codes)"), {"codes": codes}).fetchall()
        }
        return cutoff, processed, projects

    finally:
        db.close()


# guarda las filas de a 100 por consulta, actualiza las que ya estaban y no duplica ninguna
def save_rows(rows: list[dict]):
    db = next(get_db())

    try:
        for start in range(0, len(rows), INSERT_CHUNK):
            chunk = rows[start:start + INSERT_CHUNK]
            placeholders = ", ".join(f"(:k{i}, :p{i}, :c{i}, :j{i}, :f{i}, :l{i})" for i in range(len(chunk)))
            params = {}

            for i, row in enumerate(chunk):
                params.update({
                    f"k{i}": row["issue_key"], f"p{i}": row["project_id"], f"c{i}": row["category"],
                    f"j{i}": row["jira_created_at"], f"f{i}": row["first_response_at"], f"l{i}": row["last_customer_comment_at"],
                })

            db.execute(text(f"""
                INSERT INTO ticket_response_baseline
                    (issue_key, project_id, category, jira_created_at, first_response_at, last_customer_comment_at)
                VALUES {placeholders}
                ON CONFLICT (issue_key) DO UPDATE SET
                    project_id = EXCLUDED.project_id,
                    category = EXCLUDED.category,
                    jira_created_at = EXCLUDED.jira_created_at,
                    first_response_at = EXCLUDED.first_response_at,
                    last_customer_comment_at = EXCLUDED.last_customer_comment_at,
                    loaded_at = NOW()
            """), params)

        db.commit()

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


# percentil con interpolacion lineal sobre una lista ya ordenada
def percentile(ordered: list[float], percent: int) -> float:
    rank = (len(ordered) - 1) * percent / 100
    low = int(rank)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (rank - low)


# muestra que se reconstruyo, incluidas las duraciones mas repetidas, que dicen si los tiempos son fijos o variados
def print_summary(rows: list[dict], skipped_processed: int, skipped_after_cutoff: int):
    print("tickets reconstruidos:", len(rows), "| procesados por el sistema, omitidos:", skipped_processed,
          "| creados desde el corte, omitidos:", skipped_after_cutoff)

    if not rows:
        return

    by_date = sorted(rows, key=lambda r: r["jira_created_at"])
    print("creados entre", by_date[0]["jira_created_at"].date(), "y", by_date[-1]["jira_created_at"].date())
    print("los tres mas recientes:", [(r["issue_key"], r["jira_created_at"].date().isoformat()) for r in by_date[-3:]])
    print("por proyecto:", dict(Counter(r["issue_key"].split("-")[0] for r in rows)))
    print("sin categoria:", sum(1 for r in rows if r["category"] is None))
    print("por categoria:", Counter(r["category"] for r in rows if r["category"]).most_common())

    answered = [r for r in rows if r["first_response_at"] is not None]
    closed = [r for r in rows if r["last_customer_comment_at"] is not None]
    print("con primera respuesta:", len(answered), "| con comentario de cierre del cliente:", len(closed))

    minutes = sorted((r["first_response_at"] - r["jira_created_at"]).total_seconds() / 60 for r in answered)
    print("primeras respuestas negativas, que se descartan al calcular:", sum(1 for m in minutes if m < 0))

    if minutes:
        print("primera respuesta en minutos | minimo:", round(minutes[0], 1), "| p10:", round(percentile(minutes, 10), 1),
              "| mediana:", round(percentile(minutes, 50), 1), "| p90:", round(percentile(minutes, 90), 1),
              "| maximo:", round(minutes[-1], 1))
        print("duraciones mas repetidas en minutos:", Counter(round(m) for m in minutes).most_common(8))


def main():
    parser = argparse.ArgumentParser(description="reconstruye la linea base de tiempos de respuesta desde jsm")
    parser.add_argument("--projects", required=True, help="claves de los proyectos separadas por coma, por ejemplo TARG,TBRA")
    parser.add_argument("--category-field", required=True, help="id del campo de jsm que tiene la categoria, por ejemplo customfield_10113")
    parser.add_argument("--cutoff", help="fecha y hora desde la cual los tickets ya son del sistema, por defecto la primera interaccion con decision")
    parser.add_argument("--workers", type=int, default=5, help="pedidos de comentarios en paralelo")
    parser.add_argument("--dry-run", action="store_true", help="calcula y muestra el resumen sin guardar nada")
    args = parser.parse_args()

    credentials = JsmCredentialsRepository().get_credentials()
    if credentials is None:
        raise SystemExit("todavia no se configuro la conexion con jsm")

    codes = [code.strip() for code in args.projects.split(",") if code.strip()]
    cutoff, processed, projects = read_context(codes, args.cutoff)

    if cutoff is None:
        raise SystemExit("no hay interacciones con decision, indica el corte con --cutoff")

    for code in codes:
        if code not in projects:
            print(f"aviso, {code} no esta dado de alta en la base, sus tickets se guardan sin proyecto")

    print("corte:", cutoff.isoformat(), "| proyectos:", codes, "| modo:", "solo lectura" if args.dry_run else "guarda")

    base = credentials["base_url"].rstrip("/")
    # jsm interpreta las fechas de la consulta en el huso de la cuenta, asi que se pide un dia de mas y el corte exacto se aplica aca
    jql_date = (cutoff.date() + timedelta(days=1)).isoformat()
    rows, skipped_processed, skipped_after_cutoff = [], 0, 0

    with httpx.Client(auth=(credentials["user_email"], credentials["api_token"]), timeout=30, headers={"Accept": "application/json"}) as client:
        for code in codes:
            issues = search_issues(client, base, f'project = {code} AND created < "{jql_date}" ORDER BY created ASC',
                                   ["created", "reporter", args.category_field])
            selected = []

            for issue in issues:
                if issue["key"] in processed:
                    skipped_processed += 1
                elif parse_timestamp(issue["fields"]["created"]) >= cutoff:
                    skipped_after_cutoff += 1
                else:
                    selected.append(issue)

            print(f"{code}: {len(issues)} tickets leidos, {len(selected)} entran en la linea base")

            for start in range(0, len(selected), 100):
                batch = selected[start:start + 100]

                with ThreadPoolExecutor(max_workers=args.workers) as pool:
                    comment_lists = list(pool.map(lambda issue: fetch_comments(client, base, issue["key"]), batch))

                for issue, comments in zip(batch, comment_lists):
                    rows.append(build_row(issue, comments, args.category_field, projects.get(code)))

                print(f"  {code}: {min(start + 100, len(selected))} de {len(selected)} con sus comentarios")

    print_summary(rows, skipped_processed, skipped_after_cutoff)

    if args.dry_run:
        print("modo de solo lectura, no se guardo nada")
        return

    save_rows(rows)
    print("guardado:", len(rows), "tickets en ticket_response_baseline")


if __name__ == "__main__":
    main()
