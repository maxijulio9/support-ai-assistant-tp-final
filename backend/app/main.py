from fastapi import FastAPI
from app.modules.jsm_client.router import router as jsm_router


app = FastAPI(
    title="Sistema Inteligente de Asistencia",
    description="Sistema inteligente de asistencia para soporte nivel 1 en entornos ITSM",
    version="0.1.0",
)

app.include_router(jsm_router)

@app.get("/health")
def health():
    return {"status": "ok", "service": "support-ai-assistant-tp-final"}
