"""
Modulo 1: Webhook Receiver
Esquemas de entrada del payload raw de JSM y salida dekl evento normalizado).
"""

from pydantic import BaseModel
from typing import Optional


# payload raw que manda JSM 

class JsmUserRaw(BaseModel):
    accountId: str
    displayName: Optional[str] = None
    emailAddress: Optional[str] = None


class JsmStatusRaw(BaseModel):
    id: str
    name: Optional[str] = None


class JsmPriorityRaw(BaseModel):
    id: str
    name: Optional[str] = None


class JsmIssueTypeRaw(BaseModel):
    id: str
    name: Optional[str] = None


class JsmRequestTypeRaw(BaseModel):
    id: str
    name: Optional[str] = None


class JsmCustomField10010Raw(BaseModel):
    # campo personalizado de JSM que contiene el request type
    requestType: Optional[JsmRequestTypeRaw] = None


class JsmFieldsRaw(BaseModel):
    summary: Optional[str] = None
    description: Optional[dict] = None
    issuetype: Optional[JsmIssueTypeRaw] = None
    priority: Optional[JsmPriorityRaw] = None
    status: Optional[JsmStatusRaw] = None
    reporter: Optional[JsmUserRaw] = None
    assignee: Optional[JsmUserRaw] = None
    created: Optional[str] = None
    customfield_10010: Optional[JsmCustomField10010Raw] = None
    comment: Optional[dict] = None


class JsmIssueRaw(BaseModel):
    id: str
    key: str
    fields: Optional[JsmFieldsRaw] = None


class JsmWebhookPayload(BaseModel):
    # modelo del payload raw que JSM envía al webhook
    webhookEvent: str
    timestamp: Optional[int] = None
    issue: Optional[JsmIssueRaw] = None


# evento normalizado para consumo interno

class NormalizedEvent(BaseModel):
    # estructura limpia que M1 dispionibiliza a los demás módulos
    issue_key: str
    event_type: str
    summary: Optional[str] = None
    description: Optional[str] = None
    issue_type: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    reporter_id: Optional[str] = None
    reporter_email: Optional[str] = None
    request_type: Optional[str] = None
    created_at: Optional[str] = None
    comment_body: Optional[str] = None
    comment_author_id: Optional[str] = None