#Modulo 7: InternalAPI
#Endpoints de configuracion de proyectos, consumidos por el dashboard


from fastapi import APIRouter, HTTPException
from app.modules.internal_api.schemas import (
    ProjectConfigRequest,
    ProjectConfigResponse,
    ApproveRequest,
    RegenerateRequest,
    EscalateRequest,
    InteractionReviewResponse,
)
from app.modules.internal_api.service import ProjectConfigService
from app.modules.internal_api.interaction_review_service import InteractionReviewService

router = APIRouter(tags=["InternalAPI"])

# instancia unica del servicio para toda la aplicacion
_service = ProjectConfigService()
_review_service = InteractionReviewService()

# configura los umbrales y el mapeo de estados de un proyecto
@router.post("/api/config/itsm/projects", response_model=ProjectConfigResponse)
async def configure_project(request: ProjectConfigRequest):
    try:
        mappings_configured = _service.save_config(request.thresholds, request.status_mappings)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo persistir la configuracion")

    return ProjectConfigResponse(status="ok", mappings_configured=mappings_configured)


# aprueba una interaccion en needs_review, publica la respuesta tal cual esta
@router.post("/api/interactions/{interaction_id}/approve", response_model=InteractionReviewResponse)
async def approve_interaction(interaction_id: str, request: ApproveRequest):
    try:
        action_type = await _review_service.approve_interaction(interaction_id, request.reviewed_by)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo aprobar la interacción")

    return InteractionReviewResponse(status="ok", action_type=action_type)


# regenera una interaccion rechazada, con el motivo del rechazo
@router.post("/api/interactions/{interaction_id}/regenerate", response_model=InteractionReviewResponse)
async def regenerate_interaction(interaction_id: str, request: RegenerateRequest):
    try:
        action_type = await _review_service.regenerate_interaction(interaction_id, request.rejection_reason, request.reviewed_by)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo regenerar la interacción")

    return InteractionReviewResponse(status="ok", action_type=action_type)


# escala una interaccion directo a un humano, sin generar nada nuevo
@router.post("/api/interactions/{interaction_id}/escalate", response_model=InteractionReviewResponse)
async def escalate_interaction(interaction_id: str, request: EscalateRequest):
    try:
        action_type = _review_service.escalate_interaction(interaction_id, request.rejection_reason, request.reviewed_by)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo escalar la interacción")

    return InteractionReviewResponse(status="ok", action_type=action_type)
