from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # PostgreSQL
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/interview_coach"

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"

    # Soniox
    soniox_api_key: str = ""

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"

    # Cloudflare R2
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "interview-coach-audio"
    r2_endpoint_url: str = ""

    # App
    app_env: str = "development"
    secret_key: str = "change_me_in_production"
    max_audio_file_size_mb: int = 200
    allowed_audio_extensions: str = "mp3,wav,m4a,ogg,webm"

    @property
    def allowed_extensions_set(self) -> set[str]:
        return {ext.strip() for ext in self.allowed_audio_extensions.split(",")}

    @property
    def celery_broker_url(self) -> str:
        return self.redis_url

    @property
    def celery_result_backend(self) -> str:
        return self.redis_url


settings = Settings()
