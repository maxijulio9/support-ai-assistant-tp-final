# MODULO 7: InternalAPI, guarda la configuracion de proyectos en la bd relacional

import logging
from sqlalchemy import text
from app.core.database import get_db
from app.modules.internal_api.schemas import ProjectThresholds, ProjectStatusMapping
from app.core.jsm_status_actions import CONFIGURABLE_STATUS_ACTIONS

logger = logging.getLogger(__name__)


class ProjectConfigService:

    # metodo principal, valida y persiste la config completa de un proyecto
    # el proyecto se identifica con project_key (el code de la tabla project) o con project_id (el uuid interno)
    # si vienen los dos tienen que corresponder al mismo proyecto
    def save_config(self, thresholds: ProjectThresholds, status_mappings: list[ProjectStatusMapping], project_key: str | None = None) -> int:
        self._validate_mappings(status_mappings)

        db = next(get_db())
        project_id = thresholds.project_id

        try:
            project_id = self._resolve_project_id(db, thresholds.project_id, project_key)
            self._validate_same_project(status_mappings, project_id)

            self._update_thresholds(db, thresholds.model_copy(update={"project_id": project_id}))

            for mapping in status_mappings:
                self._upsert_status_mapping(db, mapping.model_copy(update={"project_id": project_id}))

            db.commit()
            logger.info(f"configuracion guardada para el proyecto {project_id}")

            return len(status_mappings)

        except Exception as e:
            db.rollback()
            logger.error(f"error al guardar configuracion del proyecto {project_id}: {e}")
            raise

        finally:
            db.close()

    # valida que cada mapeo tenga los campos obligatorios completos, segun CU27 paso 5
    # el project_id de un mapeo puede faltar, se completa con el del proyecto resuelto, pero no puede venir vacio
    def _validate_mappings(self, status_mappings: list[ProjectStatusMapping]):
        for mapping in status_mappings:
            if mapping.project_id == "" or not mapping.status_id:
                raise ValueError("cada mapeo necesita project_id y status_id")

            # la accion tiene que ser del vocabulario que lee el pipeline, si no el mapeo se guardaria y nunca se usaria
            if mapping.system_action is not None and mapping.system_action not in CONFIGURABLE_STATUS_ACTIONS:
                valid_values = ", ".join(CONFIGURABLE_STATUS_ACTIONS)
                raise ValueError(f"system_action '{mapping.system_action}' no es valido, los valores validos son: {valid_values}")

    # resuelve el id interno del proyecto a partir de project_key o de project_id
    # con project_key consulta la tabla project, con solo project_id lo devuelve tal cual, igual que antes
    def _resolve_project_id(self, db, project_id: str | None, project_key: str | None) -> str:
        if project_key:
            row = db.execute(text("SELECT id FROM project WHERE code = :code"), {"code": project_key}).fetchone()

            if row is None:
                raise ValueError(f"project_key '{project_key}' no existe")

            resolved_id = str(row.id)

            if project_id and project_id != resolved_id:
                raise ValueError("project_id y project_key no corresponden al mismo proyecto")

            return resolved_id

        if not project_id:
            raise ValueError("hay que indicar project_key o project_id")

        return project_id

    # valida que los mapeos que traen project_id sean del mismo proyecto que los umbrales
    def _validate_same_project(self, status_mappings: list[ProjectStatusMapping], project_id: str):
        for mapping in status_mappings:
            if mapping.project_id is not None and mapping.project_id != project_id:
                raise ValueError("todos los mapeos tienen que ser del mismo proyecto")

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
