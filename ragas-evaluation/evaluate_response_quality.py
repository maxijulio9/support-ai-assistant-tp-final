"""
Evaluacion RAGAS (TF-174): faithfulness y answer_relevancy sobre una muestra
de interacciones reales ya persistidas. Script standalone, no forma parte
del pipeline en produccion, no escribe nada en la base. Corre a mano, genera
un reporte local.
"""

import os
import json
from datetime import datetime, timezone
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras
from datasets import Dataset
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from ragas import evaluate
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from ragas.metrics import Faithfulness, AnswerRelevancy

load_dotenv()

SAMPLE_SIZE = 3


# trae una muestra de interacciones reales con respuesta generada y al menos un chunk recuperado
def fetch_sample(connection, limit: int) -> list[dict]:
    cursor = connection.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute("""
        SELECT i.id, i.text_input, i.generated_response
        FROM interaction i
        WHERE i.generated_response IS NOT NULL
          AND i.text_input IS NOT NULL
          AND EXISTS (SELECT 1 FROM retrieved_chunk rc WHERE rc.interaction_id = i.id)
        ORDER BY i.created_at DESC
        LIMIT %s
    """, (limit,))
    interactions = cursor.fetchall()
    cursor.close()
    return [dict(row) for row in interactions]


# trae el contenido de los chunks recuperados para una interaccion puntual, en orden de ranking
def fetch_contexts(connection, interaction_id: str) -> list[str]:
    cursor = connection.cursor()
    cursor.execute("""
        SELECT kc.content
        FROM retrieved_chunk rc
        JOIN knowledge_chunk kc ON rc.chunk_id = kc.id
        WHERE rc.interaction_id = %s
        ORDER BY rc.rank_position
    """, (interaction_id,))
    rows = cursor.fetchall()
    cursor.close()
    return [row[0] for row in rows]


def main():
    connection = psycopg2.connect(os.environ["DATABASE_URL"])

    interactions = fetch_sample(connection, SAMPLE_SIZE)
    print(f"muestra obtenida: {len(interactions)} interacciones")

    rows = []
    for interaction in interactions:
        contexts = fetch_contexts(connection, interaction["id"])
        if not contexts:
            continue

        rows.append({
            "question": interaction["text_input"],
            "answer": interaction["generated_response"],
            "contexts": contexts,
        })

    connection.close()

    if not rows:
        print("no se encontraron interacciones evaluables, nada para hacer")
        return

    print(f"evaluando {len(rows)} casos con ragas (faithfulness, answer_relevancy)...")

    evaluator_llm = LangchainLLMWrapper(ChatOpenAI(model="gpt-4o-mini"))
    evaluator_embeddings = LangchainEmbeddingsWrapper(OpenAIEmbeddings(model="text-embedding-3-small"))

    faithfulness_metric = Faithfulness(llm=evaluator_llm)
    answer_relevancy_metric = AnswerRelevancy(llm=evaluator_llm, embeddings=evaluator_embeddings)

    dataset = Dataset.from_list(rows)
    result = evaluate(dataset, metrics=[faithfulness_metric, answer_relevancy_metric])

    df = result.to_pandas()
    aggregate = {
        "faithfulness": float(df["faithfulness"].mean()),
        "answer_relevancy": float(df["answer_relevancy"].mean()),
    }

    print("--- resultado agregado ---")
    print(aggregate)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    report_path = f"reporte_{timestamp}.json"

    with open(report_path, "w") as f:
        json.dump({
            "sample_size": len(rows),
            "aggregate": aggregate,
            "per_case": df.to_dict(orient="records"),
        }, f, indent=2, ensure_ascii=False)

    print(f"reporte guardado en {report_path}")


if __name__ == "__main__":
    main()