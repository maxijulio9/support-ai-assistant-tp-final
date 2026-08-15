# M4 ResponseGenerator
# crea el prompt final que se le manda al llm para generar la respuesta

from app.modules.ticket_analyzer.schemas import TicketAnalysis
from app.modules.knowledge_retriever.schemas import RetrievalResult


SYSTEM_PROMPT = """Sos un agente de soporte nivel 1 de una plataforma financiera. Tu tarea es responder la consulta del usuario basandote UNICAMENTE en el contexto de la base de conocimiento que se te provee abajo.

                Reglas estrictas:
                - No inventes datos especificos del caso, como montos, fechas o numeros de operacion, que no esten en el contexto.
                - Si el contexto no alcanza para responder con seguridad, decilo de forma directa: "No tengo informacion suficiente para resolver esto, un agente se va a poner en contacto".
                - Si dos fragmentos del contexto se contradicen entre si, priorizá el mas especifico a la categoria del ticket y avisá de la ambiguedad en tu respuesta.
                - No menciones "el contexto", "la base de conocimiento" ni terminos tecnicos internos, escribi como si supieras la respuesta directamente.
                - Se conciso, una respuesta de soporte no deberia superar los 3 parrafos cortos.
                - Respondé siempre en español, con un tono profesional y cordial."""




CONFIDENCE_PROMPT = """Tu tarea es evaluar si la respuesta generada esta fundamentada exclusivamente en el contexto proporcionado.

                    <context>
                    {context}
                    </context>

                    <response>
                    {response_text}
                    </response>

                    Asigná un confidence_score entre 0 y 1 que represente que tan correctamente esta respaldada la respuesta por el contexto.

                    Criterio de evaluacion:
                    - 1.0: toda la informacion relevante esta explicitamente respaldada por el contexto, sin afirmaciones contradictorias.
                    - 0.8-0.99: practicamente toda respaldada, con alguna formulacion menor que no afecta la exactitud.
                    - 0.5-0.79: parcialmente respaldada, contiene informacion relevante que no puede verificarse del todo con el contexto.
                    - 0.1-0.49: una parte importante de la respuesta no esta respaldada por el contexto.
                    - 0.0-0.09: la respuesta contradice el contexto, inventa informacion relevante, o no se basa en el.

                    Reglas:
                    - Evaluá unicamente la relacion entre el contexto y la respuesta, sin conocimiento externo.
                    - No supongas que una afirmacion es verdadera si el contexto no la respalda.
                    - Si la respuesta contradice el contexto, asigná un score muy bajo.
                    """

class PromptBuilder:

    # arma el prompt final combinando el system prompt, los chunks de m3 y el historial
    # el historial ya trae la consulta actual del usuario como ultimo turno, no hace falta agregarla aparte
    def build_prompt(self, analysis: TicketAnalysis, retrieval: RetrievalResult) -> str:
        context_text = self._format_chunks(retrieval.chunks)
        history_text = self._format_history(analysis.conversation_history)

        sections = [
        SYSTEM_PROMPT,
            f"Contexto recuperado de la base de conocimiento:\n{context_text}",
            f"Historial de la conversacion:\n{history_text}",
        ]

        return "\n\n".join(sections)
    
    # arma el prompt para evaluar que tan bien fundamentada esta la respuesta generada
    def build_confidence_prompt(self, retrieval: RetrievalResult, response_text: str) -> str:
        context_text = self._format_chunks(retrieval.chunks)
        return CONFIDENCE_PROMPT.format(context=context_text, response_text=response_text)
    
    # concatena el contenido de los chunks recuperados, numerados
    def _format_chunks(self, chunks) -> str:
        if not chunks:
            return "(sin contexto disponible)"
        return "\n\n".join(f"[{i + 1}] {chunk.content}" for i, chunk in enumerate(chunks))

    # concatena el historial conversacional en formato legible
    def _format_history(self, history) -> str:
        if not history:
            return "(sin historial previo)"
        return "\n".join(f"{turn.role}: {turn.content}" for turn in history)