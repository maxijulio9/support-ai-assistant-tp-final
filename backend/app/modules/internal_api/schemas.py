"""
MODULO 7: InternalAPI
Schemas para la configuracion de proyectos
Define la estructura de project_config: mapeo de transiciones de JSM,
pais asociado y umbrales de confianza/similitud por proyecto.
"""

from pydantic import BaseModel, Field


class ProjectThresholds(BaseModel):
    """Umbrales de decision del pipeline, una fila por proyecto (columnas en la tabla project)."""
    project_id: str = Field(description="id del proyecto en la tabla project")
    threshold_auto_publish: float = Field(default=0.85, ge=0.0, le=1.0, description="confidence_score minimo para publicar la respuesta sin revision humana")
    threshold_needs_review: float = Field(default=0.60, ge=0.0, le=1.0, description="confidence_score minimo para pedir revision humana en vez de escalar directo")
    similarity_threshold: float = Field(default=0.40, ge=0.0, le=1.0, description="similarity_score minimo para que un chunk recuperado se use como contexto")


class ProjectStatusMapping(BaseModel):
    """Mapeo de una categoria generica de estado ITSM a la transicion real de JSM, una fila por combinacion proyecto + estado (tabla project_config)."""
    project_id: str = Field(description="id del proyecto en la tabla project")
    status_id: str = Field(description="id del estado generico en la tabla ticket_status")
    system_action: str | None = Field(default=None, description="id real de la transicion de JSM que corresponde a este estado")
    is_active: bool = Field(default=True, description="si el mapeo esta activo o fue desactivado por el admin")


class ProjectConfigRequest(BaseModel):
    """Request para el endpoint POST /api/config/itsm/projects (CU26)."""
    thresholds: ProjectThresholds
    status_mappings: list[ProjectStatusMapping]


class ProjectConfigResponse(BaseModel):
    """Response de confirmacion del endpoint de configuracion de proyecto."""
    status: str = Field(description="resultado de la operacion, 'ok' si salio bien")
    mappings_configured: int = Field(description="cantidad de mapeos de estado que quedaron guardados")


class ApproveRequest(BaseModel):
    """Request para aprobar una interaccion en NEEDS_REVIEW, publica la respuesta tal cual esta."""
    reviewed_by: str | None = Field(default=None, description="referencia logica al agente que revisa, sin FK hasta que exista M9")


class RegenerateRequest(BaseModel):
    """Request para regenerar una interaccion rechazada (CU17)."""
    rejection_reason: str = Field(description="motivo del rechazo, se usa para reintentar la generacion con ese contexto")
    reviewed_by: str | None = Field(default=None, description="referencia logica al agente que revisa")


class EscalateRequest(BaseModel):
    """Request para escalar una interaccion directo a un humano, sin generar nada nuevo."""
    rejection_reason: str | None = Field(default=None, description="motivo opcional del escalamiento")
    reviewed_by: str | None = Field(default=None, description="referencia logica al agente que revisa")


class InteractionReviewResponse(BaseModel):
    """Response comun a las 3 acciones de revision (approve, regenerate, escalate)."""
    status: str = Field(description="resultado de la operacion, 'ok' si salio bien")
    action_type: str = Field(description="accion final que tomo el sistema, por ejemplo AUTO_PUBLISH o ESCALATE")


class ItsmConnectionRequest(BaseModel):
    """Request para configurar la conexion con JSM."""
    base_url: str = Field(description="url de la instancia de JSM, por ejemplo https://tuempresa.atlassian.net")
    user_email: str = Field(description="email de la cuenta usada para autenticar contra la API de JSM")
    api_token: str = Field(description="API token generado desde la cuenta de Atlassian")
    webhook_secret: str = Field(description="secreto compartido para validar que los webhooks vienen de JSM")


class ItsmConnectionResponse(BaseModel):
    """Response de confirmacion de la conexion con JSM."""
    status: str = Field(description="resultado de la operacion, 'ok' si las credenciales se validaron y guardaron")


class AvailableProjectsResponse(BaseModel):
    """Response con la lista de proyectos disponibles en jsm, para que el admin elija (CU27)."""
    projects: list[dict] = Field(description="proyectos reales de la instancia de JSM, con su key y name")


class ProjectToOnboard(BaseModel):
    """Un proyecto elegido por el admin para dar de alta, con su pais correspondiente."""
    code: str = Field(description="key real del proyecto en JSM, por ejemplo TARG")
    name: str = Field(description="nombre del proyecto para mostrar en el dashboard")
    country_code: str = Field(description="codigo de pais de la tabla country, por ejemplo AR")
    language_code: str | None = Field(default=None, description="idioma principal del proyecto, usado para la recuperacion de la base de conocimiento")


class OnboardProjectsRequest(BaseModel):
    """Request para dar de alta los proyectos elegidos (CU27)."""
    projects: list[ProjectToOnboard]


