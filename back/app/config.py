from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/art_classes"
    secret_key: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # За сколько часов до начала ещё можно отменить подтверждённую бронь
    cancel_deadline_hours: int = 24

    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    first_admin_email: str = "admin@example.com"
    first_admin_password: str = "admin12345"
    first_admin_first_name: str = "Admin"
    first_admin_last_name: str = "Admin"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
