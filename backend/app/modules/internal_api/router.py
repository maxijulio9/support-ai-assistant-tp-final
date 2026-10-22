#Modulo 7: InternalAPI
#Endpoints de configuracion de proyectos, consumidos por el dashboard

import httpx
from fastapi import APIRouter, HTTPException, Depends
from app.modules.auth.dependencies import get_current_user, require_admin
from app.modules.auth.schemas import AppUser
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
    ConfigureRequestTypesResponse,
    ProjectRequestTypesResponse,
    ConfigureRequestTypesRequest,
    AvailableRequestTypesResponse,
    OnboardedProjectsResponse,
    ProjectConfigurationResponse,
    ConnectionStatusResponse,
    ConfigurePriorityMappingRequest,
    ConfigurePriorityMappingResponse,
    PrioritiesWithSuggestionResponse,
    OnboardProjectsRequest,
    OnboardProjectsResponse,
    SelectFieldsResponse,
    ConfluenceConnectionRequest,
    ConfluenceConnectionResponse,
    ConfigureSpacesRequest,
    AvailableSpacesResponse,
    ConfigureSpacesResponse,
    StartIndexingRequest,
    StartIndexingResponse,
    IndexingStatusResponse,
    ErrorResponse,
    DiscardRequest,
    LlmConfigResponse,
    LlmModelsRequest,
    LlmModelsResponse,
    SaveLlmConfigRequest,
    SaveLlmConfigResponse,
    MetricsSummaryResponse,
    MetricsByCategoryResponse,
    InteractionListResponse,
    InteractionDetailResponse,
    DailyMetricsResponse,
    ConfidenceDistributionResponse,
    HeatmapResponse,
    ProjectThresholdsResponse,
)
from app.modules.internal_api.services.project_config_service import ProjectConfigService
from app.modules.internal_api.services.interaction_review_service import InteractionReviewService
from app.modules.internal_api.services.itsm_connection_service import ItsmConnectionService
from app.modules.internal_api.services.itsm_project_onboarding_service import ItsmProjectOnboardingService
from app.modules.internal_api.services.itsm_status_mapping_service import ItsmStatusMappingService
from app.modules.internal_api.repositories.country_repository import CountryRepository
from app.modules.internal_api.services.confluence_connection_service import ConfluenceConnectionService
from app.modules.internal_api.services.space_config_service import SpaceConfigurationService
from app.modules.internal_api.services.indexer_trigger_service import IndexingTriggerService
from app.modules.internal_api.repositories.kb_indexing_status_repository import KbIndexingStatusRepository
from app.modules.internal_api.services.interaction_metrics_service import InteractionMetricsService
from app.modules.internal_api.services.project_thresholds_service import ProjectThresholdsService
from app.modules.internal_api.services.project_configuration_reader_service import ProjectConfigurationReaderService
from app.modules.internal_api.services.connection_status_service import ConnectionStatusService
from app.modules.internal_api.services.llm_config_service import LlmConfigService
from app.modules.internal_api.services.interaction_review_service import InteractionNotPendingError, InvalidEditedResponseError
from app.modules.internal_api.clients.llm_provider_checker import LlmProviderError, ProviderUnavailableError
from app.modules.internal_api.services.interaction_listing_service import InteractionListingService


router = APIRouter(tags=["InternalAPI"])

# instancia unica del servicio para toda la aplicacion
_service = ProjectConfigService()
_review_service = InteractionReviewService()
_itsm_connection_service = ItsmConnectionService()
_project_onboarding_service = ItsmProjectOnboardingService()
_country_repository = CountryRepository()
_status_mapping_service = ItsmStatusMappingService()
_confluence_connection_service = ConfluenceConnectionService()
_space_config_service = SpaceConfigurationService()
_indexing_trigger_service = IndexingTriggerService()
_kb_indexing_status_repository = KbIndexingStatusRepository()
_metrics_service = InteractionMetricsService()
_thresholds_service = ProjectThresholdsService()
_project_configuration_reader_service = ProjectConfigurationReaderService()
_connection_status_service = ConnectionStatusService()
_llm_config_service = LlmConfigService()
_listing_service = InteractionListingService()


