# utilidad de evaluacion de solo lectura, reclasifica una muestra al azar de tickets historicos con el prompt actual del sistema y con una variante
# no escribe en la base ni en jsm, solo lee tickets de jsm y llama al modelo, tres veces por ticket
# la variante agrega un criterio general al prompt, sin ejemplos de ningun caso puntual
# clasifica dos veces con el prompt actual para medir cuanto varia el modelo entre corridas, un cambio solo cuenta si supera ese ruido
# para cada ticket que cambia muestra la primera respuesta que dio la persona, asi se puede juzgar si el cambio fue correcto
# se corre dentro del contenedor del backend
#   python -m app.tools.classify_probe --projects TARG,TBRA --sample 30 --seed 1

import argparse
import random
from collections import Counter

import httpx
from sqlalchemy import text

import app.modules.ticket_analyzer.llm_client as llm_module
from app.core.database import get_db
from app.modules.internal_api.repositories.jsm_credentials_repository import JsmCredentialsRepository
from app.modules.ticket_analyzer.llm_client import LlmClient
from app.modules.ticket_analyzer.project_repository import ProjectRepository
from app.tools.response_baseline import fetch_comments, jsm_request, parse_timestamp

# frase del prompt actual a la que se le agrega el criterio de la variante
L1_SENTENCE = '"L1" si el mensaje plantea una pregunta o un problema concreto que se puede orientar con informacion de la plataforma (pasos, requisitos, limites, comisiones).'
VARIANT_ADDITION = (
    ' Si el usuario pregunta si puede hacer algo, o como hacerlo, y la respuesta es informacion o pasos que el propio usuario puede seguir por su cuenta en la plataforma, '
    'es "L1" aunque la consulta mencione una accion sobre su cuenta. Es "L2" solamente cuando alguien del equipo tiene que ejecutar, revisar o decidir algo que el usuario no puede hacer por si mismo.'
)


# que le pasaria al ticket con esa clasificacion, usando la misma regla que el analizador del sistema
def verdict(result) -> str:
    if result is None:
        return "sin clasificar"
    if result.scope == "OUT_OF_SCOPE":
        return "escala por alcance"
    if result.resolved_by == "L2":
        return "escala por nivel 2"
    if result.resolved_by == "MISSING_INFO":
        return "pide informacion"
    return "sigue a la base"


# elige al azar tickets de la linea base que tuvieron respuesta de una persona
def sample_keys(code: str, count: int, rng: random.Random) -> list[str]:
    db = next(get_db())
    try:
        rows = db.execute(text("""
            SELECT b.issue_key FROM ticket_response_baseline b JOIN project p ON p.id = b.project_id
            WHERE p.code = :code AND b.first_response_at IS NOT NULL ORDER BY b.issue_key
        """), {"code": code}).fetchall()
    finally:
        db.close()

    keys = [row.issue_key for row in rows]
    return rng.sample(keys, min(count, len(keys)))


# lee de jsm el titulo, la descripcion y la primera respuesta publica de una persona
def load_item(client, base: str, key: str, categories: list[str]) -> dict:
    fields = jsm_request(client, "GET", f"{base}/rest/api/2/issue/{key}", params={"fields": "summary,description,reporter"})["fields"]
    reporter = (fields.get("reporter") or {}).get("accountId")
    public = sorted((c for c in fetch_comments(client, base, key) if c.get("jsdPublic", True)), key=lambda c: parse_timestamp(c["created"]))
    reply = next((c["body"] for c in public if (c.get("author") or {}).get("accountId") != reporter), "")
    summary = fields.get("summary") or ""
    description = fields.get("description") or ""

    return {"key": key, "project": key.split("-")[0], "summary": summary, "reply": reply.replace("\n", " "),
            "text": f"{summary} {description}".strip(), "categories": categories}


# clasifica todos los tickets con el prompt indicado, igual que el analizador, con el texto del ticket nuevo y sin historial
def classify_all(client, items: list[dict], prompt: str) -> dict:
    llm_module.CLASSIFICATION_PROMPT = prompt
    return {item["key"]: client.classify(item["text"], [], item["categories"]) for item in items}


def main():
    parser = argparse.ArgumentParser(description="reclasifica una muestra al azar de tickets historicos con el prompt actual y con una variante, solo lectura")
    parser.add_argument("--projects", required=True, help="claves de los proyectos separadas por coma")
    parser.add_argument("--sample", type=int, default=30, help="tickets por proyecto")
    parser.add_argument("--seed", type=int, default=1, help="semilla para repetir la misma muestra")
    args = parser.parse_args()

    current_prompt = llm_module.CLASSIFICATION_PROMPT
    if L1_SENTENCE not in current_prompt:
        raise SystemExit("el prompt del sistema cambio, hay que actualizar la utilidad")
    variant_prompt = current_prompt.replace(L1_SENTENCE, L1_SENTENCE + VARIANT_ADDITION)

    credentials = JsmCredentialsRepository().get_credentials()
    if credentials is None:
        raise SystemExit("todavia no se configuro la conexion con jsm")

    base = credentials["base_url"].rstrip("/")
    rng = random.Random(args.seed)
    repository = ProjectRepository()
    items = []

    with httpx.Client(auth=(credentials["user_email"], credentials["api_token"]), timeout=30, headers={"Accept": "application/json"}) as client:
        for code in [c.strip() for c in args.projects.split(",") if c.strip()]:
            categories = repository.get_project_context(code).categories
            keys = sample_keys(code, args.sample, rng)
            print(f"{code}: leyendo {len(keys)} tickets de jsm")
            items.extend(load_item(client, base, key, categories) for key in keys)

    llm = LlmClient()
    print(f"clasificando {len(items)} tickets, tres llamados por ticket, tarda unos minutos")
    first = classify_all(llm, items, current_prompt)
    second = classify_all(llm, items, current_prompt)
    variant = classify_all(llm, items, variant_prompt)
    llm_module.CLASSIFICATION_PROMPT = current_prompt

    noise = sum(1 for i in items if verdict(first[i["key"]]) != verdict(second[i["key"]]))
    changed = [i for i in items if verdict(first[i["key"]]) != verdict(variant[i["key"]])]

    print()
    for code in sorted({i["project"] for i in items}):
        subset = [i for i in items if i["project"] == code]
        print(f"--- {code}, {len(subset)} tickets")
        print("   prompt actual, primera corrida:", dict(Counter(verdict(first[i["key"]]) for i in subset)))
        print("   prompt actual, segunda corrida:", dict(Counter(verdict(second[i["key"]]) for i in subset)))
        print("   con la variante:               ", dict(Counter(verdict(variant[i["key"]]) for i in subset)))

    print()
    print(f"ruido, tickets que varian entre dos corridas con el mismo prompt: {noise} de {len(items)}")
    print(f"cambios con la variante: {len(changed)} de {len(items)}")
    print("pasan de escalar a seguir a la base:", sum(1 for i in changed if verdict(variant[i['key']]) == "sigue a la base"))
    print("pasan de seguir a la base a escalar:", sum(1 for i in changed if verdict(first[i['key']]) == "sigue a la base"))
    print()
    print("tickets que cambian, con la primera respuesta de la persona para juzgar si el cambio fue correcto")
    for i in changed:
        print(f"{i['key']:10} {verdict(first[i['key']]):19} -> {verdict(variant[i['key']]):19} | {i['summary'][:60]}")
        print(f"{'':10} la persona respondio: {i['reply'][:150]}")


if __name__ == "__main__":
    main()
