"""
MODULO 7: InternalAPI
Schemas para la configuracion de proyectos
Define la estructura de project_config: mapeo de transiciones de JSM,
pais asociado y umbrales de confianza/similitud por proyecto.
"""

from pydantic import BaseModel, ConfigDict, Field


class ProjectThresholds(BaseModel):
    """Umbrales de decision del pipeline, una fila por proyecto (columnas en la tabla project)."""
    project_id: str | None = Field(default=None, description="id del proyecto en la tabla project, se puede omitir si se indica project_key")
    threshold_auto_publish: float = Field(default=0.85, ge=0.0, le=1.0, description="confidence_score minimo para publicar la respuesta sin revision humana")
    threshold_needs_review: float = Field(default=0.60, ge=0.0, le=1.0, description="confidence_score minimo para pedir revision humana en vez de escalar directo")
    similarity_threshold: float = Field(default=0.40, ge=0.0, le=1.0, description="similarity_score minimo para que un chunk recuperado se use como contexto")


class ProjectStatusMapping(BaseModel):
    """Mapeo de una categoria generica de estado ITSM a la transicion real de JSM, una fila por combinacion proyecto + estado (tabla project_config)."""
    project_id: str | None = Field(default=None, description="id del proyecto en la tabla project, se puede omitir si se indica project_key")
    status_id: str = Field(description="id del estado generico en la tabla ticket_status")
    system_action: str | None = Field(default=None, description="id real de la transicion de JSM que corresponde a este estado")
    is_active: bool = Field(default=True, description="si el mapeo esta activo o fue desactivado por el admin")


class ProjectConfigRequest(BaseModel):
    """Request para el endpoint POST /api/config/itsm/projects (CU26)."""
    project_key: str | None = Field(default=None, description="key del proyecto en JSM, por ejemplo TARG, es una alternativa a project_id, si se indica no hace falta mandar project_id")
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


class AvailableProject(BaseModel):
    """Un proyecto real de la instancia de JSM."""
    key: str = Field(description="key del proyecto en JSM, por ejemplo TARG")
    name: str = Field(description="nombre del proyecto en JSM")


class Country(BaseModel):
    """Un pais del catalogo."""
    code: str = Field(description="codigo del pais, por ejemplo AR")
    name: str = Field(description="nombre del pais")


class JsmStatus(BaseModel):
    """Un estado real del workflow de un proyecto de JSM."""
    model_config = ConfigDict(coerce_numbers_to_str=True)

    id: str = Field(description="id del estado en JSM")
    name: str = Field(description="nombre del estado en JSM")
    status_id: str = Field(description="id interno del estado en ticket_status, es el que se manda como status_id al guardar el mapeo de estados")


class JsmField(BaseModel):
    """Un campo custom de JSM de tipo seleccion unica."""
    model_config = ConfigDict(coerce_numbers_to_str=True)

    id: str = Field(description="id del campo en JSM, por ejemplo customfield_10050")
    name: str = Field(description="nombre del campo en JSM")


class JsmPriority(BaseModel):
    """Una prioridad real de la instancia de JSM."""
    model_config = ConfigDict(coerce_numbers_to_str=True)

    id: str = Field(description="id de la prioridad en JSM, es el valor que se manda de vuelta dentro de mapping al confirmar el mapeo")
    name: str = Field(description="nombre de la prioridad en JSM")


class ConfluenceSpaceItem(BaseModel):
    """Un space real de la instancia de Confluence."""
    model_config = ConfigDict(coerce_numbers_to_str=True)

    id: str = Field(description="id del space en Confluence")
    key: str = Field(description="key del space en Confluence, por ejemplo TA")
    name: str = Field(description="nombre del space en Confluence")


class AvailableProjectsResponse(BaseModel):
    """Response con la lista de proyectos disponibles en jsm, para que el admin elija (CU27)."""
    projects: list[AvailableProject] = Field(description="proyectos reales de la instancia de JSM, con su key y name")


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
    countries: list[Country] = Field(description="paises del catalogo, con su code y name")


class ProjectStatusesResponse(BaseModel):
    """Response con los estados reales de un proyecto de jsm, para el mapeo del admin (TF-122)."""
    statuses: list[JsmStatus] = Field(description="estados reales del workflow de JSM para ese proyecto, con su id y name")


class SelectFieldsResponse(BaseModel):
    """Response con los campos custom de tipo lista de seleccion unica, para que el admin elija cual es categoria."""
    fields: list[JsmField] = Field(description="campos custom de JSM de tipo seleccion unica, con su id y nombre")


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


