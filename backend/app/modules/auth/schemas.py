# M9 AuthModule
# define los objetos que maneja este módulo

from pydantic import BaseModel
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