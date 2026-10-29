"""Local (self-hosted PostgreSQL) authentication helpers.

The hosted deployment uses Supabase Auth. When ``AUTH_MODE=local`` the same
application stores password hashes in ``public.auth_user`` instead, so the
entire stack can run inside Docker without any Supabase dependency.

Passwords are salted PBKDF2-HMAC-SHA256 hashes; no plaintext password is ever
written to the database or logs.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import secrets

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..models.auth_user import AuthUser
from .database import SessionLocal, engine
from .identity import find_account

PBKDF2_ITERATIONS = 600_000

# Accounts shipped with the demo dataset. Their local password is the same one
# shown on the sign-in card. Other seeded users can claim their profile from the
# Create Account tab the first time they use local authentication.
DEMO_PASSWORD = "AarogyaLink@123"
DEMO_EMAILS = frozenset(
    {
        "admin@arogyalink.in",
        "mudit@gmail.com",
        "karthik.iyer@example.in",
        "devansh.gupta@example.in",
        "meera.nair@example.in",
        "rohan.mehta@example.in",
        "nisha.kapoor@example.in",
        "vikram.sharma@example.in",
    }
)


def _b64(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


def hash_password(password: str) -> str:
    """Return a self-describing PBKDF2 hash: scheme$iterations$salt$digest."""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt_b64, digest_b64 = stored.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64.encode("ascii"))
        expected = base64.b64decode(digest_b64.encode("ascii"))
        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            int(iterations),
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError, binascii.Error):
        return False


def _store_demo_account(db: Session, email: str, password: str) -> AuthUser | None:
    """Create a local auth row for a known demo email on first use."""
    if email not in DEMO_EMAILS or password != DEMO_PASSWORD:
        return None
    if db.get(AuthUser, email):
        return db.get(AuthUser, email)
    account = find_account(db, email)
    if not account:
        return None
    auth = AuthUser(
        email=email,
        password_hash=hash_password(password),
        role=account["role"],
        user_id=account["id"],
    )
    db.add(auth)
    db.commit()
    db.refresh(auth)
    return auth


def ensure_local_auth() -> None:
    """Create/secure ``auth_user`` and seed the demo accounts.

    Safe to run on every backend start. The local compose stack creates the
    table from ``database/local/00_local_auth_compat.sql`` first; this function
    also covers an existing data directory that predates that file.
    """
    AuthUser.__table__.create(bind=engine, checkfirst=True)

    with SessionLocal() as db:
        # Even though only the FastAPI service (postgres superuser) should read
        # password hashes, lock the table down for the Supabase-style roles.
        try:
            db.execute(text("ALTER TABLE public.auth_user ENABLE ROW LEVEL SECURITY"))
            db.execute(text("ALTER TABLE public.auth_user FORCE ROW LEVEL SECURITY"))
            db.execute(text("REVOKE ALL PRIVILEGES ON TABLE public.auth_user FROM anon, authenticated"))
            db.execute(text("DROP POLICY IF EXISTS auth_user_service_role_all ON public.auth_user"))
            db.execute(
                text(
                    "CREATE POLICY auth_user_service_role_all ON public.auth_user "
                    "FOR ALL TO service_role USING (true) WITH CHECK (true)"
                )
            )
            db.commit()
        except Exception as exc:  # roles may not exist outside the local stack
            db.rollback()
            print(f"Warning: could not lock down auth_user: {exc}")

        for email in sorted(DEMO_EMAILS):
            if db.get(AuthUser, email):
                continue
            account = find_account(db, email)
            if not account:
                continue
            db.add(
                AuthUser(
                    email=email,
                    password_hash=hash_password(DEMO_PASSWORD),
                    role=account["role"],
                    user_id=account["id"],
                )
            )
        db.commit()


def authenticate_local(db: Session, email: str, password: str) -> dict | None:
    """Verify a local password and return the matching application account."""
    auth = db.get(AuthUser, email)
    if not auth:
        auth = _store_demo_account(db, email, password)
    if not auth or not verify_password(password, auth.password_hash):
        return None
    account = find_account(db, email)
    if not account:
        return None
    return account
