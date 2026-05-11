import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Settings:
    app_name: str = "Splice API"
    app_version: str = "1.0.0"
    debug: bool = field(default_factory=lambda: os.getenv("SPLICE_DEBUG", "false").lower() == "true")

    db_path: str = field(default_factory=lambda: os.getenv("SPLICE_DB_PATH", "splice.db"))
    upload_dir: str = field(default_factory=lambda: os.getenv("SPLICE_UPLOAD_DIR", "uploads"))
    max_upload_size_mb: int = field(default_factory=lambda: int(os.getenv("SPLICE_MAX_UPLOAD_MB", "50")))

    jwt_secret: str = field(default_factory=lambda: os.getenv("SPLICE_JWT_SECRET", "dev-secret-change-in-production-32chars"))
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = field(default_factory=lambda: int(os.getenv("SPLICE_JWT_EXPIRE_MINUTES", "1440")))

    cors_origins: list = field(default_factory=lambda: os.getenv("SPLICE_CORS_ORIGINS", "*").split(","))
    rate_limit_per_minute: int = field(default_factory=lambda: int(os.getenv("SPLICE_RATE_LIMIT", "120")))
    max_connections: int = field(default_factory=lambda: int(os.getenv("SPLICE_MAX_CONNECTIONS", "10")))

    github_token: Optional[str] = field(default_factory=lambda: os.getenv("GITHUB_TOKEN"))
    file_cleanup_hours: int = field(default_factory=lambda: int(os.getenv("SPLICE_FILE_CLEANUP_HOURS", "72")))


settings = Settings()
