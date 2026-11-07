# guarda chunks vectorizados en la tabla knowledge_chunk en bd vector

import logging
from sqlalchemy import text
from app.modules.knowledge_indexer.schemas import ExtractedPage

logger = logging.getLogger(__name__)


class ChunkStorage:

    # almacanea un chunk ya vectorizado en la bd
    # si la pagina ya se indexo antes (mismo page_id y chunk_index), actualiza en vez de duplicar
    def save_chunk(self, db, pagina: ExtractedPage, chunk_texto: str, embedding: list[float], chunk_index: int, total_chunks: int):
        query = text("""
        INSERT INTO knowledge_chunk (
            content, embedding, source, space_key, page_id, page_title,
            chunk_index, total_chunks, category, country, doc_type
        )
        VALUES (
            :content, :embedding, :source, :space_key, :page_id, :page_title,
            :chunk_index, :total_chunks, :category, :country, :doc_type
        )
        ON CONFLICT (page_id, chunk_index)
        DO UPDATE SET
            content = :content,
            page_title = :page_title,
            space_key = :space_key,
            embedding = :embedding,
            total_chunks = :total_chunks,
            category = :category,
            country = :country,
            doc_type = :doc_type,
            updated_at = NOW()
        """)
        db.execute(query, {
            "content": chunk_texto,
            "embedding": embedding,
            "source": "confluence",
            "space_key": pagina.space_key,
            "page_id": pagina.page_id,
            "page_title": pagina.page_title,
            "chunk_index": chunk_index,
            "total_chunks": total_chunks,
            "category": pagina.category,
            "country": pagina.country,
            "doc_type": pagina.doc_type,
        })


    # borra los chunks que quedaron de mas cuando una pagina se acorto, los de indice mayor o igual al total nuevo
    # se llama dentro de la misma transaccion que el guardado, antes del commit
    def delete_stale_chunks(self, db, page_id: str, total_chunks: int) -> int:
        result = db.execute(
            text("DELETE FROM knowledge_chunk WHERE page_id = :page_id AND chunk_index >= :total_chunks"),
            {"page_id": page_id, "total_chunks": total_chunks},
        )
        deleted = result.rowcount or 0

        if deleted:
            logger.info(f"pagina {page_id}: se borraron {deleted} chunks obsoletos")

        return deleted
