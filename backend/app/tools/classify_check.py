# utilidad de evaluacion de solo lectura, comprueba si reclasificar con el prompt actual reproduce lo que el sistema hizo de verdad
# toma los tickets que el sistema ya proceso desde una fecha, con el mismo texto que guardo, y los clasifica con el prompt actual de dos formas
# sin historial, como lo hace classify_probe, y con el historial como lo arma el sistema, que repite el texto del ticket en el prompt
# despues compara las dos con lo que paso de verdad, si el ticket escalo antes de buscar en la base de conocimiento
# no escribe en la base ni en jsm, solo llama al modelo, dos veces por ticket, se corre dentro del contenedor del backend
#   python -m app.tools.classify_check --since 2026-10-25

import argparse

from sqlalchemy import text

from app.core.database import get_db
from app.modules.ticket_analyzer.llm_client import LlmClient
from app.modules.ticket_analyzer.project_repository import ProjectRepository
from app.modules.ticket_analyzer.schemas import ConversationTurn
from app.tools.classify_probe import verdict

ESCALATED = "escalo antes de buscar"
FOLLOWED = "siguio a la base"


# lo que paso de verdad con el ticket, escalo directo si la decision fue escalar sin haber buscado fragmentos
def production_label(decision: str, chunks) -> str:
    return ESCALATED if decision == "ESCALATE" and not chunks else FOLLOWED


# lo que habria pasado con esa clasificacion, usando la misma regla que el analizador
def probe_label(result) -> str:
    return ESCALATED if verdict(result).startswith("escala") else FOLLOWED


def main():
    parser = argparse.ArgumentParser(description="compara la clasificacion actual con lo que el sistema hizo de verdad, solo lectura")
    parser.add_argument("--since", required=True, help="fecha desde la cual se toman los tickets procesados, por ejemplo 2026-10-25")
    args = parser.parse_args()

    db = next(get_db())
    try:
        rows = db.execute(text("""
            SELECT t.issue_key, t.summary, t.description, i.decision, i.chunks_retrieved_count
            FROM ticket t
            JOIN LATERAL (
                SELECT decision, chunks_retrieved_count FROM interaction
                WHERE ticket_id = t.id AND decision IS NOT NULL ORDER BY created_at LIMIT 1
            ) i ON TRUE
            WHERE t.created_at >= CAST(:since AS timestamptz) AND (t.issue_key LIKE 'TARG-%' OR t.issue_key LIKE 'TBRA-%')
            ORDER BY t.created_at
        """), {"since": args.since}).fetchall()
    finally:
        db.close()

    if not rows:
        raise SystemExit("no hay tickets procesados desde esa fecha")

    repository = ProjectRepository()
    categories = {key: repository.get_project_context(key).categories for key in {r.issue_key.split("-")[0] for r in rows}}
    client = LlmClient()
    print(f"comparando {len(rows)} tickets, dos llamados por ticket")

    escalated = {"produccion": 0, "sin historial": 0, "con historial": 0}
    agree = {"sin historial": 0, "con historial": 0}

    print(f"{'ticket':10} {'produccion':24} {'sin historial':24} {'con historial':24} resumen")
    for row in rows:
        content = f"{row.summary or ''} {row.description or ''}".strip()
        project_categories = categories[row.issue_key.split("-")[0]]
        real = production_label(row.decision, row.chunks_retrieved_count)
        without = probe_label(client.classify(content, [], project_categories))
        with_history = probe_label(client.classify(content, [ConversationTurn(role="user", content=content)], project_categories))

        escalated["produccion"] += real == ESCALATED
        escalated["sin historial"] += without == ESCALATED
        escalated["con historial"] += with_history == ESCALATED
        agree["sin historial"] += without == real
        agree["con historial"] += with_history == real

        mark = "  <- difiere" if without != real or with_history != real else ""
        print(f"{row.issue_key:10} {real:24} {without:24} {with_history:24} {(row.summary or '')[:40]}{mark}")

    total = len(rows)
    print()
    print(f"tickets comparados: {total}")
    print(f"escalaron antes de buscar, en produccion: {escalated['produccion']}, sin historial: {escalated['sin historial']}, con historial: {escalated['con historial']}")
    print(f"coinciden con produccion, sin historial: {agree['sin historial']} de {total}, con historial: {agree['con historial']} de {total}")
    print("la clasificacion no es del todo repetible, un par de tickets pueden variar entre corridas")


if __name__ == "__main__":
    main()
