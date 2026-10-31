"""Backend configuration loaded from environment / ``backend/.env``.

Variables:
- ``DEBUG``: ``true``/``1``/``yes`` enables debug-only endpoints
  (e.g. ``POST /debug/sql``). Keep ``false`` in production.
- ``DATABASE_URL``: SQLAlchemy URL for the Supabase PostgreSQL database.
  Required. Docker Compose sets it.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
except ImportError:  # python-dotenv not installed; fall back to plain env vars
    pass


def _as_bool(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "y", "on"}


DEBUG: bool = _as_bool(os.getenv("DEBUG", "false"))

_database_url = os.getenv("DATABASE_URL", "").strip()
if not _database_url:
    raise RuntimeError(
        "DATABASE_URL is required. Set it to the Supabase PostgreSQL connection string."
    )
DATABASE_URL: str = _database_url

SESSION_SECRET: str = os.getenv("SESSION_SECRET", "arogya-link-dev-session-secret-change-me")
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://izgtbzxrruajihrbxzyx.supabase.co").strip()
SUPABASE_ANON_KEY: str = os.getenv(
    "SUPABASE_ANON_KEY",
    "sb_publishable_K0QhQQfypHet-L8BQOV44Q_D_UvI51j",
).strip()
CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
