"""Database engine, session, and declarative base.

Connection string comes from ``src.core.config`` (``DATABASE_URL`` env var
or ``backend/.env``, docker-compose overrides it in containers)::


    postgresql+psycopg://aarogya:aarogya_dev_password@db:5432/aarogya_db
"""

from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DATABASE_URL


# The database is the Supabase pooler in ap-southeast-2. A pre-ping is an extra
# round trip on every checkout, so stale connections are recycled by age instead.
engine = create_engine(DATABASE_URL, pool_pre_ping=False, pool_recycle=300)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency that yields a DB session and closes it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
