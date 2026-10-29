from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.identity import clean_email, find_account
from ..models.admin_user import AdminUser

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/lookup")
def lookup_user(
    email: str = Query(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Look up which single role (admin, doctor or patient) owns an email.

    Matching is exact on the email. An unknown email is reported as
    ``found: false`` with no role, never guessed from a name or license.
    """
    clean = clean_email(email)
    account = find_account(db, clean)
    if account:
        return {**account, "found": True}
    return {"role": None, "id": None, "name": clean.split("@")[0], "email": clean, "found": False}


@router.post("/register-admin")
def register_admin(payload: dict[str, Any], db: Session = Depends(get_db)):
    """Register an administrator (only into ``admin_user``)."""
    email = clean_email(payload.get("email"))
    name = str(payload.get("name") or "Administrator").strip() or "Administrator"
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    owner = find_account(db, email)
    if owner and owner["role"] != "admin":
        raise HTTPException(
            status_code=409,
            detail=f"Email '{email}' is already registered under the {owner['role']} role and cannot be an administrator.",
        )
    if not owner:
        db.add(AdminUser(email=email, full_name=name))
        db.commit()
    return {"status": "ok", "role": "admin", "email": email, "name": owner["name"] if owner else name}
