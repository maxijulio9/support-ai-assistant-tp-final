from fastapi import FastAPI

app = FastAPI(
    title="Sistema Inteligente de Asistencia",
    description="Sistema inteligente de asistencia para soporte nivel 1 en entornos ITSM",
    version="0.1.0",
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "support-ai-assistant-tp-final"}
