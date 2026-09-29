# M9 AuthModule
# define los objetos que maneja este módulo

from typing import Literal
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

class CreateUserRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=72)
    full_name: str
    role: Literal["admin", "agent"]


# expone los datos publicos de un usuario, sin password_hash
class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime


class UserListResponse(BaseModel):
    users: list[UserResponse]
    
class UpdateUserRequest(BaseModel):
    full_name: str
    role: Literal["admin", "agent"]