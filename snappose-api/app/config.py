from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://snappose:snappose@localhost:5432/snappose"
    jwt_secret: str = "change-me-to-a-random-secret"
    admin_username: str = "admin"
    admin_password: str = "changeme123"
    cors_origins: str = "http://localhost:5173"

    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_bucket: str = "snappose"
    minio_secure: bool = False

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
