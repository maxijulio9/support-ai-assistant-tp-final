#Modulo 7: InternalAPI
#Endpoints de configuracion de proyectos, consumidos por el dashboard


from fastapi import APIRouter, HTTPException
from app.modules.internal_api.schemas import ProjectConfigRequest, ProjectConfigResponse
from app.modules.internal_api.service import ProjectConfigService

router = APIRouter(tags=["InternalAPI"])

# instancia unica del servicio para toda la aplicacion
_service = ProjectConfigService()

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