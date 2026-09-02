#Modulo 7: InternalAPI
#Endpoints de configuracion de proyectos, consumidos por el dashboard


import httpx
from fastapi import APIRouter, HTTPException
from app.modules.internal_api.schemas import (
    ProjectConfigRequest,
    ProjectConfigResponse,
    ApproveRequest,
    RegenerateRequest,
    EscalateRequest,
    InteractionReviewResponse,
    ItsmConnectionRequest,
    ItsmConnectionResponse,
    AvailableProjectsResponse,
    CountriesResponse,
    ProjectStatusesResponse,
    FieldOptionsResponse,
    ConfigureCategoriesRequest,
    ConfigureCategoriesResponse,
)
from app.modules.internal_api.service import ProjectConfigService
from app.modules.internal_api.interaction_review_service import InteractionReviewService
from app.modules.internal_api.itsm_connection_service import ItsmConnectionService
from app.modules.internal_api.itsm_project_onboarding_service import ItsmProjectOnboardingService
from app.modules.internal_api.schemas import OnboardProjectsRequest, OnboardProjectsResponse
from app.modules.internal_api.country_repository import CountryRepository
from app.modules.internal_api.itsm_status_mapping_service import ItsmStatusMappingService
from app.modules.internal_api.schemas import SelectFieldsResponse


router = APIRouter(tags=["InternalAPI"])

# instancia unica del servicio para toda la aplicacion
_service = ProjectConfigService()
_review_service = InteractionReviewService()
_itsm_connection_service = ItsmConnectionService()
_project_onboarding_service = ItsmProjectOnboardingService()
_country_repository = CountryRepository()
_status_mapping_service = ItsmStatusMappingService()


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

# configura la conexion con jsm, valida las credenciales antes de guardarlas
@router.post("/api/config/itsm", response_model=ItsmConnectionResponse)
async def configure_itsm_connection(request: ItsmConnectionRequest):
    try:
        await _itsm_connection_service.configure_connection(
            request.base_url, request.user_email, request.api_token, request.webhook_secret
        )
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=400, detail="Las credenciales de JSM no son validas")
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="No se pudo conectar con JSM")
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo guardar la configuracion")

    return ItsmConnectionResponse(status="ok")

# lista los proyectos reales disponibles en jsm
@router.get("/api/config/itsm/projects/available", response_model=AvailableProjectsResponse)
async def list_available_projects():
    try:
        projects = await _project_onboarding_service.list_available_projects()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar JSM")

    return AvailableProjectsResponse(projects=projects)


# da de alta los proyectos que el admin eligio de la lista disponible
@router.post("/api/config/itsm/projects/onboard", response_model=OnboardProjectsResponse)
async def onboard_projects(request: OnboardProjectsRequest):
    try:
        projects_created = _project_onboarding_service.onboard_projects(request.projects)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo dar de alta los proyectos")

    return OnboardProjectsResponse(status="ok", projects_created=projects_created)

# lista los paises validos del catalogo, para el dropdown del frontend
@router.get("/api/config/countries", response_model=CountriesResponse)
async def list_countries():
    countries = _country_repository.list_countries()
    return CountriesResponse(countries=countries)

# trae los estados reales de un proyecto de jsm, para que el admin arme el mapeo
@router.get("/api/config/itsm/projects/{project_key}/statuses", response_model=ProjectStatusesResponse)
async def list_project_statuses(project_key: str):
    try:
        statuses = await _status_mapping_service.list_project_statuses(project_key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar los estados de JSM")

    return ProjectStatusesResponse(statuses=statuses)

# lista los campos custom de jsm de tipo lista de seleccion unica, para elegir cual representa categoria
@router.get("/api/config/itsm/fields", response_model=SelectFieldsResponse)
async def list_select_fields():
    try:
        fields = await _project_onboarding_service.list_select_fields()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar JSM")

    return SelectFieldsResponse(fields=fields)

# trae las opciones reales de un campo elegido por el admin
@router.get("/api/config/itsm/fields/{field_id}/options", response_model=FieldOptionsResponse)
async def list_field_options(field_id: str):
    try:
        options = await _project_onboarding_service.list_field_options(field_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar JSM")

    return FieldOptionsResponse(options=options)


# confirma las categorias que el admin eligio para su proyecto
@router.post("/api/config/itsm/projects/{project_key}/categories", response_model=ConfigureCategoriesResponse)
async def configure_categories(project_key: str, request: ConfigureCategoriesRequest):
    try:
        categories_configured = _project_onboarding_service.configure_categories(project_key, request.categories)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo configurar las categorias")

    return ConfigureCategoriesResponse(status="ok", categories_configured=categories_configured)