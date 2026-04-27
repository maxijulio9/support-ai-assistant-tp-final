"""Tests unitarios para M1 - Webhook Receiver."""


from app.modules.webhook_receiver.service import WebhookReceiver
from app.modules.webhook_receiver.schemas import JsmWebhookPayload, NormalizedEvent

receiver = WebhookReceiver()

# construye un payload de issue_created genérico para pruebas
def build_payload_issue_created(
    issue_key: str = "TEST-101",
    summary: str = "No puedo iniciar sesión en la plataforma",
    description_text: str = "Desde ayer no puedo ingresar a mi cuenta. Me aparece error de credenciales incorrectas.",
    priority: str = "Medium",
    status: str = "Abierto",
    reporter_id: str = "juan-test-001",
    reporter_email: str = "juan@gmail.com",
    request_type: str = "Portal JSM"
) -> JsmWebhookPayload:
    return JsmWebhookPayload(**{
        "webhookEvent": "jira:issue_created",
        "timestamp": 1745000000000,
        "issue": {
            "id": "10101",
            "key": issue_key,
            "fields": {
                "summary": summary,
                "description": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [
                                {"type": "text", "text": description_text}
                            ]
                        }
                    ]
                },
                "issuetype": {"id": "10001", "name": "Service Request"},
                "priority": {"id": "3", "name": priority},
                "status": {"id": "10000", "name": status},
                "reporter": {
                    "accountId": reporter_id,
                    "emailAddress": reporter_email
                },
                "customfield_10010": {
                    "requestType": {"id": "25", "name": request_type}
                }
            }
        }
    })

# 
#construye un payload de comment_created genérico para pruebas
def build_payload_comment_created(
    issue_key: str = "TEST-101",
    comment_text: str = "Mi email registrado es juan@gmail.com",
    author_id: str = "juan-test-001"
) -> JsmWebhookPayload:
    return JsmWebhookPayload(**{
        "webhookEvent": "jira:issue_updated",
        "timestamp": 1745000001000,
        "issue": {
            "id": "10101",
            "key": issue_key,
            "fields": {
                "summary": "No puedo iniciar sesión en la plataforma",
                "status": {"id": "10001", "name": "Esperando usuario"},
                "comment": {
                    "comments": [
                        {
                            "id": "20001",
                            "body": comment_text,
                            "author": {"accountId": author_id}
                        }
                    ]
                }
            }
        }
    })


#verifica que normalize_payload extrae los campos del payload raw que viene de jsm
def test_normalize_payload_issue_created():
    payload = build_payload_issue_created()
    event = receiver.normalize_payload(payload)

    assert event is not None
    assert event.issue_key == "TEST-101"
    assert event.event_type == "jira:issue_created"
    assert event.summary == "No puedo iniciar sesión en la plataforma"
    assert event.priority == "Medium"
    assert event.status == "Abierto"
    assert event.reporter_id == "juan-test-001"
    assert event.reporter_email == "juan@gmail.com"
    assert event.request_type == "Portal JSM"


# verifica que el texto plano se extrae  desde el formato ADF
def test_normalize_payload_extrae_descripcion_adf():
    descripcion = "Desde ayer no puedo ingresar a mi cuenta. Me aparece error de credenciales incorrectas."
    payload = build_payload_issue_created(description_text=descripcion)
    event = receiver.normalize_payload(payload)

    assert event.description == descripcion


# verifica normalización con prioridad alta y distinto issue_key
def test_normalize_payload_prioridad_alta():
    payload = build_payload_issue_created(
        issue_key="TEST-202",
        summary="Mi transferencia no aparece reflejada en la cuenta",
        priority="High"
    )
    event = receiver.normalize_payload(payload)

    assert event is not None
    assert event.issue_key == "TEST-202"
    assert event.priority == "High"


#verifica que normalize_payload retorna None si el payload no contiene issue
def test_normalize_payload_sin_issue():
    payload = JsmWebhookPayload(webhookEvent="jira:issue_created")
    event = receiver.normalize_payload(payload)

    assert event is None


    
#verifica que dispatch_event rutea issue_created al ticket_analyzer dle módilo 2
def test_dispatch_event_issue_created():
    event = NormalizedEvent(
        issue_key="TEST-101",
        event_type="jira:issue_created"
    )
    result = receiver.dispatch_event(event)

    assert result["status"] == "dispatched"
    assert result["route"] == "ticket_analyzer"
    assert result["issue_key"] == "TEST-101"


#verifica que dispatch_event rutea comentario de usuario al conversation_handler
def test_dispatch_event_comentario_usuario():
    event = NormalizedEvent(
        issue_key="TEST-101",
        event_type="jira:issue_updated"
    )
    result = receiver.dispatch_event(event)

    assert result["status"] == "dispatched"
    assert result["route"] == "conversation_handler"
    assert result["issue_key"] == "TEST-101"


# verifica que eventos no reconocidos retornan status ignored
def test_dispatch_event_ignorado():
    event = NormalizedEvent(
        issue_key="TEST-101",
        event_type="jira:unknown_event"
    )
    result = receiver.dispatch_event(event)

    assert result["status"] == "ignored"