class ProjectRequestType(BaseModel):
    """Un tipo de solicitud incorporado a un proyecto."""
    id: str = Field(description="id interno del tipo de solicitud")
    name: str = Field(description="nombre del tipo de solicitud, igual al de JSM")
    is_active: bool = Field(description="si el tipo de solicitud esta activo en el proyecto")


class ProjectRequestTypesResponse(BaseModel):
    """Response con los tipos de solicitud ya incorporados a un proyecto."""
    request_types: list[ProjectRequestType] = Field(description="tipos de solicitud vinculados al proyecto, ordenados por nombre, la lista viene vacia si todavia no se incorporo ninguno")


class ConfigureRequestTypesResponse(BaseModel):
    """Response de confirmacion al configurar los tipos de solicitud de un proyecto."""
    status: str = Field(description="resultado de la operacion, 'ok' si salio bien")
    request_types_configured: int = Field(description="cantidad de tipos de solicitud vinculados al proyecto")


class PrioritiesWithSuggestionResponse(BaseModel):
    """Response con las prioridades reales de jsm y una sugerencia automatica de mapeo."""
    priorities: list[JsmPriority] = Field(description="prioridades reales de la instancia de JSM")
    suggestions: dict[str, str | None] = Field(description="mapeo sugerido de cada nivel universal (Highest, High, Medium y Low) a un id de prioridad real de JSM, o null si no se encontro ninguna que se parezca")


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
    spaces: list[ConfluenceSpaceItem] = Field(description="spaces reales de la instancia de Confluence, con su key y name")


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

class ResolutionChannelCount(BaseModel):
    """Cantidad de interacciones que se resolvieron por un mismo canal de resolucion."""
    resolution_channel: str | None = Field(description="canal de resolucion (AUTO, REVIEWED_APPROVED, REVIEWED_REGENERATED, ESCALATED_BY_HUMAN o RESOLVED_EXTERNALLY), o null si todavia no se resolvio o no se puede determinar")
    count: int = Field(description="cantidad de interacciones con ese canal de resolucion")

class MetricsSummaryResponse(BaseModel):
    """Resumen agregado de metricas de interacciones, para el dashboard."""
    total_interactions: int = Field(description="cantidad total de interacciones procesadas en el periodo")
    auto_publish_count: int = Field(description="cantidad de interacciones publicadas automaticamente")
    needs_review_count: int = Field(description="cantidad de interacciones que quedaron pendientes de revision")
    escalate_count: int = Field(description="cantidad de interacciones escaladas a un agente humano")
    request_info_count: int = Field(description="cantidad de interacciones donde se le pidio mas informacion al usuario")
    resolved_count: int = Field(description="cantidad de tickets resueltos por el sistema")
    without_decision_count: int = Field(description="cantidad de interacciones sin decision registrada en el periodo, no se suman a total_interactions ni a ningun otro conteo")
    by_resolution_channel: list[ResolutionChannelCount] = Field(description="cantidad de interacciones por canal de resolucion, su suma coincide con total_interactions, el grupo con canal null reune las que todavia no se resolvieron y las anteriores a que se registrara el canal")
    resolved_externally_count: int = Field(description="cantidad de tickets resueltos por un humano fuera del sistema")
    automatic_resolution_rate: float = Field(description="porcentaje de interacciones resueltas sin intervencion humana")
    avg_confidence_score: float | None = Field(description="promedio del confidence_score de las interacciones del periodo")


class CategoryMetric(BaseModel):
    """Un item del desglose de metricas por categoria."""
    category: str = Field(description="nombre de la categoria de soporte")
    total_interactions: int = Field(description="cantidad de interacciones de esa categoria")
    auto_publish_count: int = Field(description="cantidad de interacciones de esa categoria publicadas automaticamente")
    automatic_resolution_rate: float = Field(description="porcentaje de resolucion automatica dentro de esa categoria")
    avg_confidence_score: float | None = Field(description="promedio del confidence_score de las interacciones de esa categoria, o null si ninguna tiene puntaje")


class MetricsByCategoryResponse(BaseModel):
    """Desglose de metricas por categoria, para el dashboard."""
    categories: list[CategoryMetric]

class DailyMetric(BaseModel):
    """Metricas de un dia del calendario, en el huso horario de la respuesta."""
    date: str = Field(description="dia del calendario en formato AAAA-MM-DD, en el huso horario de la respuesta")
    total_interactions: int = Field(description="cantidad de interacciones con decision de ese dia")
    auto_publish_count: int = Field(description="cantidad de interacciones publicadas automaticamente ese dia")
    needs_review_count: int = Field(description="cantidad de interacciones pendientes de revision ese dia")
    escalate_count: int = Field(description="cantidad de interacciones escaladas ese dia")
    request_info_count: int = Field(description="cantidad de interacciones donde se pidio mas informacion ese dia")
    resolved_count: int = Field(description="cantidad de interacciones resueltas por el sistema ese dia")
    resolved_externally_count: int = Field(description="cantidad de interacciones resueltas por un humano fuera del sistema ese dia")
    avg_confidence_score: float | None = Field(description="promedio del confidence_score de ese dia, o null si ninguna interaccion tiene puntaje")


