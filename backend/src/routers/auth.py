from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..core.config import AUTH_MODE
from ..core.database import get_db
from ..core.identity import clean_email, find_account
from ..core.local_auth import authenticate_local, hash_password
from ..models.admin_user import AdminUser
from ..models.auth_user import AuthUser

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _require_local_auth() -> None:
    if AUTH_MODE != "local":
        raise HTTPException(
            status_code=404,
            detail="Local authentication is disabled. Set AUTH_MODE=local to enable it.",
        )


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


@router.post("/local/login")
def local_login(payload: dict[str, Any], db: Session = Depends(get_db)):
    """Verify an email/password against the local ``auth_user`` table."""
    _require_local_auth()
    email = clean_email(payload.get("email"))
    password = str(payload.get("password") or "")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    account = authenticate_local(db, email, password)
    if not account:
        # Deliberately generic to avoid confirming which emails exist.
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return {**account, "found": True}


@router.post("/local/password")
def set_local_password(payload: dict[str, Any], db: Session = Depends(get_db)):
    """Attach a password to an existing profile (first-time claim/registration).

    This deliberately refuses to overwrite an existing credential: a second
    caller must use the sign-in flow, never reset another user's password.
    """
    _require_local_auth()
    email = clean_email(payload.get("email"))
    password = str(payload.get("password") or "")
    role = str(payload.get("role") or "").strip().lower()
    user_id = str(payload.get("id") or "").strip() or None

    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if role not in {"admin", "doctor", "patient"}:
        raise HTTPException(status_code=400, detail="A valid account role is required")

    account = find_account(db, email)
    if not account:
        raise HTTPException(status_code=404, detail="No profile exists for this email.")
    if account["role"] != role:
        raise HTTPException(
            status_code=409,
            detail=f"This email belongs to the {account['role']} role, not {role}.",
        )
    if (account["id"] or None) != user_id:
        raise HTTPException(status_code=409, detail="Profile id does not match this email.")
    if db.get(AuthUser, email):
        raise HTTPException(
            status_code=409,
            detail="A password is already set for this account. Please sign in instead.",
        )

    db.add(
        AuthUser(
            email=email,
            password_hash=hash_password(password),
            role=role,
            user_id=user_id,
        )
    )
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": "ok", "email": email, "role": role}


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
