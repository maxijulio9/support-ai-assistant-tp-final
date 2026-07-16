from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # OpenAI
    openai_api_key: str = ""
    openai_llm_model: str = "gpt-4o-mini"
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

    class Config:
        env_file = ".env"

settings = Settings()