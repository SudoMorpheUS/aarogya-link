"""``auth_user`` table for self-hosted (``AUTH_MODE=local``) authentication.

The hosted deployment keeps credentials in Supabase Auth. This table is only
used when the stack runs against the local PostgreSQL container.
"""

from __future__ import annotations

import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class AuthUser(Base):
    __tablename__ = "auth_user"

    email: Mapped[str] = mapped_column(String(100), primary_key=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(10), nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"AuthUser(email={self.email!r}, role={self.role!r})"
