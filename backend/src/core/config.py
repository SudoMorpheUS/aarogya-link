"""Backend configuration loaded from environment / ``backend/.env``.

Variables:
- ``DEBUG``: ``true``/``1``/``yes`` enables debug-only endpoints
  (e.g. ``POST /debug/sql``). Keep ``false`` in production.
- ``DATABASE_URL``: SQLAlchemy URL, e.g.
  ``postgresql+psycopg://aarogya:aarogya_dev_password@db:5432/aarogya_db``.
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

# ``supabase`` keeps the hosted Supabase Auth flow; ``local`` stores password
# hashes in the local PostgreSQL database (see database/local/).
AUTH_MODE: str = os.getenv("AUTH_MODE", "supabase").strip().lower()

DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://aarogya:aarogya_dev_password@localhost:5432/aarogya_db",
)
