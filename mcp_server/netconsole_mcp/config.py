from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="NETCONSOLE_", env_file=".env")

    api_url: str = "http://localhost/api/v1"
    api_key: str
    timeout_seconds: float = 30.0
    verify_ssl: bool = True


settings = Settings()