class DailyMetricsResponse(BaseModel):
    """Serie diaria de metricas, para el dashboard."""
    timezone: str = Field(description="huso horario con el que se armaron los dias, nombre IANA")
    days: list[DailyMetric] = Field(description="un elemento por dia, de menor a mayor fecha, los dias sin interacciones traen todos los conteos en cero")
class ConfidenceInterval(BaseModel):
    """Un intervalo de la distribucion de confianza."""
    lower_bound: float = Field(description="limite inferior del intervalo, siempre incluido")
    upper_bound: float = Field(description="limite superior del intervalo, excluido salvo que upper_inclusive sea true")
    upper_inclusive: bool = Field(description="true solo en el ultimo intervalo, que incluye el limite superior 1.0")
    count: int = Field(description="cantidad de interacciones cuyo confidence_score cae en el intervalo")


class ConfidenceDistributionResponse(BaseModel):
    """Distribucion de las interacciones por intervalo de confianza, para el dashboard."""
    intervals: list[ConfidenceInterval] = Field(description="diez intervalos de 0.1 de ancho entre 0.0 y 1.0, de menor a mayor")
    without_score_count: int = Field(description="cantidad de interacciones sin confidence_score, por ejemplo las que se escalaron o cerraron sin generar una respuesta, no entran en ningun intervalo")
    total_interactions: int = Field(description="cantidad de interacciones con decision bajo los filtros, es la suma de los intervalos mas without_score_count")


class HeatmapCell(BaseModel):
    """Una celda del mapa de calor, un dia de la semana y una hora."""
    weekday: int = Field(description="dia de la semana de 1 (lunes) a 7 (domingo), en el huso horario de la respuesta")
    hour: int = Field(description="hora del dia de 0 a 23, en el huso horario de la respuesta")
    count: int = Field(description="cantidad de interacciones con decision en esa celda")


class HeatmapResponse(BaseModel):
    """Mapa de calor de las interacciones por dia de la semana y hora, para el dashboard."""
    timezone: str = Field(description="huso horario con el que se armaron las celdas, nombre IANA")
    total_interactions: int = Field(description="cantidad de interacciones con decision bajo los filtros, es la suma de todas las celdas")
    cells: list[HeatmapCell] = Field(description="las 168 celdas, ordenadas por dia de la semana y despues por hora, las celdas sin interacciones traen count en cero")


class ProjectThresholdsItem(BaseModel):
    """Umbrales configurados de un proyecto."""
    project_id: str = Field(description="id del proyecto")
    threshold_auto_publish: float = Field(description="confidence_score minimo para publicar la respuesta sin revision humana")
    threshold_needs_review: float = Field(description="confidence_score minimo para pedir revision humana en vez de escalar directo")
    similarity_threshold: float = Field(description="similarity_score minimo para que un chunk recuperado se use como contexto")


class ProjectThresholdsResponse(BaseModel):
    """Umbrales configurados por proyecto, para que el dashboard dibuje las zonas de decision."""
    projects: list[ProjectThresholdsItem] = Field(description="un elemento por proyecto configurado, o solo el pedido si se indica project_id, los umbrales vacios traen el valor por defecto del pipeline")


class OnboardedProject(BaseModel):
    """Un proyecto dado de alta, con su id interno y sus umbrales."""
    project_id: str = Field(description="id interno del proyecto, es el que piden los endpoints que no aceptan project_key")
    key: str = Field(description="key del proyecto en JSM, por ejemplo TARG")
    name: str = Field(description="nombre del proyecto")
    country_code: str | None = Field(description="codigo del pais del proyecto, por ejemplo AR, o null si no tiene")
    language_code: str | None = Field(description="idioma principal del proyecto, o null si no se definio")
    is_active: bool = Field(description="si el proyecto esta activo")
    threshold_auto_publish: float = Field(description="confidence_score minimo para publicar sin revision humana, con el valor por defecto del pipeline si no esta cargado")
    threshold_needs_review: float = Field(description="confidence_score minimo para pedir revision humana, con el valor por defecto del pipeline si no esta cargado")
    similarity_threshold: float = Field(description="similarity_score minimo para usar un chunk como contexto, con el valor por defecto del pipeline si no esta cargado")


