from pydantic import BaseModel
from typing import Optional

class JsmUser(BaseModel):
    accountId: str
    displayName: Optional[str] = None
    emailAddress: Optional[str] = None

class JsmRequestType(BaseModel):
    id: str
    name: Optional[str] = None

class JsmComment(BaseModel):
    id: str
    body: Optional[str] = None
    author: Optional[JsmUser] = None
    created: Optional[str] = None

class JsmIssue(BaseModel):
    id: str
    key: str
    summary: Optional[str] = None
    description: Optional[str] = None
    issueType: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    reporter: Optional[JsmUser] = None
    assignee: Optional[JsmUser] = None
    requestType: Optional[JsmRequestType] = None
    created: Optional[str] = None
    comment: Optional[JsmComment] = None

class JsmWebhookPayload(BaseModel):
    webhookEvent: str
    issue: Optional[JsmIssue] = None