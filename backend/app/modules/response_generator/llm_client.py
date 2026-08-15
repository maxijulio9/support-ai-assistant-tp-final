# M4 - ResponseGenerator
# cliente que genera la respuesta final usando el llm configurado

import logging
from openai import OpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)


class LlmClient:

    def __init__(self):
        if settings.llm_provider == "gemini":
            api_key = settings.gemini_api_key
            base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"
            model = settings.gemini_llm_model
        else:
            api_key = settings.openai_api_key
            base_url = "https://api.openai.com/v1"
            model = settings.openai_llm_model

        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.model = model

    # genera el texto de la respuesta a partir del prompt ya armado por prompt_builder
    def generate_response(self, prompt: str) -> str:
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"error al llamar al llm para generar respuesta: {e}")
            return None