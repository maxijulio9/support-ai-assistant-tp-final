"""
MODULO 7: InternalAPI
Schemas para la configuracion de proyectos
Define la estructura de project_config: mapeo de transiciones de JSM,
pais asociado y umbrales de confianza/similitud por proyecto.
"""

from pydantic import BaseModel, Field


# umbrales de decision del pipeline, una fila por proyecto (columnas en la tabla project)
class ProjectThresholds(BaseModel):
    project_id: str
    threshold_auto_publish: float = Field(default=0.85, ge=0.0, le=1.0)
    threshold_needs_review: float = Field(default=0.60, ge=0.0, le=1.0)
    similarity_threshold: float = Field(default=0.40, ge=0.0, le=1.0)


# mapeo de una categoria generica de estado ITSM a la transicion real de JSM
# una fila por combinacion proyecto + estado (tabla project_config)
class ProjectStatusMapping(BaseModel):
    project_id: str
    status_id: str
    system_action: str | None = None
    is_active: bool = True


# request para el endpoint POST /api/config/itsm/projects (CU26)
class ProjectConfigRequest(BaseModel):
    thresholds: ProjectThresholds
    status_mappings: list[ProjectStatusMapping]


# response de confirmacion del endpoint
class ProjectConfigResponse(BaseModel):
    status: str
    mappings_configured: int
    

# request para aprobar una interaccion en NEEDS_REVIEW, publica la respuesta tal cual esta
class ApproveRequest(BaseModel):
    reviewed_by: str | None = None  # referencia logica al agente, sin FK hasta que exista M9


# request para regenerar una interaccion rechazada (CU17)
class RegenerateRequest(BaseModel):
    rejection_reason: str
    reviewed_by: str | None = None


# request para escalar una interaccion directo a un humano, sin generar nada nuevo
class EscalateRequest(BaseModel):
    rejection_reason: str | None = None
    reviewed_by: str | None = None


# response comun a las 3 acciones de revision
class InteractionReviewResponse(BaseModel):
    status: str
    action_type: str
    
# request para configurar la conexion con JSM
class ItsmConnectionRequest(BaseModel):
    base_url: str
    user_email: str
    api_token: str
    webhook_secret: str

# response de confirmacion
class ItsmConnectionResponse(BaseModel):
    status: str
    
# response con la lista de proyectos disponibles en jsm, para que el admin elija (CU27)
class AvailableProjectsResponse(BaseModel):
    projects: list[dict] 
    

# un proyecto elegido por el admin para dar de alta, con su pais correspondiente
class ProjectToOnboard(BaseModel):
    code: str
    name: str
    country_code: str


# request para dar de alta los proyectos elegidos (CU27)
class OnboardProjectsRequest(BaseModel):
    projects: list[ProjectToOnboard]


# response de confirmacion
class OnboardProjectsResponse(BaseModel):
    status: str
    projects_created: int

# response con los paises validos, para que el frontend arme el dropdown al dar de alta proyectos
class CountriesResponse(BaseModel):
    countries: list[dict]

# response con los estados reales de un proyecto de jsm, para el mapeo del admin (TF-122)
class ProjectStatusesResponse(BaseModel):
    statuses: list[dict]
    
    
# response con los campos custom de tipo lista de seleccion unica, para que el admin elija cual es categoria
class SelectFieldsResponse(BaseModel):
    fields: list[dict]

# request para confirmar las categorias elegidas por el admin para un proyecto
class ConfigureCategoriesRequest(BaseModel):
    categories: list[str]  # los valores crudos de jsm, tal cual, sin modificar


# response de confirmacion
class ConfigureCategoriesResponse(BaseModel):
    status: str
    categories_configured: int
    
class FieldOptionsResponse(BaseModel):
    options: list[str]