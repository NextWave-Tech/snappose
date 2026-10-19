from pydantic import ValidationInfo, field_validator
from pydantic_settings import BaseSettings

# The values .env.example used to ship with: anyone can read them in the repo, so they can't be secrets.
_PLACEHOLDER_SECRETS = {"change-me-to-a-random-secret", "changeme123"}
_MIN_JWT_SECRET_LENGTH = 32


class Settings(BaseSettings):
    database_url: str = "postgresql://snappose:snappose@localhost:5432/snappose"
    # No defaults for these two: the app won't start until .env sets its own (see .env.example).
    jwt_secret: str
    admin_username: str = "admin"
    admin_password: str
    cors_origins: str = "http://localhost:5173"
    # Comma-separated OAuth client ids whose Google ID tokens are accepted (the app's Web client id).
    google_client_ids: str = ""

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "snappose"
    minio_secure: bool = False

    class Config:
        env_file = ".env"
        extra = "ignore"

    @field_validator("jwt_secret", "admin_password")
    @classmethod
    def _reject_placeholder(cls, value: str, info: ValidationInfo) -> str:
        name = info.field_name.upper()
        if not value or value in _PLACEHOLDER_SECRETS:
            raise ValueError(f"{name} is empty or still the example value, set your own in .env")
        if info.field_name == "jwt_secret" and len(value) < _MIN_JWT_SECRET_LENGTH:
            raise ValueError(f"{name} must be at least {_MIN_JWT_SECRET_LENGTH} characters")
        return value


settings = Settings()