class OnboardProjectsResponse(BaseModel):
    """Response de confirmacion del alta de proyectos."""
    status: str = Field(description="resultado de la operacion, 'ok' si salio bien")
    projects_created: int = Field(description="cantidad de proyectos creados o actualizados")


class CountriesResponse(BaseModel):
    """Response con los paises validos, para que el frontend arme el dropdown al dar de alta proyectos."""
    countries: list[dict] = Field(description="paises del catalogo, con su code y name")


class ProjectStatusesResponse(BaseModel):
    """Response con los estados reales de un proyecto de jsm, para el mapeo del admin (TF-122)."""
    statuses: list[dict] = Field(description="estados reales del workflow de JSM para ese proyecto, con su id y name")


class SelectFieldsResponse(BaseModel):
    """Response con los campos custom de tipo lista de seleccion unica, para que el admin elija cual es categoria."""
    fields: list[dict] = Field(description="campos custom de JSM de tipo seleccion unica, con su id y nombre")


class ConfigureCategoriesRequest(BaseModel):
    """Request para confirmar las categorias elegidas por el admin para un proyecto."""
    categories: list[str] = Field(description="valores crudos de las categorias en JSM, tal cual, sin modificar")


class ConfigureCategoriesResponse(BaseModel):
    """Response de confirmacion de categorias configuradas."""
    status: str = Field(description="resultado de la operacion, 'ok' si salio bien")
    categories_configured: int = Field(description="cantidad de categorias que quedaron vinculadas al proyecto")


class FieldOptionsResponse(BaseModel):
    """Response con las opciones reales de un campo custom elegido por el admin."""
    options: list[str] = Field(description="valores posibles de ese campo en la instancia real de JSM")


class ConfigureRequestTypesResponse(BaseModel):
    """Response de confirmacion al configurar los tipos de solicitud de un proyecto."""
    status: str = Field(description="resultado de la operacion, 'ok' si salio bien")
    request_types_configured: int = Field(description="cantidad de tipos de solicitud vinculados al proyecto")


class PrioritiesWithSuggestionResponse(BaseModel):
    """Response con las prioridades reales de jsm y una sugerencia automatica de mapeo."""
    priorities: list[dict] = Field(description="prioridades reales de la instancia de JSM")
    suggestions: dict = Field(description="mapeo sugerido de cada prioridad real a un nivel universal (Highest, High, Medium, Low)")


class ConfigurePriorityMappingRequest(BaseModel):
    """Request para confirmar el mapeo de prioridades, el admin puede ajustar la sugerencia."""
    mapping: dict[str, list[str]] = Field(description="nivel universal de prioridad como clave, lista de prioridades reales de JSM como valor")


class ConfigurePriorityMappingResponse(BaseModel):
    """Response de confirmacion del mapeo de prioridades."""
    status: str = Field(description="resultado de la operacion, 'ok' si salio bien")
    mappings_configured: int = Field(description="cantidad de mapeos de prioridad guardados")


# CONFLUENCE KB

class ConfluenceConnectionRequest(BaseModel):
    """Request para configurar la conexion con confluence."""
    base_url: str = Field(description="url de la instancia de Confluence, por ejemplo https://tuempresa.atlassian.net/wiki")
    user_email: str = Field(description="email de la cuenta usada para autenticar contra la API de Confluence")
    api_token: str = Field(description="API token generado desde la cuenta de Atlassian")


class ConfluenceConnectionResponse(BaseModel):
    """Response de confirmacion de la conexion con Confluence."""
    status: str = Field(description="resultado de la operacion, 'ok' si las credenciales se validaron y guardaron")


class SpaceToLink(BaseModel):
    """Un space elegido por el admin para vincular al proyecto."""
    space_key: str = Field(description="key real del space en Confluence, por ejemplo TA")
    country_code: str | None = Field(default=None, description="pais al que corresponde este space, si aplica")
    description: str | None = Field(default=None, description="descripcion libre del space, para referencia del admin")
    language_code: str | None = Field(default=None, description="idioma del contenido de este space")


class AvailableSpacesResponse(BaseModel):
    """Response con la lista de spaces disponibles en confluence, para que el admin elija (CU29)."""
    spaces: list[dict] = Field(description="spaces reales de la instancia de Confluence, con su key y name")


class ConfigureSpacesRequest(BaseModel):
    """Request para confirmar los spaces elegidos por el admin."""
    spaces: list[SpaceToLink]


class ConfigureSpacesResponse(BaseModel):
    """Response de confirmacion de spaces vinculados."""
    status: str = Field(description="resultado de la operacion, 'ok' si salio bien")
    spaces_configured: int = Field(description="cantidad de spaces vinculados al proyecto")


class StartIndexingRequest(BaseModel):
    """Request para disparar la indexacion de los spaces ya vinculados a un proyecto (CU30)."""
    space_keys: list[str] = Field(description="keys de los spaces de Confluence a indexar")


