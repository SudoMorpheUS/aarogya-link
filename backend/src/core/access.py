"""Role and consent checks shared by the routers.

Clinical reads and the emergency override are decided here so a route cannot
forget them. READ, DENIED and EMERGENCY_READ are written by the API itself.
"""

from __future__ import annotations

import datetime
from typing import Any

from fastapi import HTTPException, Request
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..models.audit_log import AuditLog
from .actor import Actor

CLINICAL_SUFFIXES = ("/timeline", "/labs", "/prescriptions/active", "/chart")


def actor_from(request: Request) -> Actor:
    actor = getattr(request.state, "actor", None)
    if actor is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return actor


def require_roles(actor: Actor, *roles: str) -> None:
    if actor.role not in roles:
        raise HTTPException(status_code=403, detail="This action is not available for your role")


def authorize_request(method: str, path: str, actor: Actor) -> None:
    """Coarse rules that do not need a patient id. Fine checks live in the route."""
    if path.startswith("/debug"):
        require_roles(actor, "admin")
        return

    if actor.role is None:
        allowed = (
            (method == "GET" and path == "/api/auth/lookup")
            or (method == "POST" and path in {"/api/patients", "/api/doctors", "/api/auth/register-admin"})
        )
        if not allowed:
            raise HTTPException(status_code=403, detail="This account is not registered in AarogyaLink")
        return

    if path == "/api/stats":
        require_roles(actor, "doctor", "admin")
        return

    if path in {"/api/hospitals/caseload", "/api/consents/distribution"} or (
        path.startswith("/api/hospitals/") and path.endswith("/patients")
    ):
        require_roles(actor, "admin")
        return

    if path == "/api/duplicates" or path.startswith("/api/duplicates/"):
        require_roles(actor, "doctor", "admin")
        return

    if path == "/api/audit/break-glass":
        require_roles(actor, "doctor")
        return

    if actor.role == "patient" and path.startswith("/api/patients/"):
        parts = path.split("/")
        if len(parts) >= 4 and parts[3] and parts[3] != actor.id:
            raise HTTPException(status_code=403, detail="You can only open your own record")


def _has_consent(db: Session, patient_id: str, doctor_id: str) -> bool:
    return bool(db.scalar(text("SELECT fn_has_consent(:pid, :did)"), {"pid": patient_id, "did": doctor_id}))


def _has_emergency(db: Session, patient_id: str, doctor_id: str) -> bool:
    return bool(
        db.scalar(
            text("""
                SELECT EXISTS (
                    SELECT 1 FROM audit_log
                    WHERE patient_id = :pid
                      AND doctor_id = :did
                      AND action = 'EMERGENCY_OVERRIDE'
                      AND action_time >= (NOW() - INTERVAL '30 minutes')
                )
            """),
            {"pid": patient_id, "did": doctor_id},
        )
    )


def record_access(db: Session, patient_id: str, doctor_id: str | None, action: str, details: str) -> None:
    """Append one audit row. The same doctor action inside two minutes is kept once."""
    if action in {"READ", "DENIED", "EMERGENCY_READ"} and doctor_id:
        recent_threshold = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=2)
        recent = db.scalar(
            select(AuditLog.log_id)
            .where(
                AuditLog.patient_id == patient_id,
                AuditLog.doctor_id == doctor_id,
                AuditLog.action == action,
                AuditLog.action_time >= recent_threshold,
            )
            .limit(1)
        )
        if recent:
            return
    db.add(
        AuditLog(
            patient_id=patient_id,
            doctor_id=doctor_id,
            action=action,
            action_time=datetime.datetime.now(datetime.timezone.utc),
            details=details,
        )
    )
    db.commit()


def open_chart(db: Session, actor: Actor, patient_id: str) -> str:
    """Return how this caller may see the chart, or raise 403 after auditing a denial.

    The return value is ``self``, ``admin``, ``consent`` or ``emergency``.
    A patient check does not touch the database; the chart query reports a missing row.
    A doctor decision is one statement: the patient exists, consent, and the 30-minute window.
    """
    if actor.role == "patient":
        if actor.id != patient_id:
            raise HTTPException(status_code=403, detail="You can only open your own record")
        return "self"

    row = db.execute(
        text("""
            SELECT
                EXISTS (SELECT 1 FROM patient WHERE patient_id = :pid) AS found,
                CASE WHEN :did = '' THEN FALSE ELSE fn_has_consent(:pid, :did) END AS consent,
                EXISTS (
                    SELECT 1 FROM audit_log
                    WHERE patient_id = :pid
                      AND doctor_id = :did
                      AND :did <> ''
                      AND action = 'EMERGENCY_OVERRIDE'
                      AND action_time >= (NOW() - INTERVAL '30 minutes')
                ) AS emergency
        """),
        {"pid": patient_id, "did": actor.id or ""},
    ).one()
    if not row.found:
        raise HTTPException(status_code=404, detail="Patient not found")

    if actor.role == "admin":
        record_access(db, patient_id, None, "READ", "Administrator opened the chart")
        return "admin"

    if actor.role != "doctor" or not actor.id:
        raise HTTPException(status_code=403, detail="A doctor session is required")

    if row.consent:
        record_access(db, patient_id, actor.id, "READ", "Opened the chart with active consent")
        return "consent"

    if row.emergency:
        record_access(db, patient_id, actor.id, "EMERGENCY_READ", "Opened the chart inside the 30-minute emergency window")
        return "emergency"

    record_access(db, patient_id, actor.id, "DENIED", "Chart refused: no active consent and no emergency override")
    raise HTTPException(
        status_code=403,
        detail="Access Denied: No active consent or emergency break-glass override granted for this patient.",
    )


def assert_may_treat(db: Session, actor: Actor, patient_id: str) -> str:
    """A visit may be written only by the signed-in doctor, and only with access."""
    require_roles(actor, "doctor")
    access = open_chart(db, actor, patient_id)
    if access not in {"consent", "emergency"}:
        raise HTTPException(status_code=403, detail="You cannot record a visit for this patient")
    return access


def same_email(actor: Actor, email: str | None) -> None:
    left = (actor.email or "").strip().lower()
    right = (email or "").strip().lower()
    if not left or left != right:
        raise HTTPException(status_code=403, detail="The account email must match the signed-in Supabase user")
