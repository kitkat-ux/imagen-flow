from functools import lru_cache
from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    MASTER_KEY: str = "dev-only-replace-me-32-bytes-fernet-=="
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/app.db"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_db_url(cls, v: str) -> str:
        # Railway PostgreSQL plugin cung cấp postgresql:// — asyncpg cần postgresql+asyncpg://
        if isinstance(v, str) and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v
    DATA_DIR: str = "./data"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    LOG_LEVEL: str = "INFO"
    STORAGE_PROVIDER: str = ""
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_UPLOAD_PRESET: str = ""
    CLOUDINARY_FOLDER: str = "imagen-flow"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def data_dir_path(self) -> Path:
        p = Path(self.DATA_DIR)
        p.mkdir(parents=True, exist_ok=True)
        (p / "images").mkdir(exist_ok=True)
        (p / "thumbnails").mkdir(exist_ok=True)
        return p


@lru_cache
def get_settings() -> Settings:
    return Settings()
