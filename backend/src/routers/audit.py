from __future__ import annotations

import datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.audit_log import AuditLog
from ..models.doctor import Doctor
from ..models.patient import Patient

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("")
def list_audit_logs(
    patient_id: str | None = None,
    doctor_id: str | None = None,
    action: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """List immutable audit log ledger records decorated with patient and doctor names."""
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
def record_break_glass(payload: dict[str, Any], db: Session = Depends(get_db)) -> dict[str, Any]:
    """Record an emergency break-glass override with clinical justification."""
    patient_id = payload.get("patient_id")
    doctor_id = payload.get("doctor_id")
    reason = payload.get("reason", "").strip()

    if not patient_id or not doctor_id:
        raise HTTPException(status_code=400, detail="patient_id and doctor_id are required")
    if not reason:
        raise HTTPException(status_code=400, detail="Clinical justification reason is required for emergency override")

    log_entry = AuditLog(
        patient_id=patient_id,
        doctor_id=doctor_id,
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
def create_audit_entry(payload: dict[str, Any], db: Session = Depends(get_db)) -> dict[str, Any]:
    """Record an audit trail event (e.g. READ, DENIED, VIEW_TIMELINE)."""
    patient_id = payload.get("patient_id")
    doctor_id = payload.get("doctor_id")
    action = payload.get("action", "READ")
    details = payload.get("details", "")

    # Debounce duplicate READ / DENIED logs from the same doctor for the same patient within the last 2 minutes
    if action in ("READ", "DENIED", "EMERGENCY_READ") and patient_id and doctor_id:
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
    patient_id: str = Query(...),
    doctor_id: str = Query(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Check if emergency access was recently logged for this patient and doctor."""
    since = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=24)
    stmt = (
        select(AuditLog)
        .where(
            AuditLog.patient_id == patient_id,
            AuditLog.doctor_id == doctor_id,
            AuditLog.action == "EMERGENCY_OVERRIDE",
            AuditLog.action_time >= since,
        )
        .order_by(AuditLog.action_time.desc())
    )
    has_emergency = db.scalar(stmt) is not None
    return {
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "has_emergency_access": has_emergency,
    }
