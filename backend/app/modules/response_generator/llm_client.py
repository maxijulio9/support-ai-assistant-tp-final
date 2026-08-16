# M4 ResponseGenerator
# cliente que genera la respuesta final usando el llm configurado

import logging
import json
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
        
        
    # evalua que tan fundamentada esta la respuesta en el contexto, usando schema estricto
    # el schema garantiza el tipo y la forma del json, no hace falta reintentar por json invalido
    def evaluate_confidence(self, prompt: str) -> float:
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "confidence_evaluation",
                        "strict": True,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "confidence_score": {"type": "number"}
                            },
                            "required": ["confidence_score"],
                            "additionalProperties": False,
                        },
                    },
                },
                temperature=0,
            )

            content = response.choices[0].message.content
            data = json.loads(content)
            score = float(data["confidence_score"])

            # clamp defensivo, el schema garantiza el tipo pero no el rango
            score = max(0.0, min(1.0, score))

            logger.info(f"confidence_score evaluado: {score}")
            return score

        except Exception as e:
            logger.error(f"error al evaluar confianza de la respuesta: {e}")
            return 0.0
        
        
    # chequea si el contexto alcanza para responder, antes de generar la respuesta completa
    # si falla por un error de infraestructura, devuelve false por seguridad, mismo criterio que evaluate_confidence
    def check_context_sufficiency(self, prompt: str) -> bool:
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "sufficiency_check",
                        "strict": True,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "sufficient": {"type": "boolean"}
                            },
                            "required": ["sufficient"],
                            "additionalProperties": False,
                        },
                    },
                },
                temperature=0,
            )

            content = response.choices[0].message.content
            data = json.loads(content)
            is_sufficient = bool(data["sufficient"])

            logger.info(f"chequeo de suficiencia de contexto: {is_sufficient}")
            return is_sufficient

        except Exception as e:
            logger.error(f"error al chequear suficiencia de contexto: {e}")
            return False