class OnboardedProjectsResponse(BaseModel):
    """Response con los proyectos dados de alta, para precargar la pantalla de configuracion."""
    projects: list[OnboardedProject] = Field(description="proyectos dados de alta, ordenados por key")


class ProjectCategoryItem(BaseModel):
    """Una categoria vinculada a un proyecto."""
    id: str = Field(description="id interno de la categoria")
    name: str = Field(description="nombre de la categoria, igual al valor real de JSM")
    is_active: bool = Field(description="si la categoria esta activa en el proyecto")


class ProjectStatusMappingItem(BaseModel):
    """Un mapeo de estado ya guardado para un proyecto."""
    status_id: str = Field(description="id interno del estado en ticket_status")
    status_name: str = Field(description="nombre del estado")
    system_action: str | None = Field(description="accion del sistema asociada al estado, o null si no tiene")
    is_active: bool = Field(description="si el mapeo esta activo")


class ProjectSpaceItem(BaseModel):
    """Un space de Confluence vinculado a un proyecto."""
    space_key: str = Field(description="key del space en Confluence")
    description: str | None = Field(description="descripcion del space, o null si no tiene")
    language_code: str | None = Field(description="idioma del contenido del space, o null si no se definio")
    country_code: str | None = Field(description="codigo del pais del space, o null si no tiene")
    is_active: bool = Field(description="si el space esta activo en el proyecto")


class ProjectConfigurationResponse(BaseModel):
    """Todo lo que tiene guardado un proyecto, para precargar la pantalla de configuracion."""
    project: OnboardedProject = Field(description="datos del proyecto")
    categories: list[ProjectCategoryItem] = Field(description="categorias vinculadas, ordenadas por nombre")
    request_types: list[ProjectRequestType] = Field(description="tipos de solicitud incorporados, ordenados por nombre")
    priority_mapping: dict[str, list[str]] = Field(description="mapeo de prioridades guardado, con la misma forma que recibe el POST, nivel universal y lista de ids reales de JSM")
    status_mappings: list[ProjectStatusMappingItem] = Field(description="mapeos de estado guardados, ordenados por nombre de estado")
    spaces: list[ProjectSpaceItem] = Field(description="spaces de Confluence vinculados, ordenados por key")


class ConnectionStatusResponse(BaseModel):
    """Estado de una conexion externa, JSM o Confluence, sin ningun secreto."""
    configured: bool = Field(description="true si la conexion esta completa, con url, email y token guardados")
    base_url: str | None = Field(description="url de la instancia, o null si todavia no se configuro")
    user_email: str | None = Field(description="email de la cuenta usada para autenticar, o null si todavia no se configuro, el token y el secreto del webhook nunca se devuelven")


class InteractionListItem(BaseModel):
    """Un item del listado paginado de interacciones."""
    interaction_id: str = Field(description="id de la interaccion")
    system_decision: str | None = Field(description="decision original del pipeline para esta interaccion, no cambia aunque una persona la revise despues")
    resolution_channel: str | None = Field(description="como se resolvio la interaccion (AUTO, REVIEWED_APPROVED, REVIEWED_REGENERATED, ESCALATED_BY_HUMAN o RESOLVED_EXTERNALLY), o null si todavia no se resolvio o no se puede determinar")
    issue_key: str = Field(description="key del ticket original en JSM, por ejemplo TARG-123")
    ticket_url: str | None = Field(description="enlace al ticket en JSM, o null si no se pudo resolver la url base de la conexion")
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
    issue_key: str = Field(description="key del ticket original en JSM, por ejemplo TARG-123")
    ticket_url: str | None = Field(description="enlace al ticket en JSM, o null si no se pudo resolver la url base de la conexion")
    summary: str | None = Field(description="resumen del ticket original")
    category: str | None = Field(description="categoria detectada por el sistema")
    priority: str | None = Field(description="prioridad del ticket")
    decision: str | None = Field(description="decision final del pipeline para esta interaccion")
    system_decision: str | None = Field(description="decision original del pipeline para esta interaccion, no cambia aunque una persona la revise despues")
    resolution_channel: str | None = Field(description="como se resolvio la interaccion (AUTO, REVIEWED_APPROVED, REVIEWED_REGENERATED, ESCALATED_BY_HUMAN o RESOLVED_EXTERNALLY), o null si todavia no se resolvio o no se puede determinar")
    confidence_score: float | None = Field(description="confidence_score de la respuesta generada")
    text_input: str | None = Field(description="texto original del ticket, usado como input del pipeline")
    generated_response: str | None = Field(description="respuesta generada por el sistema")
    created_at: str | None = Field(description="marca de tiempo de creacion de la interaccion")
    chunks: list[RetrievedChunkDetail] = Field(description="fragmentos de la base de conocimiento usados como contexto")