# utilidad de evaluacion de solo lectura, mide que tan bien clasifica la categoria el sistema contra la categoria de los tickets historicos
# toma una muestra al azar de la linea base por proyecto, lee el titulo y la descripcion de cada ticket en jsm y los clasifica con el clasificador actual
# compara la categoria que devuelve con la del ticket historico, no escribe en la base ni en jsm, se corre dentro del contenedor del backend
#   python -u -m app.tools.classify_eval --projects TARG,TBRA --sample 100 --seed 1

import argparse
import math
import random
from collections import Counter, defaultdict

import httpx
from sqlalchemy import text

from app.core.database import get_db
from app.modules.internal_api.repositories.jsm_credentials_repository import JsmCredentialsRepository
from app.modules.ticket_analyzer.llm_client import LlmClient
from app.modules.ticket_analyzer.project_repository import ProjectRepository
from app.modules.ticket_analyzer.schemas import ConversationTurn
from app.tools.response_baseline import jsm_request


# intervalo de confianza de wilson al 95% para una proporcion
def wilson(successes: int, total: int) -> tuple[float, float]:
    if total == 0:
        return 0.0, 0.0
    z = 1.96
    p = successes / total
    denominator = 1 + z * z / total
    center = (p + z * z / (2 * total)) / denominator
    margin = z * math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator
    return center - margin, center + margin


# elige al azar tickets de la linea base que tienen categoria
def sample_baseline(code: str, count: int, rng: random.Random) -> list[tuple[str, str]]:
    db = next(get_db())
    try:
        rows = db.execute(text("""
            SELECT b.issue_key, b.category FROM ticket_response_baseline b JOIN project p ON p.id = b.project_id
            WHERE p.code = :code AND b.category IS NOT NULL ORDER BY b.issue_key
        """), {"code": code}).fetchall()
    finally:
        db.close()

    pairs = [(row.issue_key, row.category) for row in rows]
    return rng.sample(pairs, min(count, len(pairs)))


# imprime la precision general, los aciertos por categoria, las confusiones mas frecuentes y algunos errores
def report(label: str, records: list[dict], show_errors: int):
    total = len(records)
    correct = sum(1 for r in records if r["truth"] == r["predicted"])
    low, high = wilson(correct, total)
    print(f"--- {label}: {correct} de {total} correctas, {correct / total:.1%} (intervalo del 95%: {low:.1%} a {high:.1%})" if total else f"--- {label}: sin datos")
    if not total:
        return

    support, tp, predicted_count = Counter(), Counter(), Counter()
    for r in records:
        support[r["truth"]] += 1
        predicted_count[r["predicted"]] += 1
        if r["truth"] == r["predicted"]:
            tp[r["truth"]] += 1

    print(f"   {'categoria':44} {'tickets':>7} {'recall':>7} {'precision':>9}")
    for category in sorted(support, key=lambda c: -support[c]):
        recall = tp[category] / support[category]
        precision = tp[category] / predicted_count[category] if predicted_count[category] else 0.0
        print(f"   {category[:44]:44} {support[category]:7d} {recall:7.0%} {precision:9.0%}")

    confusions = Counter((r["truth"], r["predicted"]) for r in records if r["truth"] != r["predicted"])
    print("   confusiones mas frecuentes (real -> asignada):")
    for (truth, predicted), count in confusions.most_common(6):
        print(f"      {count} x {truth} -> {predicted}")

    print(f"   ejemplos de errores, hasta {show_errors}:")
    for r in [r for r in records if r["truth"] != r["predicted"]][:show_errors]:
        print(f"      {r['key']} | real: {r['truth']} | asignada: {r['predicted']} | {r['snippet']}")


def main():
    parser = argparse.ArgumentParser(description="mide la clasificacion de categoria contra los tickets historicos, solo lectura")
    parser.add_argument("--projects", required=True, help="claves de los proyectos separadas por coma")
    parser.add_argument("--sample", type=int, default=100, help="tickets por proyecto")
    parser.add_argument("--seed", type=int, default=1, help="semilla para repetir la misma muestra")
    parser.add_argument("--errors", type=int, default=12, help="cantidad de errores de ejemplo por proyecto")
    args = parser.parse_args()

    credentials = JsmCredentialsRepository().get_credentials()
    if credentials is None:
        raise SystemExit("todavia no se configuro la conexion con jsm")

    base = credentials["base_url"].rstrip("/")
    rng = random.Random(args.seed)
    repository = ProjectRepository()
    classifier = LlmClient()
    by_project = {}

    with httpx.Client(auth=(credentials["user_email"], credentials["api_token"]), timeout=30, headers={"Accept": "application/json"}) as client:
        for code in [c.strip() for c in args.projects.split(",") if c.strip()]:
            categories = repository.get_project_context(code).categories
            rows = sample_baseline(code, args.sample, rng)
            evaluable = [row for row in rows if row[1] in categories]
            without_equivalent = Counter(row[1] for row in rows if row[1] not in categories)
            print(f"{code}: muestra de {len(rows)}, evaluables {len(evaluable)}, sin una categoria equivalente en el sistema {dict(without_equivalent)}")
            print(f"   categorias que ofrece el sistema: {categories}")

            records = []
            for index, (key, truth) in enumerate(evaluable, start=1):
                fields = jsm_request(client, "GET", f"{base}/rest/api/2/issue/{key}", params={"fields": "summary,description"})["fields"]
                content = f"{fields.get('summary') or ''} {fields.get('description') or ''}".strip()
                result = classifier.classify(content, [ConversationTurn(role="user", content=content)], categories)
                records.append({
                    "key": key, "truth": truth, "predicted": result.category if result else "sin clasificar",
                    "snippet": (fields.get("summary") or "")[:70],
                })
                if index % 20 == 0:
                    print(f"   {code}: {index} de {len(evaluable)}")
            by_project[code] = records

    print()
    for code, records in by_project.items():
        report(code, records, args.errors)
        print()
    report("todos los proyectos", [r for records in by_project.values() for r in records], 0)


if __name__ == "__main__":
    main()