class StartIndexingResponse(BaseModel):
    """Response de confirmacion, la indexacion corre en background."""
    status: str = Field(description="siempre 'queued', la indexacion se encola para el worker")


class IndexingStatusResponse(BaseModel):
    """Response con el estado del ultimo trabajo de indexacion, para el polling del dashboard (CU31)."""
    space_keys: list[str] = Field(description="spaces que cubrio este trabajo de indexacion")
    status: str = Field(description="estado del trabajo, por ejemplo running, completed o failed")
    total_documents: int | None = Field(default=None, description="cantidad total de documentos a procesar, si ya se conoce")
    documents_processed: int = Field(description="cantidad de documentos ya procesados")
    chunks_generated: int = Field(description="cantidad de chunks generados hasta el momento")
    error_detail: str | None = Field(default=None, description="detalle del error, si el trabajo fallo")
    started_at: str = Field(description="marca de tiempo de inicio del trabajo")
    updated_at: str = Field(description="marca de tiempo de la ultima actualizacion del trabajo")


class MetricsSummaryResponse(BaseModel):
    """Resumen agregado de metricas de interacciones, para el dashboard."""
    total_interactions: int = Field(description="cantidad total de interacciones procesadas en el periodo")
    auto_publish_count: int = Field(description="cantidad de interacciones publicadas automaticamente")
    needs_review_count: int = Field(description="cantidad de interacciones que quedaron pendientes de revision")
    escalate_count: int = Field(description="cantidad de interacciones escaladas a un agente humano")
    request_info_count: int = Field(description="cantidad de interacciones donde se le pidio mas informacion al usuario")
    resolved_count: int = Field(description="cantidad de tickets resueltos por el sistema")
    resolved_externally_count: int = Field(description="cantidad de tickets resueltos por un humano fuera del sistema")
    automatic_resolution_rate: float = Field(description="porcentaje de interacciones resueltas sin intervencion humana")
    avg_confidence_score: float | None = Field(description="promedio del confidence_score de las interacciones del periodo")


class CategoryMetric(BaseModel):
    """Un item del desglose de metricas por categoria."""
    category: str = Field(description="nombre de la categoria de soporte")
    total_interactions: int = Field(description="cantidad de interacciones de esa categoria")
    auto_publish_count: int = Field(description="cantidad de interacciones de esa categoria publicadas automaticamente")
    automatic_resolution_rate: float = Field(description="porcentaje de resolucion automatica dentro de esa categoria")


class MetricsByCategoryResponse(BaseModel):
    """Desglose de metricas por categoria, para el dashboard."""
    categories: list[CategoryMetric]


class InteractionListItem(BaseModel):
    """Un item del listado paginado de interacciones."""
    interaction_id: str = Field(description="id de la interaccion")
    issue_key: str = Field(description="key del ticket en JSM, por ejemplo TARG-123")
    summary: str | None = Field(description="resumen del ticket original")
    category: str | None = Field(description="categoria detectada por el sistema")
    priority: str | None = Field(description="prioridad del ticket")
    decision: str | None = Field(description="decision final del pipeline para esta interaccion")
    confidence_score: float | None = Field(description="confidence_score de la respuesta generada")
    created_at: str | None = Field(description="marca de tiempo de creacion de la interaccion")


class InteractionListResponse(BaseModel):
    """Respuesta del listado paginado de interacciones, para el dashboard."""
    interactions: list[InteractionListItem]


class RetrievedChunkDetail(BaseModel):
    """Un chunk recuperado de la base de conocimiento, parte del detalle de una interaccion."""
    page_title: str | None = Field(description="titulo de la pagina de Confluence de donde salio el chunk")
    similarity_score: float = Field(description="score de similitud entre el chunk y la consulta del ticket")
    rank_position: int = Field(description="posicion del chunk en el ranking de resultados recuperados")


class InteractionDetailResponse(BaseModel):
    """Detalle completo de una interaccion puntual, con sus chunks recuperados, para el dashboard (TF-160)."""
    interaction_id: str = Field(description="id de la interaccion")
    issue_key: str = Field(description="key del ticket en JSM, por ejemplo TARG-123")
    summary: str | None = Field(description="resumen del ticket original")
    category: str | None = Field(description="categoria detectada por el sistema")
    priority: str | None = Field(description="prioridad del ticket")
    decision: str | None = Field(description="decision final del pipeline para esta interaccion")
    confidence_score: float | None = Field(description="confidence_score de la respuesta generada")
    text_input: str | None = Field(description="texto original del ticket, usado como input del pipeline")
    generated_response: str | None = Field(description="respuesta generada por el sistema")
    created_at: str | None = Field(description="marca de tiempo de creacion de la interaccion")
    chunks: list[RetrievedChunkDetail] = Field(description="fragmentos de la base de conocimiento usados como contexto")