# genera embeddings de texto usando el modelo de openai
# se usa siempre openai para embeddings, independiente del llm_provider elegido en m2
# esto es necesario para que los vectores sean compatibles entre si en pgvector

import logging
from openai import OpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)


class EmbeddingClient:

    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_embedding_model

    # genera el vector numerico que representa el texto dado
    def generate_embedding(self, texto: str) -> list[float]:
        response = self.client.embeddings.create(
            model=self.model,
            input=texto,
        )

        # la respuesta trae una lista de resultados, tomamos el primero
        primer_resultado = response.data[0]

        # el vector esta dentro del campo embedding
        vector = primer_resultado.embedding

        return vector