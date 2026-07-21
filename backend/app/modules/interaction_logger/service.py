# M6: InteractionLogger, persiste el resultado del pipeline en la bd relacional

import logging
from sqlalchemy import text
from app.core.database import get_db
from app.modules.ticket_analyzer.schemas import TicketAnalysis

logger = logging.getLogger(__name__)


class InteractionLogger:

    # persiste el resultado completo del analisis de m2
    def log_analysis(self, analysis: TicketAnalysis):
        db = next(get_db())

        try:
            ticket_id = self._get_or_create_ticket(db, analysis)
            system_event_id = self._log_system_event(db, ticket_id, analysis.event_type)

            category_id = self._find_catalog_id(db, "ticket_category", analysis.category)
            priority_id = self._find_catalog_id(db, "ticket_priority", analysis.priority)
            sentiment_id = self._find_catalog_id(db, "sentiment_type", analysis.sentiment)

            # crea la query 
            insert_query = text("""
                INSERT INTO interaction (
                    ticket_id, system_event_id, category_id, priority_id, sentiment_id,
                    text_input, detected_intent, info_sufficient
                )
                VALUES (
                    :ticket_id, :system_event_id, :category_id, :priority_id, :sentiment_id,
                    :text_input, :detected_intent, :info_sufficient
                )
            """)
            
            # ejecuta la query y obtiene el id del ticket creado
            db.execute(insert_query, {
                "ticket_id": ticket_id,
                "system_event_id": system_event_id,
                "category_id": category_id,
                "priority_id": priority_id,
                "sentiment_id": sentiment_id,
                "text_input": analysis.summary,
                "detected_intent": analysis.intent,
                "info_sufficient": analysis.info_sufficient,
            })

            db.commit()
            logger.info(f"[{analysis.issue_key}] interaccion persistida correctamente")

        except Exception as e:
            db.rollback()
            logger.error(f"[{analysis.issue_key}] error al persistir interaccion: {e}")

        finally:
            db.close()

    # busca el id de un registro en una tabla de catalogo por su code
    # devuelve None si no lo encuentra, sin romper el flujo
    def _find_catalog_id(self, db, table_name: str, code: str) -> str | None:
        if not code:
            return None

        query = text(f"SELECT id FROM {table_name} WHERE code = :code")
        result = db.execute(query, {"code": code}).fetchone()

        if not result:
            logger.warning(f"code '{code}' no encontrado en tabla '{table_name}'")
            return None

        return str(result.id)

    # busca un ticket existente por issue_key, si no existe lo crea
    def _get_or_create_ticket(self, db, analysis: TicketAnalysis) -> str:
        query = text("SELECT id FROM ticket WHERE issue_key = :issue_key")
        result = db.execute(query, {"issue_key": analysis.issue_key}).fetchone()

        if result:
            return str(result.id)

        # aca como no existe, lo crea
        country_id = self._find_catalog_id(db, "country", analysis.country)
        priority_id = self._find_catalog_id(db, "ticket_priority", analysis.priority)
        category_id = self._find_catalog_id(db, "ticket_category", analysis.category)

        insert_query = text("""
            INSERT INTO ticket (issue_key, summary, country_id, priority_id, category_id)
            VALUES (:issue_key, :summary, :country_id, :priority_id, :category_id)
            RETURNING id
        """)

        result = db.execute(insert_query, {
            "issue_key": analysis.issue_key,
            "summary": analysis.summary,
            "country_id": country_id,
            "priority_id": priority_id,
            "category_id": category_id,
        }).fetchone()

        return str(result.id)

    # registra el evento crudo que disparo este ciclo de procesamiento
    def _log_system_event(self, db, ticket_id: str, event_type: str) -> str:
        insert_query = text("""
            INSERT INTO system_event (ticket_id, webhook_event, processing_status)
            VALUES (:ticket_id, :webhook_event, :processing_status)
            RETURNING id
        """)

        result = db.execute(insert_query, {
            "ticket_id": ticket_id,
            "webhook_event": event_type,
            "processing_status": "processed",
        }).fetchone()

        return str(result.id)

    