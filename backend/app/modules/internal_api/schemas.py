"""
MODULO 7: InternalAPI
Schemas para la configuracion de proyectos
Define la estructura de project_config: mapeo de transiciones de JSM,
pais asociado y umbrales de confianza/similitud por proyecto.
"""

from pydantic import BaseModel, Field


# configuracion completa de un proyecto ITSM, la carga el Admin desde el dashboard
class ProjectConfig(BaseModel):
    project_key: str
    country: str

    # transition_id de JSM para cada categoria generica de estado ITSM
    # el admin mapea estas categorias a los transition_id reales de su flujo,
    # no todas las organizaciones van a tener las 5 diferenciadas
    transition_id_inicio: str | None = None
    transition_id_resolucion: str | None = None
    transition_id_escalamiento: str | None = None
    transition_id_espera_usuario: str | None = None
    transition_id_cancelacion: str | None = None

    # umbrales de confianza de M4, sobre la respuesta ya generada
    threshold_auto_publish: float = Field(default=0.85, ge=0.0, le=1.0)
    threshold_needs_review: float = Field(default=0.60, ge=0.0, le=1.0)

    # umbral de similitud coseno de M3, sobre la recuperacion semantica
    similarity_threshold: float = Field(default=0.40, ge=0.0, le=1.0)


# request para el endpoint POST /api/config/itsm/projects
class ProjectConfigRequest(BaseModel):
    projects: list[ProjectConfig]


# response de confirmacion del endpoint
class ProjectConfigResponse(BaseModel):
    status: str
    projects_configured: int