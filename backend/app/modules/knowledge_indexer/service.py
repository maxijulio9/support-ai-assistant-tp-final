# M10 KnowledgeIndexer: orquesta la extraccion, limpieza y chunking de kb y storage en vector db

import logging
from app.core.database import get_db
from app.modules.knowledge_indexer.client import ConfluenceClient
from app.modules.knowledge_indexer.text_cleaner import TextCleaner
from app.modules.knowledge_indexer.chunker import TextChunker
from app.modules.knowledge_indexer.schemas import ExtractedPage
from app.modules.knowledge_indexer.chunk_storage import ChunkStorage
from app.modules.knowledge_indexer.embedding_client import EmbeddingClient
from app.modules.knowledge_indexer.kb_space_repository import KbSpaceRepository

logger = logging.getLogger(__name__)


class KnowledgeIndexer:

    def __init__(self):
        # self.db = next(get_db())
        self.client = ConfluenceClient()
        self.cleaner = TextCleaner()
        self.chunker = TextChunker()
        self.embedding_client = EmbeddingClient()
        self.storage = ChunkStorage()
        self.space_repo = KbSpaceRepository()

    # extrae category y doc_type desde los labels de ls kb
    # si la pagina no tiene labels, devuelve None en ambos campos - formato harcoreado para probar
    def _extract_metadata_from_labels(self, page_content: dict) -> dict:
        labels = page_content.get("metadata", {}).get("labels", {}).get("results", [])

        category = None
        doc_type = None

        for label in labels:
            nombre = label.get("name", "")
            if nombre.startswith("cat-"):
                category = nombre[4:]
            elif nombre.startswith("type-"):
                doc_type = nombre[5:]

        return {"category": category, "doc_type": doc_type}


    
    # recorre todos los spaces indicados, indexa cada pagina de punta a punta:
    #extrae, limpia, divide en chunks, genera embeddings y persiste en la bd vectorial    def index_spaces(self, space_keys: list[str]):
    def index_spaces(self, space_keys: list[str]):
        paginas = self.extract_pages(space_keys)
        db = next(get_db())

        try:
            for pagina in paginas:
                chunks = self.chunker.chunk_text(pagina.content)
                total_chunks = len(chunks)

                for i, chunk_texto in enumerate(chunks):
                    embedding = self.embedding_client.generate_embedding(chunk_texto)
                    self.storage.save_chunk(db, pagina, chunk_texto, embedding, i, total_chunks)

            db.commit()
            logger.info(f"indexacion completa: {len(paginas)} paginas procesadas")

        except Exception as e:
            db.rollback()
            logger.error(f"error durante la indexacion: {e}")

        finally:
            db.close()


     # recorre todos los spaces indicados y extrae el contenido de cada pagina
    def extract_pages(self, space_keys: list[str]) -> list[ExtractedPage]:
        paginas_extraidas = []

        db = next(get_db())


        try:

            for space_key in space_keys:
                logger.info(f"extrayendo paginas del space {space_key}")

                country_code = self.space_repo.get_country_code(db, space_key)
                pages = self.client.get_pages_from_space(space_key)

                for page in pages:
                    page_id = page["id"]
                    content = self.client.get_page_content(page_id)

                    html = content["body"]["storage"]["value"]
                    texto_plano = self.cleaner.clean_html(html)

                    metadata = self._extract_metadata_from_labels(content)

                    pagina = ExtractedPage(
                        page_id=page_id,
                        page_title=content["title"],
                        space_key=space_key,
                        content=texto_plano,
                        category=metadata["category"],
                        doc_type=metadata["doc_type"],
                        country=country_code,

                    )
                    paginas_extraidas.append(pagina)
        finally:
            db.close()
            
        logger.info(f"extraccion completa, total de paginas: {len(paginas_extraidas)}")
        return paginas_extraidas