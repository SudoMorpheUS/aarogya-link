from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from ..core.access import actor_from, same_email
from ..core.database import get_db
from ..core.identity import clean_email, find_account
from ..models.admin_user import AdminUser

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/lookup")
def lookup_user(
    request: Request,
    email: str = Query(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Look up which single role owns an email.

    The email comes from the verified Supabase user. An administrator may
    look up another address. Anyone else receives only their own account.
    """
    actor = actor_from(request)
    clean = actor.email if actor.role != "admin" else clean_email(email)
    account = find_account(db, clean)
    if account:
        return {**account, "found": True}
    return {"role": None, "id": None, "name": clean.split("@")[0], "email": clean, "found": False}


@router.post("/register-admin")
def register_admin(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)):
    """Register an administrator (only into ``admin_user``)."""
    actor = actor_from(request)
    email = clean_email(payload.get("email"))
    name = str(payload.get("name") or "Administrator").strip() or "Administrator"
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if actor.role is None:
        same_email(actor, email)
    elif actor.role != "admin":
        raise HTTPException(status_code=403, detail="You cannot register an administrator")

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
