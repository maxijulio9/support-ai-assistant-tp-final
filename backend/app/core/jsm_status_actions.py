# valores validos para project_config.system_action
# vocabulario cerrado y compartido entre M7 y el orchestrator 

JSM_STATUS_ACTION_ESCALATE = "escalate"
JSM_STATUS_ACTION_AWAITING_CUSTOMER = "awaiting_customer"
JSM_STATUS_ACTION_RESOLVE = "resolve"
JSM_STATUS_ACTION_REQUEST_INFO = "request_info"
JSM_STATUS_ACTION_INITIAL = "initial"
JSM_STATUS_ACTION_RESOLVED = "resolved"


# acciones que el pipeline realmente lee de project_config.system_action, con lo que hace el sistema en cada una
# es el vocabulario que acepta el guardado del mapeo de estados y el que expone el endpoint para el selector
# resolve y request_info estan declaradas arriba pero ningun codigo las lee, por eso no se aceptan
CONFIGURABLE_STATUS_ACTIONS = {
    JSM_STATUS_ACTION_INITIAL: "Estado en el que JSM crea los tickets nuevos. El sistema solo reprocesa los comentarios del cliente en este estado y en el de espera del cliente.",
    JSM_STATUS_ACTION_AWAITING_CUSTOMER: "Estado al que pasa el ticket cuando el sistema respondió o pidió más información y queda esperando al cliente.",
    JSM_STATUS_ACTION_ESCALATE: "Estado al que pasa el ticket cuando el sistema lo escala a una persona.",
    JSM_STATUS_ACTION_RESOLVED: "Estado al que pasa el ticket cuando el cliente confirma que su consulta quedó resuelta.",
}
