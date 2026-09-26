# M9 AuthModule
# define los objetos que maneja este módulo

from pydantic import BaseModel, Field
from datetime import datetime

class AppUser(BaseModel):
    id: str
    email: str
    password_hash: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class LoginRequest(BaseModel):
    email: str
    password: str = Field(max_length=72)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str