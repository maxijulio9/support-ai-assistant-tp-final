# consulta knowledge_chunk por similitud coseno usando pgvector
# filtra por country y category si estan disponibles en el analisis del ticket

import logging
from sqlalchemy import text
from app.core.database import get_db
from app.modules.knowledge_retriever.schemas import RetrievedChunk

logger = logging.getLogger(__name__)

# cantidad de chunks a devolver. Seguro se pueda parameetrizar
TOP_K = 5


class ChunkRetriever:

    # similitud coseno: busca los chunks mas similares al vector de consulta
    # filtra por country y category si estan disponibles
    def find_similar_chunks(self,
        query_embedding: list[float],
        category: str | None = None,
        country: str | None = None,
        doc_type: str | None = None,
        top_k: int = TOP_K,
    ) -> list[RetrievedChunk]:

        # construye la query base con similitud coseno
        # 1 - (embedding <=> query) convierte distancia coseno en similitud (1 = identico, 0 = opuesto)
        query_sql = """
            SELECT
                id,
                content,
                page_title,
                category,
                doc_type,
                1 - (embedding <=> :query_embedding) AS similarity_score
            FROM knowledge_chunk
            WHERE 1=1
        """

        params = {"query_embedding": str(query_embedding), "top_k": top_k}

        # agrega filtros opcionales segun lo que detectó m2
        if country:
            query_sql += " AND country = :country"
            params["country"] = country

        if doc_type:
            query_sql += " AND doc_type = :doc_type"
            params["doc_type"] = doc_type

        # if category:
        #     query_sql += " AND category = :category"
        #     params["category"] = category

        # category ya no filtra, se usa despues como boost en el ranking
        # trae mas candidatos de los necesarios para tener margen al aplicar el boost
        candidates_to_fetch = top_k * 3
        params["candidates_to_fetch"] = candidates_to_fetch
        
        query_sql += " ORDER BY similarity_score DESC LIMIT :top_k"

        db = next(get_db())
        try:
            rows = db.execute(text(query_sql), params).fetchall()

            chunks = []
            for row in rows:
                chunks.append(RetrievedChunk(
                    chunk_id=str(row.id),
                    content=row.content,
                    similarity_score=float(row.similarity_score),
                    page_title=row.page_title,
                    category=row.category,
                    doc_type=row.doc_type,
                ))

            logger.info(f"busqueda completada chunks: {len(chunks)}")
            return chunks

        except Exception as e:
            logger.error(f"error al buscar chunks: {e}")
            return []

        finally:
            db.close()