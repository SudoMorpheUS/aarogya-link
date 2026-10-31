"""Resolve the caller from a verified Supabase token or the signed session cookie.

The email and role never come from a query string or a JSON body. A bearer
token is checked with Supabase Auth. The portal cookie is the HMAC session
issued only after that check.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .config import SESSION_SECRET, SUPABASE_ANON_KEY, SUPABASE_URL
from .identity import find_account

_TOKEN_CACHE: dict[str, tuple[float, str]] = {}
_TOKEN_TTL_SECONDS = 300
_ACCOUNT_CACHE: dict[str, tuple[float, dict]] = {}
_ACCOUNT_TTL_SECONDS = 60


@dataclass(frozen=True)
class Actor:
    email: str
    role: str | None
    id: str | None
    name: str


def _b64url_decode(value: str) -> bytes:
    pad = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + pad)


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def email_from_supabase_token(token: str) -> str:
    """Return the email Supabase put in this access token.

    Successful answers are cached for a few minutes so a chart request does
    not call Supabase Auth again. The cache key is a hash of the token.
    """
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    cached = _TOKEN_CACHE.get(digest)
    now = time.time()
    if cached and cached[0] > now:
        return cached[1]

    request = urllib.request.Request(
        f"{SUPABASE_URL.rstrip('/')}/auth/v1/user",
        headers={
            "Authorization": f"Bearer {token}",
            "apikey": SUPABASE_ANON_KEY,
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise HTTPException(status_code=401, detail="Supabase access token was rejected") from exc
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Supabase access token could not be verified") from exc

    email = str(payload.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="Supabase access token has no email")
    _TOKEN_CACHE[digest] = (now + _TOKEN_TTL_SECONDS, email)
    return email


def _cached_account(email: str) -> dict | None:
    """Remember a known account for a minute so a page of API calls shares one lookup."""
    key = email.strip().lower()
    now = time.time()
    hit = _ACCOUNT_CACHE.get(key)
    if hit and hit[0] > now:
        return hit[1]
    from .database import SessionLocal

    db = SessionLocal()
    try:
        account = find_account(db, key)
    finally:
        db.close()
    if account:
        _ACCOUNT_CACHE[key] = (now + _ACCOUNT_TTL_SECONDS, account)
    return account


def _session_payload(raw: str) -> dict:
    """Accept the httpOnly al_session value. A forged or expired cookie is rejected."""
    parts = raw.split(".")
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise HTTPException(status_code=401, detail="Session cookie is invalid")
    body, signature = parts
    expected = _b64url_encode(
        hmac.new(SESSION_SECRET.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
    )
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Session cookie is invalid")
    try:
        payload = json.loads(_b64url_decode(body))
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Session cookie is invalid") from exc
    expires = payload.get("exp")
    if isinstance(expires, (int, float)) and time.time() * 1000 > float(expires):
        raise HTTPException(status_code=401, detail="Session cookie has expired")
    email = str(payload.get("email") or "").strip().lower()
    role = payload.get("role")
    if role not in {"admin", "doctor", "patient"} or not email:
        raise HTTPException(status_code=401, detail="Session cookie is invalid")
    return payload


def _actor_from_account(payload_email: str, payload_role: str, payload_id, account: dict | None) -> Actor:
    if not account or account["role"] != payload_role:
        raise HTTPException(status_code=401, detail="Session no longer matches an account")
    if payload_role != "admin" and account.get("id") and payload_id not in {None, account.get("id")}:
        raise HTTPException(status_code=401, detail="Session no longer matches an account")
    return Actor(
        email=str(account["email"]).strip().lower(),
        role=account["role"],
        id=account.get("id"),
        name=account.get("name") or payload_email,
    )


def actor_from_session(raw: str, db: Session | None = None) -> Actor:
    """Accept the httpOnly al_session value. A forged or expired cookie is rejected."""
    payload = _session_payload(raw)
    email = str(payload.get("email") or "").strip().lower()
    account = _cached_account(email) if db is None else find_account(db, email)
    return _actor_from_account(email, payload.get("role"), payload.get("id"), account)


def actor_from_bearer(token: str, db: Session | None = None) -> Actor:
    email = email_from_supabase_token(token)
    account = _cached_account(email) if db is None else find_account(db, email)
    if not account:
        return Actor(email=email, role=None, id=None, name=email.split("@")[0])
    return Actor(
        email=str(account["email"]).strip().lower(),
        role=account["role"],
        id=account.get("id"),
        name=account.get("name") or email,
    )


def resolve_actor(authorization: str | None, session_header: str | None, db: Session | None = None) -> Actor | None:
    """Prefer the signed portal session. Fall back to a Supabase bearer token."""
    if session_header:
        return actor_from_session(session_header.strip(), db)
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        if token:
            return actor_from_bearer(token, db)
    return None
