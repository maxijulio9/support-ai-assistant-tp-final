# utilidad de evaluacion de solo lectura, compara la respuesta que genera el sistema con y sin la regla que pide los datos que faltan
# toma tickets ya procesados que llegaron a buscar en la base de conocimiento, con el contexto que el sistema guardo de cada uno
# genera la respuesta dos veces, con el prompt actual y con el mismo prompt sin esa regla, y evalua la confinza de las dos
# no escribe en la base ni en jsm, solo llama al modelo, cuatro veces por ticket, se corre dentro del contenedor del backend
#   python -m app.tools.info_request_check --since 2026-10-25 --limit 12

import argparse

from sqlalchemy import text

from app.core.database import get_db
from app.modules.internal_api.repositories.interaction_repository import InteractionRepository
from app.modules.response_generator.llm_client import LlmClient
from app.modules.response_generator.prompt_builder import MISSING_DATA_RULE, PromptBuilder
from app.modules.ticket_analyzer.schemas import ConversationTurn, TicketAnalysis

# diferencia de confianza a partir de la cual se cuenta que la regla empeoro el puntaje
SIGNIFICANT_DROP = 0.1


def main():
    parser = argparse.ArgumentParser(description="compara la respuesta con y sin la regla que pide los datos que faltan, solo lectura")
    parser.add_argument("--since", required=True, help="fecha desde la cual se toman los tickets procesados, por ejemplo 2026-10-25")
    parser.add_argument("--limit", type=int, default=12, help="cantidad maxima de tickets")
    args = parser.parse_args()

    db = next(get_db())
    try:
        rows = db.execute(text("""
            SELECT t.issue_key, t.summary, t.description, c.code AS country, p.language_code, i.id AS interaction_id, i.decision
            FROM ticket t
            JOIN LATERAL (
                SELECT id, decision FROM interaction
                WHERE ticket_id = t.id AND decision IS NOT NULL AND chunks_retrieved_count > 0
                ORDER BY created_at LIMIT 1
            ) i ON TRUE
            LEFT JOIN country c ON c.id = t.country_id
            LEFT JOIN project p ON p.id = t.project_id
            WHERE t.created_at >= CAST(:since AS timestamptz) AND (t.issue_key LIKE 'TARG-%' OR t.issue_key LIKE 'TBRA-%')
            ORDER BY t.created_at
            LIMIT :limit
        """), {"since": args.since, "limit": args.limit}).fetchall()
    finally:
        db.close()

    if not rows:
        raise SystemExit("no hay tickets procesados que hayan buscado en la base desde esa fecha")

    builder = PromptBuilder()
    repository = InteractionRepository()
    client = LlmClient()
    print(f"comparando {len(rows)} tickets, cuatro llamados por ticket")

    scores = {"sin la regla": [], "con la regla": []}
    drops = 0

    for row in rows:
        context = repository.get_interaction_context(str(row.interaction_id))
        retrieval = context["retrieval"] if context else None

        if retrieval is None or not retrieval.chunks:
            print(f"{row.issue_key}: sin fragmentos en la base actual, se omite")
            continue

        content = f"{row.summary or ''} {row.description or ''}".strip()
        analysis = TicketAnalysis(
            issue_key=row.issue_key, country=row.country, language_code=row.language_code,
            conversation_history=[ConversationTurn(role="user", content=content)],
        )
        with_rule = builder.build_prompt(analysis, retrieval)
        without_rule = with_rule.replace(MISSING_DATA_RULE, "")

        results = {}
        for label, prompt in (("sin la regla", without_rule), ("con la regla", with_rule)):
            answer = client.generate_response(prompt)
            score = client.evaluate_confidence(builder.build_confidence_prompt(retrieval, answer)) if answer else None
            results[label] = (answer, score)
            if score is not None:
                scores[label].append(score)

        before, after = results["sin la regla"][1], results["con la regla"][1]
        if before is not None and after is not None and before - after > SIGNIFICANT_DROP:
            drops += 1

        print()
        print(f"=== {row.issue_key} | decision original: {row.decision} | {(row.summary or '')[:70]}")
        for label in ("sin la regla", "con la regla"):
            answer, score = results[label]
            print(f"--- {label}, confianza {score}")
            print(answer or "(sin respuesta)")

    print()
    for label, values in scores.items():
        average = round(sum(values) / len(values), 3) if values else None
        print(f"confianza media {label}: {average} sobre {len(values)} respuestas")
    print(f"tickets donde la confianza baja mas de {SIGNIFICANT_DROP} con la regla: {drops}")
    print("la generacion no es del todo repetible, una diferencia aislada puede ser variacion del modelo, mira el patron entre los tickets")


if __name__ == "__main__":
    main()
