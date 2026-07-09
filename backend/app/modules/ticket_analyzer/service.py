#M2: TicketAnalyze, tiene la lógica principal de análisis y clasificación de solicitudes.


import logging
from app.modules.webhook_receiver.schemas import NormalizedEvent
from app.modules.ticket_analyzer.schemas import TicketAnalysis

logger = logging.getLogger(__name__)

# esquema de prioridades de tokenia  hardcodeado temporalmente
# TODO: leer de project_config cuando la feature para obtener esa info desde confluecne 
PRIORITY_SCHEMA = {
    ("seguridad_cuenta", "reporte_problema"):     "Highest",
    ("seguridad_cuenta", "reclamo"):              "Highest",
    ("seguridad_cuenta", "solicitud_accion"):     "Highest",
    ("seguridad_cuenta", "consulta_informativa"): "Highest",
    ("seguridad_cuenta", "cancelacion"):          "Highest",

    ("acceso_autenticacion", "reporte_problema"):     "High",
    ("acceso_autenticacion", "reclamo"):              "High",
    ("acceso_autenticacion", "solicitud_accion"):     "High",
    ("acceso_autenticacion", "consulta_informativa"): "Medium",
    ("acceso_autenticacion", "cancelacion"):          "Low",

    ("depositos_retiros", "reporte_problema"):     "High",
    ("depositos_retiros", "reclamo"):              "High",
    ("depositos_retiros", "solicitud_accion"):     "Medium",
    ("depositos_retiros", "consulta_informativa"): "Low",
    ("depositos_retiros", "cancelacion"):          "Medium",

    ("operaciones_crypto", "reporte_problema"):     "High",
    ("operaciones_crypto", "reclamo"):              "High",
    ("operaciones_crypto", "solicitud_accion"):     "Medium",
    ("operaciones_crypto", "consulta_informativa"): "Low",
    ("operaciones_crypto", "cancelacion"):          "Low",

    ("operaciones_fiat", "reporte_problema"):     "High",
    ("operaciones_fiat", "reclamo"):              "High",
    ("operaciones_fiat", "solicitud_accion"):     "Medium",
    ("operaciones_fiat", "consulta_informativa"): "Low",
    ("operaciones_fiat", "cancelacion"):          "Low",

    ("verificacion_identidad", "reporte_problema"):     "Medium",
    ("verificacion_identidad", "reclamo"):              "Medium",
    ("verificacion_identidad", "solicitud_accion"):     "Medium",
    ("verificacion_identidad", "consulta_informativa"): "Low",
    ("verificacion_identidad", "cancelacion"):          "Low",

    ("billetera_direcciones", "reporte_problema"):     "Medium",
    ("billetera_direcciones", "reclamo"):              "Medium",
    ("billetera_direcciones", "solicitud_accion"):     "Medium",
    ("billetera_direcciones", "consulta_informativa"): "Low",
    ("billetera_direcciones", "cancelacion"):          "Low",

    ("limites_restricciones", "reporte_problema"):     "Medium",
    ("limites_restricciones", "reclamo"):              "Medium",
    ("limites_restricciones", "solicitud_accion"):     "Low",
    ("limites_restricciones", "consulta_informativa"): "Low",
    ("limites_restricciones", "cancelacion"):          "Low",

    ("problemas_tecnicos", "reporte_problema"):     "Medium",
    ("problemas_tecnicos", "reclamo"):              "Medium",
    ("problemas_tecnicos", "solicitud_accion"):     "Low",
    ("problemas_tecnicos", "consulta_informativa"): "Low",
    ("problemas_tecnicos", "cancelacion"):          "Low",

    ("tarifas_comisiones", "reporte_problema"):     "Low",
    ("tarifas_comisiones", "reclamo"):              "Low",
    ("tarifas_comisiones", "solicitud_accion"):     "Low",
    ("tarifas_comisiones", "consulta_informativa"): "Low",
    ("tarifas_comisiones", "cancelacion"):          "Low",

    ("informacion_general", "reporte_problema"):     "Low",
    ("informacion_general", "reclamo"):              "Low",
    ("informacion_general", "solicitud_accion"):     "Low",
    ("informacion_general", "consulta_informativa"): "Low",
    ("informacion_general", "cancelacion"):          "Low",
}

# mapeo project_key y country para tokenia hardcre por ahora
PROJECT_COUNTRY = {
    "TGA": "AR",  #tokenia Argentina
    "TGB": "BR",  #tokenia Brasil
}


class TicketAnalyzer:

    def analyze(self, event: NormalizedEvent) -> TicketAnalysis:
        # punto de entrada, por ahora arma el objeto base con lo que llega de M1
        priority = self._determine_priority(event.priority)

        return TicketAnalysis(
            issue_key=event.issue_key,
            event_type=event.event_type,
            priority=priority,
            summary=event.summary,
        )

    #pendiente de implementar la logica de clasificacion, por ahora devuelve un diccionario sin nada
    def _classify(self, text: str) -> dict:

        return {}

    def _determine_priority(self, user_priority: str = None) -> str:
        # usa la prioridad del ticket por ahora
        # cuando esté CU27 completo, consulta project_priority en BD
        return user_priority or "Medium"