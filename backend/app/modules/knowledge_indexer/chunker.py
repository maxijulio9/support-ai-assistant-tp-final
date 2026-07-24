# divide texto largo en fragmentos mas chicos para generar embeddings

from langchain_text_splitters import RecursiveCharacterTextSplitter


class TextChunker:

    # divide el texto en fragmentos respetando parrafo, linea, oracion  y palabra
    def chunk_text(self, texto: str, chunk_size: int = 512, chunk_overlap: int = 50) -> list[str]:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        return splitter.split_text(texto)