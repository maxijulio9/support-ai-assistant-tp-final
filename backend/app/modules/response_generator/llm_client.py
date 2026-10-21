# M4 ResponseGenerator
# cliente que genera la respuesta final usando el llm configurado

import logging
import json
from openai import OpenAI
from app.core.config import settings
from app.core.llm_config import get_llm_config

logger = logging.getLogger(__name__)


class LlmClient:

    def __init__(self):
        self.client = None
        self.model = None
        self._signature = None
        self._refresh()

    # vuelve a leer la configuracion efectiva y reconstruye el cliente solo si cambio la clave, la url o el modelo
    # se llama al empezar cada metodo publico, asi un cambio guardado desde el dashboard se aplica sin reiniciar el servicio
    def _refresh(self):
        config = get_llm_config()
        signature = (config.api_key, config.base_url, config.chat_model)

        if signature != self._signature:
            self.client = OpenAI(api_key=config.api_key, base_url=config.base_url)
            self.model = config.chat_model
            self._signature = signature

    # genera el texto de la respuesta a partir del prompt ya armado por prompt_builder
    def generate_response(self, prompt: str) -> str:
        self._refresh()
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
        self._refresh()
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
        self._refresh()
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