# configura los umbrales y el mapeo de estados de un proyecto
@router.post("/api/config/itsm/projects", response_model=ProjectConfigResponse)
def configure_project(request: ProjectConfigRequest, admin: AppUser = Depends(require_admin)):
    try:
        mappings_configured = _service.save_config(request.thresholds, request.status_mappings, request.project_key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo persistir la configuracion")

    return ProjectConfigResponse(status="ok", mappings_configured=mappings_configured)


# aprueba una interaccion en needs_review, publica la respuesta generada tal cual esta o la version editada por el agente si viene edited_response
@router.post("/api/interactions/{interaction_id}/approve", response_model=InteractionReviewResponse,
             responses={400: {"model": ErrorResponse, "description": "La respuesta editada esta vacia o supera el maximo de caracteres"}})
async def approve_interaction(interaction_id: str, request: ApproveRequest, usuario: AppUser = Depends(get_current_user)):
    try:
        if request.edited_response is not None:
            action_type = await _review_service.approve_interaction(interaction_id, request.reviewed_by, request.edited_response)
        else:
            action_type = await _review_service.approve_interaction(interaction_id, request.reviewed_by)
    except InvalidEditedResponseError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo aprobar la interacción")

    return InteractionReviewResponse(status="ok", action_type=action_type)


# regenera una interaccion rechazada, con el motivo del rechazo
@router.post("/api/interactions/{interaction_id}/regenerate", response_model=InteractionReviewResponse)
async def regenerate_interaction(interaction_id: str, request: RegenerateRequest, usuario: AppUser = Depends(get_current_user)):
    try:
        action_type = await _review_service.regenerate_interaction(interaction_id, request.rejection_reason, request.reviewed_by)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo regenerar la interacción")

    return InteractionReviewResponse(status="ok", action_type=action_type)


# escala una interaccion directo a un humano, sin generar nada nuevo
@router.post("/api/interactions/{interaction_id}/escalate", response_model=InteractionReviewResponse)
def escalate_interaction(interaction_id: str, request: EscalateRequest, usuario: AppUser = Depends(get_current_user)):
    try:
        action_type = _review_service.escalate_interaction(interaction_id, request.rejection_reason, request.reviewed_by)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo escalar la interacción")

    return InteractionReviewResponse(status="ok", action_type=action_type)



# descarta la sugerencia de una interaccion pendiente, no publica nada, no regenera y no escala, el ticket queda abierto en jsm
@router.post("/api/interactions/{interaction_id}/discard", response_model=InteractionReviewResponse,
             responses={404: {"model": ErrorResponse, "description": "La interaccion no existe"},
                        409: {"model": ErrorResponse, "description": "La interaccion ya no esta pendiente de revision"}})
def discard_interaction(interaction_id: str, request: DiscardRequest | None = None, usuario: AppUser = Depends(get_current_user)):
    rejection_reason = ((request.rejection_reason if request is not None else None) or "").strip() or None

    try:
        action_type = _review_service.discard_interaction(interaction_id, rejection_reason, str(usuario.id))
    except InteractionNotPendingError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo descartar la interacción")

    return InteractionReviewResponse(status="ok", action_type=action_type)
# configura la conexion con jsm, valida las credenciales antes de guardarlas
@router.post("/api/config/itsm", response_model=ItsmConnectionResponse)
async def configure_itsm_connection(request: ItsmConnectionRequest, admin: AppUser = Depends(require_admin)):
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
async def list_available_projects(admin: AppUser = Depends(require_admin)):
    try:
        projects = await _project_onboarding_service.list_available_projects()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar JSM")

    return AvailableProjectsResponse(projects=projects)


# da de alta los proyectos que el admin eligio de la lista disponible
@router.post("/api/config/itsm/projects/onboard", response_model=OnboardProjectsResponse)
def onboard_projects(request: OnboardProjectsRequest, admin: AppUser = Depends(require_admin)):
    try:
        projects_created = _project_onboarding_service.onboard_projects(request.projects)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo dar de alta los proyectos")

    return OnboardProjectsResponse(status="ok", projects_created=projects_created)

# lista los paises validos del catalogo, para el dropdown del frontend
@router.get("/api/config/countries", response_model=CountriesResponse)
def list_countries(admin: AppUser = Depends(require_admin)):
    countries = _country_repository.list_countries()
    return CountriesResponse(countries=countries)

# trae los estados reales de un proyecto de jsm, para que el admin arme el mapeo
@router.get("/api/config/itsm/projects/{project_key}/statuses", response_model=ProjectStatusesResponse)
async def list_project_statuses(project_key: str, admin: AppUser = Depends(require_admin)):
    try:
        statuses = await _status_mapping_service.list_project_statuses(project_key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar los estados de JSM")

    return ProjectStatusesResponse(statuses=statuses)

# lista los campos custom de jsm de tipo lista de seleccion unica, para elegir cual representa categoria
@router.get("/api/config/itsm/fields", response_model=SelectFieldsResponse)
async def list_select_fields(admin: AppUser = Depends(require_admin)):
    try:
        fields = await _project_onboarding_service.list_select_fields()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar JSM")

    return SelectFieldsResponse(fields=fields)

# trae las opciones reales de un campo elegido por el admin
@router.get("/api/config/itsm/fields/{field_id}/options", response_model=FieldOptionsResponse)
async def list_field_options(field_id: str, admin: AppUser = Depends(require_admin)):
    try:
        options = await _project_onboarding_service.list_field_options(field_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar JSM")

    return FieldOptionsResponse(options=options)


# confirma las categorias que el admin eligio para su proyecto
@router.post("/api/config/itsm/projects/{project_key}/categories", response_model=ConfigureCategoriesResponse)
def configure_categories(project_key: str, request: ConfigureCategoriesRequest, admin: AppUser = Depends(require_admin)):
    try:
        categories_configured = _project_onboarding_service.configure_categories(project_key, request.categories)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo configurar las categorias")

    return ConfigureCategoriesResponse(status="ok", categories_configured=categories_configured)

# trae y persiste automaticamente los tipos de solicitud reales de un proyecto, sin necesitar seleccion del admin
@router.post("/api/config/itsm/projects/{project_key}/request-types", response_model=ConfigureRequestTypesResponse)
async def configure_request_types(project_key: str, request: ConfigureRequestTypesRequest | None = None, admin: AppUser = Depends(require_admin)):
    try:
        if request is not None and request.request_type_ids is not None:
            request_types_configured = await _project_onboarding_service.configure_request_types(project_key, request.request_type_ids)
        else:
            request_types_configured = await _project_onboarding_service.configure_request_types(project_key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo configurar los tipos de solicitud")

    return ConfigureRequestTypesResponse(status="ok", request_types_configured=request_types_configured)


# lista los tipos de solicitud ya incorporados a un proyecto, para precargar la pantalla de configuracion
@router.get("/api/config/itsm/projects/{project_key}/request-types", response_model=ProjectRequestTypesResponse)
def get_project_request_types(project_key: str, admin: AppUser = Depends(require_admin)):
    try:
        request_types = _project_onboarding_service.list_project_request_types(project_key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar los tipos de solicitud")

    return ProjectRequestTypesResponse(request_types=request_types)


# lista los tipos de solicitud reales de un proyecto en jsm, con su id, e indica cuales ya estan incorporados
@router.get("/api/config/itsm/projects/{project_key}/request-types/available", response_model=AvailableRequestTypesResponse)
async def list_available_request_types(project_key: str, admin: AppUser = Depends(require_admin)):
    try:
        request_types = await _project_onboarding_service.list_available_request_types(project_key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar JSM")

    return AvailableRequestTypesResponse(request_types=request_types)


# trae las prioridades reales de un proyecto, con sugerencia automatica de mapeo
@router.get("/api/config/itsm/projects/{project_key}/priorities", response_model=PrioritiesWithSuggestionResponse)
async def list_priorities(project_key: str, admin: AppUser = Depends(require_admin)):
    try:
        result = await _project_onboarding_service.list_priorities_with_suggestion()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar JSM")

    return PrioritiesWithSuggestionResponse(**result)


# confirma el mapeo de prioridades para un proyecto
@router.post("/api/config/itsm/projects/{project_key}/priorities", response_model=ConfigurePriorityMappingResponse)
def configure_priority_mapping(project_key: str, request: ConfigurePriorityMappingRequest, admin: AppUser = Depends(require_admin)):
    try:
        mappings_configured = _project_onboarding_service.configure_priority_mapping(project_key, request.mapping)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo configurar el mapeo de prioridades")

    return ConfigurePriorityMappingResponse(status="ok", mappings_configured=mappings_configured)

#CONFLUENCE KB

# configura la conexion con confluence, valida las credenciales antes de guardarlas
@router.post("/api/config/knowledge-base", response_model=ConfluenceConnectionResponse)
async def configure_confluence_connection(request: ConfluenceConnectionRequest, admin: AppUser = Depends(require_admin)):
    try:
        await _confluence_connection_service.configure_connection(
            request.base_url, request.user_email, request.api_token
        )
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=400, detail="Las credenciales de Confluence no son validas")
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="No se pudo conectar con Confluence")
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo guardar la configuracion")

    return ConfluenceConnectionResponse(status="ok")


# lista los spaces reales disponibles en confluence
@router.get("/api/config/knowledge-base/spaces/available", response_model=AvailableSpacesResponse)
async def list_available_spaces(admin: AppUser = Depends(require_admin)):
    try:
        spaces = await _space_config_service.list_available_spaces()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar Confluence")

    return AvailableSpacesResponse(spaces=spaces)


# vincula los spaces que el admin eligio a un proyecto
@router.post("/api/config/itsm/projects/{project_key}/spaces", response_model=ConfigureSpacesResponse)
def configure_spaces(project_key: str, request: ConfigureSpacesRequest, admin: AppUser = Depends(require_admin)):
    try:
        spaces_dicts = [s.model_dump() for s in request.spaces]
        spaces_configured = _space_config_service.configure_spaces(project_key, spaces_dicts)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo configurar los spaces")

    return ConfigureSpacesResponse(status="ok", spaces_configured=spaces_configured)


# dispara la indexacion de los spaces elegidos, corre en background via el worker
@router.post("/api/indexing/start", response_model=StartIndexingResponse, status_code=202)
async def start_indexing(request: StartIndexingRequest, admin: AppUser = Depends(require_admin)):
    try:
        await _indexing_trigger_service.start_indexing(request.space_keys)
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo encolar la indexacion")

    return StartIndexingResponse(status="queued")

# consulta el estado del ultimo trabajo de indexacion
@router.get("/api/indexing/status", response_model=IndexingStatusResponse, responses={404: {"model": ErrorResponse, "description": "Todavia no se disparo ninguna indexacion"}})
def get_indexing_status(admin: AppUser = Depends(require_admin)):
    status = _kb_indexing_status_repository.get_latest_status()

    if status is None:
        raise HTTPException(status_code=404, detail="Todavia no se disparo ninguna indexacion")

    return IndexingStatusResponse(**status)


# resumen agregado de metricas de interacciones, para el dashboard 
#
@router.get("/api/metrics/summary", response_model=MetricsSummaryResponse)
def get_metrics_summary(usuario: AppUser = Depends(get_current_user), project_id: str | None = None, from_date: str | None = None, to_date: str | None = None,
                              category: str | None = None, decision: str | None = None, tz: str | None = None):
    try:
        result = _metrics_service.get_summary(project_id, from_date, to_date, category, decision, tz)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return MetricsSummaryResponse(**result)

# serie diaria de metricas en el huso pedido, para el dashboard
@router.get("/api/metrics/daily", response_model=DailyMetricsResponse)
def get_metrics_daily(usuario: AppUser = Depends(get_current_user), project_id: str | None = None, from_date: str | None = None, to_date: str | None = None,
                            category: str | None = None, decision: str | None = None, tz: str | None = None):
    try:
        result = _metrics_service.get_daily(project_id, from_date, to_date, category, decision, tz)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return DailyMetricsResponse(**result)

# desglose de metricas por categoria, para el dashboard
@router.get("/api/metrics/by-category", response_model=MetricsByCategoryResponse)
def get_metrics_by_category(usuario: AppUser = Depends(get_current_user), project_id: str | None = None, from_date: str | None = None, to_date: str | None = None,
                                  category: str | None = None, decision: str | None = None, tz: str | None = None):
    try:
        result = _metrics_service.get_by_category(project_id, from_date, to_date, category, decision, tz)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return MetricsByCategoryResponse(categories=result)

# distribucion de las interacciones por intervalo de confianza, para el dashboard
@router.get("/api/metrics/confidence-distribution", response_model=ConfidenceDistributionResponse)
def get_metrics_confidence_distribution(usuario: AppUser = Depends(get_current_user), project_id: str | None = None, from_date: str | None = None, to_date: str | None = None,
                                              category: str | None = None, decision: str | None = None, tz: str | None = None):
    try:
        result = _metrics_service.get_confidence_distribution(project_id, from_date, to_date, category, decision, tz)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return ConfidenceDistributionResponse(**result)

# mapa de calor de las interacciones por dia de la semana y hora, para el dashboard
@router.get("/api/metrics/heatmap", response_model=HeatmapResponse)
def get_metrics_heatmap(usuario: AppUser = Depends(get_current_user), project_id: str | None = None, from_date: str | None = None, to_date: str | None = None,
                              category: str | None = None, decision: str | None = None, tz: str | None = None):
    try:
        result = _metrics_service.get_heatmap(project_id, from_date, to_date, category, decision, tz)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return HeatmapResponse(**result)

# umbrales de confianza y de similitud configurados por proyecto, para que el dashboard dibuje las zonas de decision
@router.get("/api/metrics/thresholds", response_model=ProjectThresholdsResponse)
def get_metrics_thresholds(usuario: AppUser = Depends(get_current_user), project_id: str | None = None):
    try:
        result = _thresholds_service.get_thresholds(project_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if project_id and not result:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    return ProjectThresholdsResponse(projects=result)

# lista los proyectos dados de alta con su id, para precargar la pantalla de configuracion
@router.get("/api/config/itsm/projects", response_model=OnboardedProjectsResponse)
def list_onboarded_projects(admin: AppUser = Depends(require_admin)):
    try:
        projects = _project_configuration_reader_service.list_projects()
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar los proyectos")

    return OnboardedProjectsResponse(projects=projects)


# trae todo lo que tiene guardado un proyecto, para precargar la pantalla de configuracion
# se declara despues de .../projects/available para que esa ruta no quede tapada por esta
@router.get("/api/config/itsm/projects/{project_key}", response_model=ProjectConfigurationResponse)
def get_project_configuration(project_key: str, admin: AppUser = Depends(require_admin)):
    try:
        configuration = _project_configuration_reader_service.get_project_configuration(project_key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar la configuracion del proyecto")

    return ProjectConfigurationResponse(**configuration)


# dice si la conexion con jsm esta configurada y con que url y cuenta, nunca devuelve el token ni el secreto del webhook
@router.get("/api/config/itsm", response_model=ConnectionStatusResponse)
def get_itsm_connection(admin: AppUser = Depends(require_admin)):
    try:
        connection = _connection_status_service.get_jsm_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar la conexion con JSM")

    return ConnectionStatusResponse(**connection)


# dice si la conexion con confluence esta configurada y con que url y cuenta, nunca devuelve el token
@router.get("/api/config/knowledge-base", response_model=ConnectionStatusResponse)
def get_confluence_connection(admin: AppUser = Depends(require_admin)):
    try:
        connection = _connection_status_service.get_confluence_connection()
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar la conexion con Confluence")

    return ConnectionStatusResponse(**connection)


# estado actual de la configuracion del llm, nunca devuelve las claves
@router.get("/api/config/llm", response_model=LlmConfigResponse)
def get_llm_config_status(admin: AppUser = Depends(require_admin)):
    try:
        status = _llm_config_service.get_status()
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar la configuracion del LLM")

    return LlmConfigResponse(**status)


# valida una clave contra el proveedor y lista los modelos de chat de la cuenta, sin guardar nada
@router.post("/api/config/llm/models", response_model=LlmModelsResponse)
async def list_llm_models(request: LlmModelsRequest, admin: AppUser = Depends(require_admin)):
    try:
        chat_models = await _llm_config_service.list_models(request.provider, request.api_key)
    except ProviderUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except LlmProviderError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar el proveedor")

    return LlmModelsResponse(chat_models=chat_models)


# valida las claves y el modelo contra los proveedores y guarda la configuracion del llm cifrada
@router.post("/api/config/llm", response_model=SaveLlmConfigResponse)
async def save_llm_config(request: SaveLlmConfigRequest, admin: AppUser = Depends(require_admin)):
    try:
        await _llm_config_service.save(
            request.generation.provider, request.generation.model, request.generation.api_key, request.embeddings.api_key
        )
    except ProviderUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except (LlmProviderError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo guardar la configuracion del LLM")

    return SaveLlmConfigResponse(status="ok")


# lista interacciones paginadas, con filtros, para el dashboard
@router.get("/api/interactions", response_model=InteractionListResponse)
def list_interactions(
    usuario: AppUser = Depends(get_current_user),
    project_id: str | None = None,
    category: str | None = None,
    decision: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    limit: int = 20,
    offset: int = 0,
):
    result = _listing_service.list_interactions(project_id, category, decision, from_date, to_date, limit, offset)
    return InteractionListResponse(interactions=result)


# detalle completo de una interaccion puntual, con sus chunks recuperados, para el dashboard (TF-160)
@router.get("/api/interactions/{interaction_id}", response_model=InteractionDetailResponse)
def get_interaction_detail(interaction_id: str, usuario: AppUser = Depends(get_current_user)):
    result = _listing_service.get_detail(interaction_id)

    if result is None:
        raise HTTPException(status_code=404, detail="Interaccion no encontrada")

    return InteractionDetailResponse(**result)