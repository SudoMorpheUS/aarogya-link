from __future__ import annotations

import datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..core.access import _has_consent, _has_emergency, actor_from, require_roles
from ..core.database import get_db
from ..models.audit_log import AuditLog
from ..models.doctor import Doctor
from ..models.patient import Patient

CLIENT_ACTIONS = {
    "READ",
    "DENIED",
    "EMERGENCY_READ",
    "CONSENT_CHANGE",
    "VIEW_TIMELINE",
    "VIEW_ALL_RECORDS",
    "VIEW_VISIT",
    "VIEW_RESULTS",
    "VIEW_MEDICINES",
    "VIEW_CARE_TEAM",
}

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("")
def list_audit_logs(
    request: Request,
    patient_id: str | None = None,
    doctor_id: str | None = None,
    action: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """List audit rows the caller is allowed to see.

    A patient sees their own record. A doctor sees rows they performed.
    An administrator sees the network log.
    """
    actor = actor_from(request)
    if actor.role == "patient":
        patient_id = actor.id
        doctor_id = None
    elif actor.role == "doctor":
        doctor_id = actor.id
    elif actor.role != "admin":
        raise HTTPException(status_code=403, detail="This action is not available for your role")
    stmt = (
        select(
            AuditLog.log_id,
            AuditLog.patient_id,
            Patient.full_name.label("patient_name"),
            AuditLog.doctor_id,
            Doctor.full_name.label("doctor_name"),
            AuditLog.action,
            AuditLog.action_time,
            AuditLog.details,
        )
        .outerjoin(Patient, AuditLog.patient_id == Patient.patient_id)
        .outerjoin(Doctor, AuditLog.doctor_id == Doctor.doctor_id)
        .order_by(AuditLog.action_time.desc(), AuditLog.log_id.desc())
    )
    if patient_id:
        stmt = stmt.where(AuditLog.patient_id == patient_id)
    if doctor_id:
        stmt = stmt.where(AuditLog.doctor_id == doctor_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    stmt = stmt.limit(limit)

    rows = db.execute(stmt).all()
    return [
        {
            "log_id": r.log_id,
            "patient_id": r.patient_id,
            "patient_name": r.patient_name or r.patient_id,
            "doctor_id": r.doctor_id,
            "doctor_name": r.doctor_name or (r.doctor_id or "System"),
            "action": r.action,
            "action_time": r.action_time.isoformat() if r.action_time else "",
            "details": r.details,
        }
        for r in rows
    ]


@router.post("/break-glass", status_code=201)
def record_break_glass(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Open a 30-minute emergency window for the signed-in doctor.

    The doctor id is taken from the session. The window is refused when that
    doctor already has active consent, and when the caller is not a doctor.
    """
    actor = actor_from(request)
    require_roles(actor, "doctor")
    patient_id = payload.get("patient_id")
    reason = str(payload.get("reason") or "").strip()

    if not patient_id:
        raise HTTPException(status_code=400, detail="patient_id is required")
    if not reason:
        raise HTTPException(status_code=400, detail="Clinical justification reason is required for emergency override")
    if not db.scalar(select(Patient.patient_id).where(Patient.patient_id == patient_id)):
        raise HTTPException(status_code=404, detail="Patient not found")
    if _has_consent(db, patient_id, actor.id or ""):
        raise HTTPException(
            status_code=409,
            detail="Active consent already covers this doctor. Emergency override is only for a doctor who lacks consent.",
        )

    log_entry = AuditLog(
        patient_id=patient_id,
        doctor_id=actor.id,
        action="EMERGENCY_OVERRIDE",
        action_time=datetime.datetime.now(datetime.timezone.utc),
        details=f"BREAK_GLASS: {reason}",
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return {
        "log_id": log_entry.log_id,
        "action": log_entry.action,
        "message": "Emergency access granted and recorded in tamper-evident audit ledger.",
    }


@router.post("", status_code=201)
def create_audit_entry(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Record a portal access event. The caller cannot mint an emergency override."""
    actor = actor_from(request)
    patient_id = payload.get("patient_id")
    doctor_id = payload.get("doctor_id")
    action = str(payload.get("action") or "READ")
    details = str(payload.get("details") or "")
    if action == "EMERGENCY_OVERRIDE":
        raise HTTPException(status_code=403, detail="Emergency override is recorded only by the break-glass endpoint")
    if action not in CLIENT_ACTIONS:
        raise HTTPException(status_code=400, detail="This audit action cannot be posted by a client")
    if actor.role == "doctor":
        doctor_id = actor.id
        if action in {"READ", "EMERGENCY_READ"}:
            has_consent = bool(actor.id) and _has_consent(db, str(patient_id), actor.id)
            has_emergency = bool(actor.id) and _has_emergency(db, str(patient_id), actor.id)
            if action == "READ" and not (has_consent or has_emergency):
                raise HTTPException(status_code=403, detail="A read is recorded only when you can open the chart")
            if action == "EMERGENCY_READ" and not has_emergency:
                raise HTTPException(status_code=403, detail="An emergency read is recorded only inside the 30-minute window")
    elif actor.role == "patient":
        if patient_id != actor.id:
            raise HTTPException(status_code=403, detail="You can only record events for your own patient ID")
    elif actor.role != "admin":
        raise HTTPException(status_code=403, detail="Access events are recorded when a chart is opened")
    if not patient_id:
        raise HTTPException(status_code=400, detail="patient_id is required")

    # Debounce duplicate logs for the same patient within the last 2 minutes
    if action in ("READ", "DENIED", "EMERGENCY_READ", "VIEW_ALL_RECORDS", "VIEW_VISIT") and patient_id:
        recent_threshold = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=2)
        recent_log = db.scalar(
            select(AuditLog)
            .where(
                AuditLog.patient_id == patient_id,
                AuditLog.doctor_id == doctor_id,
                AuditLog.action == action,
                AuditLog.action_time >= recent_threshold,
            )
            .order_by(AuditLog.action_time.desc())
        )
        if recent_log:
            return {"log_id": recent_log.log_id, "action": recent_log.action, "status": "debounced"}

    log_entry = AuditLog(
        patient_id=patient_id,
        doctor_id=doctor_id,
        action=action,
        action_time=datetime.datetime.now(datetime.timezone.utc),
        details=details,
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return {"log_id": log_entry.log_id, "action": log_entry.action}



@router.get("/emergency-check")
def check_emergency_access(
    request: Request,
    patient_id: str = Query(...),
    doctor_id: str = Query(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Check if a break-glass override is still inside the 30-minute window.

    The same interval is enforced when a chart is opened. Both use the
    database clock so the portal and the chart cannot disagree. A doctor can
    check only their own window.
    """
    actor = actor_from(request)
    if actor.role == "doctor":
        doctor_id = actor.id or doctor_id
    elif actor.role == "patient":
        if patient_id != actor.id:
            raise HTTPException(status_code=403, detail="You can only open your own record")
    elif actor.role != "admin":
        raise HTTPException(status_code=403, detail="This action is not available for your role")
    has_emergency = db.scalar(
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
    return {
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "has_emergency_access": has_emergency,
    }
