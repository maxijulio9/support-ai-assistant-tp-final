# cliente para clasificar tickets usando OpenAI
# arma el prompt, llama a la api, parsea y valida la respuesta

import json
import logging
from openai import OpenAI
from app.core.config import settings
from app.modules.ticket_analyzer.schemas import ClassificationResult, ConversationTurn

logger = logging.getLogger(__name__)

# categorias validas del negocio de tokenia
# esto se va aparamaetrizar, de project_config cuando exista CU26
VALID_CATEGORIES = [
    "seguridad_cuenta",
    "acceso_autenticacion",
    "depositos_retiros",
    "operaciones_crypto",
    "operaciones_fiat",
    "verificacion_identidad",
    "billetera_direcciones",
    "limites_restricciones",
    "problemas_tecnicos",
    "tarifas_comisiones",
    "informacion_general",
]

# intents validos 
VALID_INTENTS = [
    "reporte_problema",
    "consulta_informativa",
    "solicitud_accion",
    "reclamo",
    "cancelacion",
]

# niveles de impacto y urgencia segun ITIL, universales, no dependen del negocio
VALID_IMPACT_LEVELS = ["Critical", "High", "Medium", "Low"]
VALID_URGENCY_LEVELS = ["Critical", "High", "Medium", "Low"]

# prompt que se le envia al llm para clasificar el ticket
CLASSIFICATION_PROMPT = """Sos un agente de soporte nivel 1. Tu tarea es clasificar la siguiente solicitud de soporte.
Devolvé UNICAMENTE un JSON con estos 7 campos, sin texto adicional:
{{
  "category": una de estas categorias: {categories},
  "intent": uno de estos intents: {intents},
  "resolved_by": "L1" si se puede resolver con informacion de la base de conocimiento, "L2" si requiere intervencion humana especializada, "MISSING_INFO" si falta informacion para resolver,
  "scope": "IN_SCOPE" si la consulta esta dentro del alcance del soporte, "OUT_OF_SCOPE" si no tiene relacion con los servicios,
  "sentiment": "positivo", "negativo" o "neutro" segun el tono del usuario,
  "impact": uno de estos niveles: {impact_levels}, segun cuanto del negocio afecta este problema (cuantos usuarios, si es un servicio critico, riesgo financiero o de seguridad),
  "urgency": uno de estos niveles: {urgency_levels}, segun que tan rapido hay que resolverlo
}}

Solicitud del usuario:
{ticket_text}
"""



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
    # def __init__(self):
    #     self.client = OpenAI(api_key=settings.openai_api_key)
    #     self.model = settings.openai_llm_model


    # crea el prompt con el texto del ticket 
    def _build_prompt(self, text: str, conversation_history: list[ConversationTurn] = []) -> str:
        prompt = CLASSIFICATION_PROMPT.format(
            categories=", ".join(VALID_CATEGORIES),
            intents=", ".join(VALID_INTENTS),
            impact_levels= ", ".join(VALID_IMPACT_LEVELS),
            urgency_levels= ", ".join(VALID_URGENCY_LEVELS),
            ticket_text=text,
        )

        # si hay historial previo lo agrega al prompt para dar contexto
        if conversation_history:
            historial_texto = "\n".join(
                [f"{turno.role}: {turno.content}" for turno in conversation_history]
            )
            prompt += f"\n\nHistorial previo de la conversacion:\n{historial_texto}"

        return prompt

    # llama al llm y parsea la respuesta como ClassificationResult
    # reintenta hasta 2 veces si el json es invalido
    def classify(self, text: str, conversation_history: list[ConversationTurn] = []) -> ClassificationResult | None:
        prompt = self._build_prompt(text, conversation_history)

        for attempt in range(3):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.1,
                )

                content = response.choices[0].message.content
                data = json.loads(content)

                finish_reason = response.choices[0].finish_reason

                logger.info(
                    f"llm respondio: model={response.model}, "
                    f"tokens={response.usage.total_tokens}, "
                    f"finish_reason={finish_reason}"
                )

                if finish_reason == "length":
                    logger.warning("la respuesta del llm se corto por limite de tokens")


                # valida que category e intent sean valores conocidos
                if data.get("category") not in VALID_CATEGORIES:
                    logger.warning(f"category '{data.get('category')}' no valida, reintentando ({attempt + 1}/3)")
                    continue

                if data.get("intent") not in VALID_INTENTS:
                    logger.warning(f"intent '{data.get('intent')}' no valido, reintentando ({attempt + 1}/3)")
                    continue
                if data.get("impact") not in VALID_IMPACT_LEVELS:
                    logger.warning(f"impact '{data.get('impact')}' no valido, reintentando ({attempt + 1}/3)")
                    continue    
                
                if data.get("urgency") not in VALID_URGENCY_LEVELS:
                    logger.warning(f"urgency '{data.get('urgency')}' no valido, reintentando ({attempt + 1}/3)")
                    continue
                


                result = ClassificationResult(
                    category=data["category"],
                    intent=data["intent"],
                    resolved_by=data.get("resolved_by", "L1"),
                    scope=data.get("scope", "IN_SCOPE"),
                    impact=data.get("impact", "medium"),
                    urgency=data.get("urgency", "medium"),
                    sentiment=data.get("sentiment", "neutro"),
                )

                logger.info(f"clasificacion exitosa: category={result.category}, intent={result.intent}")
                return result

            except json.JSONDecodeError as e:
                logger.warning(f"json invalido del llm, reintentando ({attempt + 1}/3): {e}")
                continue

            except Exception as e:
                logger.error(f"error al llamar a openai: {e}")
                return None

        logger.error(f"no se pudo clasificar despues de 3 intentos")
        return None