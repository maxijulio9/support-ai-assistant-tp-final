# M6: InteractionLogger, persiste el resultado del pipeline en la bd relacional

import logging
from sqlalchemy import text
from app.core.database import get_db
from app.modules.ticket_analyzer.schemas import TicketAnalysis

logger = logging.getLogger(__name__)


class InteractionLogger:

    # metodo principal, recibe el resultado de m2 y lo guarda en la bd
    def log_analysis(self, analysis: TicketAnalysis):
        db = next(get_db())

        try:
            # busca o crea el ticket en la bd
            ticket_id = self._get_or_create_ticket(db, analysis)

            # registra que llego un evento nuevo para este ticket
            system_event_id = self._log_system_event(db, ticket_id, analysis.event_type)

            # busca los ids de las tablas de referencia (catalogo)
            category_id = self._find_catalog_id(db, "ticket_category", analysis.category)
            priority_id = self._find_catalog_id(db, "ticket_priority", analysis.priority)
            sentiment_id = self._find_catalog_id(db, "sentiment_type", analysis.sentiment)

            # el texto analizado es el ultimo turno del historial conversacional
            # si no hay historial, usa el summary como respaldo
            if analysis.conversation_history:
                ultimo_turno = analysis.conversation_history[-1]
                text_input = ultimo_turno.content
            else:
                text_input = analysis.summary


            # guarda el resultado del analisis en la tabla interaction
            query = text("""
                INSERT INTO interaction (
                    ticket_id, system_event_id, category_id, priority_id, sentiment_id,
                    text_input, detected_intent, info_sufficient
                )
                VALUES (
                    :ticket_id, :system_event_id, :category_id, :priority_id, :sentiment_id,
                    :text_input, :detected_intent, :info_sufficient
                )
            """)

            db.execute(query, {
                "ticket_id": ticket_id,
                "system_event_id": system_event_id,
                "category_id": category_id,
                "priority_id": priority_id,
                "sentiment_id": sentiment_id,
                # "text_input": analysis.summary,
                "text_input": text_input,
                "detected_intent": analysis.intent,
                "info_sufficient": analysis.info_sufficient,
            })

            # confirma todos los cambios juntos
            db.commit()
            logger.info(f"[{analysis.issue_key}] interaccion guardada correctamente")

        except Exception as e:
            # si algo fallo, deshace todos los cambios de este intento
            db.rollback()
            logger.error(f"[{analysis.issue_key}] error al guardar interaccion: {e}")

        finally:
            # cierra la conexion siempre, haya funcionado o no
            db.close()

    # busca el ticket por issue_key, si no existe lo crea
    def _get_or_create_ticket(self, db, analysis: TicketAnalysis) -> str:
        query = text("SELECT id FROM ticket WHERE issue_key = :issue_key")
        row = db.execute(query, {"issue_key": analysis.issue_key}).fetchone()

        if row:
            # el ticket ya existe, devuelve su id
            return str(row.id)

        # el ticket no existe, busca los ids de los catalogos para crearlo
        country_id = self._find_catalog_id(db, "country", analysis.country)
        priority_id = self._find_catalog_id(db, "ticket_priority", analysis.priority)
        category_id = self._find_catalog_id(db, "ticket_category", analysis.category)

        insert_query = text("""
            INSERT INTO ticket (issue_key, summary, country_id, priority_id, category_id)
            VALUES (:issue_key, :summary, :country_id, :priority_id, :category_id)
            RETURNING id
        """)

        row = db.execute(insert_query, {
            "issue_key": analysis.issue_key,
            "summary": analysis.summary,
            "country_id": country_id,
            "priority_id": priority_id,
            "category_id": category_id,
        }).fetchone()

        return str(row.id)

    # crea un registro nuevo en system_event cada vez que llega un evento
    def _log_system_event(self, db, ticket_id: str, event_type: str) -> str:
        query = text("""
            INSERT INTO system_event (ticket_id, webhook_event, processing_status)
            VALUES (:ticket_id, :webhook_event, :processing_status)
            RETURNING id
        """)

        row = db.execute(query, {
            "ticket_id": ticket_id,
            "webhook_event": event_type,
            "processing_status": "processed",
        }).fetchone()

        return str(row.id)

    # busca el id de un registro en una tabla de referencia (catalogo) por su code
    # devuelve None si no lo encuentra, sin romper el flujo
    def _find_catalog_id(self, db, table_name: str, code: str) -> str | None:
        if not code:
            return None

        query = text(f"SELECT id FROM {table_name} WHERE code = :code")
        row = db.execute(query, {"code": code}).fetchone()

        if not row:
            logger.warning(f"code '{code}' no encontrado en tabla '{table_name}'")
            return None

        return str(row.id)