# guarda chunks vectorizados en la tabla knowledge_chunk en bd vector

import logging
from sqlalchemy import text
from app.modules.knowledge_indexer.schemas import ExtractedPage

logger = logging.getLogger(__name__)


class ChunkStorage:

    # almacanea un chunk ya vectorizado en la bd
    def save_chunk(self, db, pagina: ExtractedPage, chunk_texto: str, embedding: list[float], chunk_index: int, total_chunks: int):
        query = text("""
            INSERT INTO knowledge_chunk (
                content, embedding, source, space_key, page_id, page_title,
                chunk_index, total_chunks
            )
            VALUES (
                :content, :embedding, :source, :space_key, :page_id, :page_title,
                :chunk_index, :total_chunks
            )
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
        })