"""
Modulo 1: Webhook Receiver
contiene la lógica de validación, normalización y despacho de eventos de JSM
"""

from app.modules.webhook_receiver.schemas import JsmWebhookPayload, NormalizedEvent


def _extract_plain_text(adf_node: dict) -> str:
    # extrae texto plano desde el formato ADF (Atlassian Document Format)
    # es un JSON anidado con nodos de tipo paragraph, text, etc.
    if not adf_node:
        return ""
    
    texts = []
    
    def _traverse(node: dict):
        if not isinstance(node, dict):
            return
        if node.get("type") == "text":
            texts.append(node.get("text", ""))
        for child in node.get("content", []):
            _traverse(child)
    
    _traverse(adf_node)
    return " ".join(texts).strip()


def normalize_payload(payload: JsmWebhookPayload) -> NormalizedEvent | None:
    # convierte el payload raw de JSM a un evento normalizado para uso interno
    # retorna None si el evento no es procesable
    if not payload.issue:
        return None

    issue = payload.issue
    fields = issue.fields

    if not fields:
        return None

    # extrae texto plano de la descripción en formato ADF
    description_text = _extract_plain_text(fields.description) if fields.description else None

    # extrae request type desde el campo personalizado de JSM
    request_type = None
    if fields.customfield_10010 and fields.customfield_10010.requestType:
        request_type = fields.customfield_10010.requestType.name

    # extrae datos del comentario si el evento es comment_created
    comment_body = None
    comment_author_id = None
    if payload.webhookEvent == "jira:issue_updated" and fields.comment:
        comments = fields.comment.get("comments", [])
        if comments:
            last_comment = comments[-1]
            comment_body = last_comment.get("body", "")
            author = last_comment.get("author", {})
            comment_author_id = author.get("accountId")

    return NormalizedEvent(
        issue_key=issue.key,
        event_type=payload.webhookEvent,
        summary=fields.summary,
        description=description_text,
        issue_type=fields.issuetype.name if fields.issuetype else None,
        priority=fields.priority.name if fields.priority else None,
        status=fields.status.name if fields.status else None,
        reporter_id=fields.reporter.accountId if fields.reporter else None,
        reporter_email=fields.reporter.emailAddress if fields.reporter else None,
        request_type=request_type,
        created_at=fields.created,
        comment_body=comment_body,
        comment_author_id=comment_author_id,
    )


def dispatch_event(event: NormalizedEvent) -> dict:
    # determina la ruta del evento y lo despacha al módulo correspondiente
    # por ahora retorna el evento normalizado — integración con Redis viene en siguiente iteración

    if event.event_type == "jira:issue_created":
        # nuevo ticket → flujo principal → M2 Ticket Analyzer
        print(f"[M1] issue_created recibido: {event.issue_key}")
        return {"status": "dispatched", "route": "ticket_analyzer", "issue_key": event.issue_key}

    if event.event_type == "jira:issue_updated":
        # comentario de usuario → flujo de conversación
        print(f"[M1] comment_created recibido: {event.issue_key}")
        return {"status": "dispatched", "route": "conversation_handler", "issue_key": event.issue_key}

    # evento no reconocido → ignorar
    return {"status": "ignored", "event_type": event.event_type}