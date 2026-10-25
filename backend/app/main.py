from fastapi import FastAPI
from app.modules.webhook_receiver.router import router as webhook_router
from app.modules.auth.router import router as auth_router
from app.modules.auth.bootstrap import bootstrap_admin
from app.modules.internal_api.router import router as internal_api_router
from app.modules.internal_api.webhook_secret_router import router as webhook_secret_router


app = FastAPI(
    title="Sistema Inteligente de Asistencia para Soporte Nivel 1 en entornos ITSM",
    description="Sistema inteligente de asistencia para soporte nivel 1 en entornos ITSM. Implementa RAG ",
    version="0.1.0",
)

app.include_router(webhook_router)
app.include_router(auth_router)
app.include_router(internal_api_router)
app.include_router(webhook_secret_router)


@app.on_event("startup")
def startup_event():
    bootstrap_admin()

@app.get("/health")
def health():
    return {"status": "ok", "service": "support-ai-assistant-tp-final"}
