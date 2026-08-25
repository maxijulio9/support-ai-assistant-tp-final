# MODULO 7: InternalAPI, guarda la configuracion de proyectos en la bd relacional

import logging
from sqlalchemy import text
from app.core.database import get_db
from app.modules.internal_api.schemas import ProjectThresholds, ProjectStatusMapping

logger = logging.getLogger(__name__)


class ProjectConfigService:

    # metodo principal, valida y persiste la config completa de un proyecto
    def save_config(self, thresholds: ProjectThresholds, status_mappings: list[ProjectStatusMapping]) -> int:
        self._validate_mappings(status_mappings)

        db = next(get_db())

        try:
            self._update_thresholds(db, thresholds)

            for mapping in status_mappings:
                self._upsert_status_mapping(db, mapping)

            db.commit()
            logger.info(f"configuracion guardada para el proyecto {thresholds.project_id}")

            return len(status_mappings)

        except Exception as e:
            db.rollback()
            logger.error(f"error al guardar configuracion del proyecto {thresholds.project_id}: {e}")
            raise

        finally:
            db.close()

    # valida que cada mapeo tenga los campos obligatorios completos, segun CU27 paso 5
    def _validate_mappings(self, status_mappings: list[ProjectStatusMapping]):
        for mapping in status_mappings:
            if not mapping.project_id or not mapping.status_id:
                raise ValueError("cada mapeo necesita project_id y status_id")

    # actualiza los umbrales de decision en la tabla project
    def _update_thresholds(self, db, thresholds: ProjectThresholds):
        query = text("""
            UPDATE project
            SET threshold_auto_publish = :threshold_auto_publish,
                threshold_needs_review = :threshold_needs_review,
                similarity_threshold = :similarity_threshold
            WHERE id = :project_id
        """)

        db.execute(query, {
            "project_id": thresholds.project_id,
            "threshold_auto_publish": thresholds.threshold_auto_publish,
            "threshold_needs_review": thresholds.threshold_needs_review,
            "similarity_threshold": thresholds.similarity_threshold,
        })

    # inserta el mapeo proyecto + estado, o lo actualiza si ya existia
    def _upsert_status_mapping(self, db, mapping: ProjectStatusMapping):
        query = text("""
            INSERT INTO project_config (project_id, status_id, system_action, is_active)
            VALUES (:project_id, :status_id, :system_action, :is_active)
            ON CONFLICT (project_id, status_id)
            DO UPDATE SET system_action = :system_action, is_active = :is_active
        """)

        db.execute(query, {
            "project_id": mapping.project_id,
            "status_id": mapping.status_id,
            "system_action": mapping.system_action,
            "is_active": mapping.is_active,
        })