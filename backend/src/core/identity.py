"""One email belongs to exactly one account: an admin, a doctor or a patient.

Every registration endpoint calls :func:`find_account` so that creating one role
can never produce (or collide with) a record in another role's table.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.database import engine
from ..models.admin_user import AdminUser
from ..models.doctor import Doctor
from ..models.patient import Patient

DEFAULT_ADMINS = [("admin@arogyalink.in", "Central Administrator")]


def ensure_admin_table() -> None:
    """Create ``admin_user`` if needed and make sure the default admin exists."""
    AdminUser.__table__.create(bind=engine, checkfirst=True)
    with Session(engine) as db:
        for email, name in DEFAULT_ADMINS:
            if not db.get(AdminUser, email):
                db.add(AdminUser(email=email, full_name=name))
        db.commit()


def clean_email(email: str | None) -> str:
    return (email or "").strip().lower()


def find_account(db: Session, email: str | None) -> dict[str, Any] | None:
    """Exact, case-insensitive email match across admin, doctor and patient."""
    email = clean_email(email)
    if not email:
        return None

    admin = db.scalar(select(AdminUser).where(func.lower(AdminUser.email) == email))
    if admin:
        return {"role": "admin", "id": None, "name": admin.full_name, "email": admin.email}

    doc = db.scalar(select(Doctor).where(func.lower(Doctor.email) == email))
    if doc:
        return {
            "role": "doctor",
            "id": doc.doctor_id,
            "name": doc.full_name,
            "email": doc.email,
            "hospital_id": doc.hospital_id,
            "specialization": doc.specialization,
        }

    pat = db.scalar(select(Patient).where(func.lower(Patient.email) == email))
    if pat:
        return {"role": "patient", "id": pat.patient_id, "name": pat.full_name, "email": pat.email}

    return None
