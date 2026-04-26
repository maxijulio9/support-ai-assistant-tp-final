from fastapi import FastAPI
# from app.modules.jsm_client.router import router as jsm_router
from app.modules.webhook_receiver.router import router as webhook_router


app = FastAPI(
    title="Sistema Inteligente de Asistencia para Soporte Nivel 1 en entornos ITSM",
    description="Sistema inteligente de asistencia para soporte nivel 1 en entornos ITSM. Implementa RAG ",
    version="0.1.0",
)

# app.include_router(jsm_router)
app.include_router(webhook_router)

@app.get("/health")
def health():
    return {"status": "ok", "service": "support-ai-assistant-tp-final"}
