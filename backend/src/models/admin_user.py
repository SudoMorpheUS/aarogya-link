"""``admin_user`` table. Created on startup (``main.py`` lifespan) if missing.

Administrators were previously kept in an in-memory list, so every admin that
registered was forgotten on restart and could also share an email with a
doctor or patient.
"""

from __future__ import annotations

import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class AdminUser(Base):
    __tablename__ = "admin_user"

    email: Mapped[str] = mapped_column(String(100), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"AdminUser(email={self.email!r})"
