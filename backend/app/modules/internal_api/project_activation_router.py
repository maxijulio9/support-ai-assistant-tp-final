# M7 InternalAPI: activa y desactiva proyectos, solo para administradores
# desactivar no borra nada: el proyecto deja de procesar tickets y comentarios nuevos y todo lo anterior se conserva

import logging
from fastapi import APIRouter, Depends, HTTPException
from app.modules.auth.dependencies import require_admin
from app.modules.auth.schemas import AppUser
from app.modules.internal_api.schemas import ErrorResponse, ProjectActivationResponse
from app.modules.internal_api.services.project_activation_service import ProjectActivationService

logger = logging.getLogger(__name__)

router = APIRouter()
_service = ProjectActivationService()

ERROR_RESPONSES = {
    400: {"model": ErrorResponse, "description": "El proyecto no existe"},
    503: {"model": ErrorResponse, "description": "No se pudo cambiar el estado del proyecto"},
}


# cambia el estado del proyecto y arma la respuesta, los dos endpoints comparten esta logica
def _change_state(project_key: str, active: bool, admin: AppUser) -> ProjectActivationResponse:
    try:
        result = _service.set_active(project_key, active)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception(f"error al cambiar el estado del proyecto '{project_key}'")
        raise HTTPException(status_code=503, detail="No se pudo cambiar el estado del proyecto")

    logger.info(f"el usuario {admin.id} dejo el proyecto '{project_key}' {'activo' if active else 'desactivado'}")
    return ProjectActivationResponse(**result)


# desactiva un proyecto, deja de procesar tickets y comentarios nuevos y conserva todo lo anterior
@router.post("/api/config/itsm/projects/{project_key}/deactivate", response_model=ProjectActivationResponse, responses=ERROR_RESPONSES)
def deactivate_project(project_key: str, admin: AppUser = Depends(require_admin)):
    return _change_state(project_key, False, admin)


# vuelve a activar un proyecto desactivado, retoma lo que ya tenia configurado
@router.post("/api/config/itsm/projects/{project_key}/activate", response_model=ProjectActivationResponse, responses=ERROR_RESPONSES)
def activate_project(project_key: str, admin: AppUser = Depends(require_admin)):
    return _change_state(project_key, True, admin)
