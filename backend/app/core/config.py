from pydantic_settings import BaseSettings


class Settings(BaseSettings):

    # LLM base
   # seleccion edl proveedor de llm activo
    llm_provider: str = "openai"  

    # OpenAI
    openai_api_key: str = ""
    openai_llm_model: str = "gpt-4o-mini"

    # Gemini
    gemini_api_key: str = ""
    gemini_llm_model: str = "gemini-2.5-flash"

    # Embeddings harcordeado siempre a openai
    openai_embedding_model: str = "text-embedding-3-small"
    # Database
    database_url: str = ""

    # Redis
    redis_url: str = "redis://redis:6379"
    debounce_ttl_seconds: int = 30
    history_ttl_seconds: int = 604800 #aprox 7 dias

    # JSM
    jsm_base_url: str = ""
    jsm_user_email: str = ""
    jsm_api_token: str = ""
    jsm_default_agent_id: str = ""

    # Confluence
    confluence_base_url: str = ""
    confluence_user_email: str = ""
    confluence_api_token: str = ""
    confluence_space_key: str = ""

    # secret key para encriptar credenciales externas
    app_secret_key: str = ""
    
    
    # JWT
    jwt_secret_key: str = ""
    jwt_expiration_minutes: int = 60

    # SendGrid, para el flujo de restablecimiento de contraseña
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = ""

    # url base del frontend, el link del mail de restablecimiento de contrasena apunta a esta direccion
    frontend_base_url: str = "http://localhost:4200"
    
    
    # bootstrap del primer admin, opcional, solo actua si app_user esta vacia
    admin_email: str = ""
    admin_password: str = ""

    # documentacion interactiva de la api, cerrada por defecto, ENABLE_API_DOCS=true la abre
    enable_api_docs: bool = False

    # pool de conexiones a la base, cada proceso de la api y de los workers abre el suyo
    db_pool_size: int = 10
    db_max_overflow: int = 10

    # limite de intentos, se cuenta por correo y no por ip
    login_max_attempts: int = 5
    login_window_seconds: int = 900
    forgot_password_max_per_email: int = 3
    forgot_password_max_global: int = 30
    forgot_password_window_seconds: int = 3600

    class Config:
        env_file = ".env"
    

settings = Settings()