from __future__ import annotations

import datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, text
from sqlalchemy.orm import Session, aliased

from ..core.access import actor_from
from ..core.database import get_db
from ..models.audit_log import AuditLog
from ..models.consent import Consent
from ..models.doctor import Doctor
from ..models.hospital import Hospital
from ..models.patient import Patient

router = APIRouter(prefix="/api/consents", tags=["consents"])

INDIAN_CITY_STATE = {
    "kolkata": ("Kolkata", "West Bengal"),
    "mumbai": ("Mumbai", "Maharashtra"),
    "bhopal": ("Bhopal", "Madhya Pradesh"),
    "hyderabad": ("Hyderabad", "Telangana"),
    "pune": ("Pune", "Maharashtra"),
    "nagpur": ("Nagpur", "Maharashtra"),
    "coimbatore": ("Coimbatore", "Tamil Nadu"),
    "lucknow": ("Lucknow", "Uttar Pradesh"),
    "jaipur": ("Jaipur", "Rajasthan"),
    "ahmedabad": ("Ahmedabad", "Gujarat"),
    "bangalore": ("Bengaluru", "Karnataka"),
    "bengaluru": ("Bengaluru", "Karnataka"),
    "bhubaneswar": ("Bhubaneswar", "Odisha"),
    "patna": ("Patna", "Bihar"),
    "visakhapatnam": ("Visakhapatnam", "Andhra Pradesh"),
    "chennai": ("Chennai", "Tamil Nadu"),
    "surat": ("Surat", "Gujarat"),
    "kochi": ("Kochi", "Kerala"),
    "delhi": ("Delhi", "Delhi"),
    "new delhi": ("Delhi", "Delhi"),
    "indore": ("Indore", "Madhya Pradesh"),
}


def extract_city_state(address: str | None) -> tuple[str, str]:
    if not address:
        return ("—", "—")
    addr_lower = address.lower()
    for key, (city, state) in INDIAN_CITY_STATE.items():
        if key in addr_lower:
            return (city, state)
    parts = [p.strip() for p in address.split(",") if p.strip()]
    if parts:
        return (parts[-1], "India")
    return ("—", "—")


@router.get("")
def list_consents(
    request: Request,
    patient_id: str | None = None,
    doctor_id: str | None = None,
    hospital_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=5000),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """List consent grants the caller is allowed to see."""
    actor = actor_from(request)
    if actor.role == "patient":
        patient_id = actor.id
    elif actor.role == "doctor":
        doctor_id = actor.id
    elif actor.role != "admin":
        raise HTTPException(status_code=403, detail="This action is not available for your role")
    DocHospital = aliased(Hospital)

    stmt = (
        select(
            Consent.consent_id,
            Consent.patient_id,
            Patient.full_name.label("patient_name"),
            Consent.hospital_id,
            Hospital.hospital_name,
            Hospital.address.label("hospital_address"),
            Consent.doctor_id,
            Doctor.full_name.label("doctor_name"),
            Doctor.specialization.label("doctor_specialization"),
            DocHospital.hospital_name.label("doctor_hospital_name"),
            DocHospital.address.label("doctor_hospital_address"),
            Consent.start_date,
            Consent.end_date,
            Consent.status,
        )
        .join(Patient, Consent.patient_id == Patient.patient_id)
        .outerjoin(Hospital, Consent.hospital_id == Hospital.hospital_id)
        .outerjoin(Doctor, Consent.doctor_id == Doctor.doctor_id)
        .outerjoin(DocHospital, Doctor.hospital_id == DocHospital.hospital_id)
        .order_by(Consent.start_date.desc(), Consent.consent_id.desc())
    )
    if patient_id:
        stmt = stmt.where(Consent.patient_id == patient_id)
    if doctor_id:
        stmt = stmt.where(Consent.doctor_id == doctor_id)
    if hospital_id:
        stmt = stmt.where(Consent.hospital_id == hospital_id)
    stmt = stmt.limit(limit)

    rows = db.execute(stmt).all()
    results = []
    for r in rows:
        is_doctor = bool(r.doctor_id)
        addr = r.doctor_hospital_address if is_doctor else r.hospital_address
        hosp_name = r.doctor_hospital_name if is_doctor else r.hospital_name
        city, state_name = extract_city_state(addr)
        results.append({
            "consent_id": r.consent_id,
            "patient_id": r.patient_id,
            "patient_name": r.patient_name,
            "hospital_id": r.hospital_id,
            "hospital_name": r.hospital_name,
            "hospital_address": r.hospital_address,
            "doctor_id": r.doctor_id,
            "doctor_name": r.doctor_name,
            "doctor_specialization": r.doctor_specialization,
            "doctor_hospital_name": r.doctor_hospital_name,
            "doctor_hospital_address": r.doctor_hospital_address,
            "resolved_hospital_name": hosp_name,
            "city": city,
            "state": state_name,
            "location": f"{city}, {state_name}" if city != "—" else "—",
            "start_date": r.start_date.isoformat() if r.start_date else "",
            "end_date": r.end_date.isoformat() if r.end_date else None,
            "status": r.status,
        })
    return results


@router.get("/distribution")
def get_patient_consent_distribution(
    limit: int = Query(default=100, ge=1, le=5000),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Return patient consent distribution showing which hospitals each patient has authorized."""
    sql = text("""
        SELECT 
            p.patient_id,
            p.full_name,
            p.contact_number,
            COUNT(c.consent_id) AS total_consents,
            COUNT(c.consent_id) FILTER (WHERE c.status = 'Active') AS active_consents,
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT h.hospital_name), NULL) AS consented_hospitals,
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT d.full_name), NULL) AS consented_doctors,
            MAX(c.end_date) AS latest_expiry
        FROM patient p
        JOIN consent c ON p.patient_id = c.patient_id
        LEFT JOIN hospital h ON c.hospital_id = h.hospital_id
        LEFT JOIN doctor d ON c.doctor_id = d.doctor_id
        GROUP BY p.patient_id, p.full_name, p.contact_number
        ORDER BY active_consents DESC, total_consents DESC
        LIMIT :limit
    """)
    rows = db.execute(sql, {"limit": limit}).mappings().all()
    return [
        {
            "patient_id": r["patient_id"],
            "full_name": r["full_name"],
            "contact_number": r["contact_number"],
            "total_consents": r["total_consents"],
            "active_consents": r["active_consents"],
            "consented_hospitals": r["consented_hospitals"] or [],
            "consented_doctors": r["consented_doctors"] or [],
            "latest_expiry": r["latest_expiry"].isoformat() if r["latest_expiry"] else None,
        }
        for r in rows
    ]


@router.post("", status_code=201)
def grant_consent(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Grant dynamic consent using stored procedure or direct insert and write to audit log."""
    actor = actor_from(request)
    patient_id = payload.get("patient_id")
    hospital_id = payload.get("hospital_id") or None
    doctor_id = payload.get("doctor_id") or None
    if actor.role == "patient":
        if patient_id != actor.id:
            raise HTTPException(status_code=403, detail="You can only grant consent for your own record")
    elif actor.role == "doctor":
        own_hospital = db.scalar(select(Doctor.hospital_id).where(Doctor.doctor_id == actor.id))
        if doctor_id and doctor_id != actor.id:
            raise HTTPException(status_code=403, detail="You can only grant consent that names you")
        if hospital_id and hospital_id != own_hospital:
            raise HTTPException(status_code=403, detail="You can only grant consent for your own hospital")
    elif actor.role != "admin":
        raise HTTPException(status_code=403, detail="You cannot grant consent")
    ist_tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    start_date_val = payload.get("start_date") or datetime.datetime.now(ist_tz).date().isoformat()
    end_date_val = payload.get("end_date") or None

    if not patient_id:
        raise HTTPException(status_code=400, detail="patient_id is required")
    if not hospital_id and not doctor_id:
        raise HTTPException(status_code=400, detail="Consent must target either a hospital or a doctor")

    new_id = None
    # Ensure sequence is synchronized before insert
    try:
        db.execute(text("SELECT setval('consent_consent_id_seq', (SELECT COALESCE(MAX(consent_id), 0) + 1 FROM consent), false)"))
        db.commit()
    except Exception:
        db.rollback()

    # Call the PostgreSQL stored procedure `sp_grant_consent`
    try:
        new_id = db.scalar(
            text(
                "SELECT sp_grant_consent(:pid, :hid, :did, :sdate::date, :edate::date)"
            ),
            {
                "pid": patient_id,
                "hid": hospital_id,
                "did": doctor_id,
                "sdate": start_date_val,
                "edate": end_date_val,
            },
        )
        db.commit()
    except Exception:
        db.rollback()
        # Fallback to direct ORM insert if procedure fails
        try:
            db.execute(text("SELECT setval('consent_consent_id_seq', (SELECT COALESCE(MAX(consent_id), 0) + 1 FROM consent), false)"))
            db.commit()
        except Exception:
            db.rollback()

        start_date = datetime.date.fromisoformat(start_date_val) if isinstance(start_date_val, str) else start_date_val
        end_date = datetime.date.fromisoformat(end_date_val) if end_date_val and isinstance(end_date_val, str) else end_date_val
        c = Consent(
            patient_id=patient_id,
            hospital_id=hospital_id,
            doctor_id=doctor_id,
            start_date=start_date,
            end_date=end_date,
            status="Active",
        )
        db.add(c)
        try:
            db.commit()
            db.refresh(c)
            new_id = c.consent_id
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(e)) from e

    # Write immutable audit log entry to PostgreSQL
    try:
        audit = AuditLog(
            patient_id=patient_id,
            doctor_id=doctor_id,
            action="CONSENT_CHANGE",
            action_time=datetime.datetime.now(),
            details=f"consent_id={new_id} status=Active hospital={hospital_id or '—'} doctor={doctor_id or '—'}",
        )
        db.add(audit)
        db.commit()
    except Exception as audit_err:
        print(f"Warning: failed to write consent audit log: {audit_err}")

    return {"consent_id": new_id, "status": "Active", "message": "Consent granted successfully"}


@router.post("/{consent_id}/revoke")
def revoke_consent(
    consent_id: int,
    request: Request,
    payload: dict[str, Any] | None = None,
    db: Session = Depends(get_db),
):
    """Revoke an active consent and record CONSENT_CHANGE in the audit log."""
    actor = actor_from(request)
    consent = db.scalar(select(Consent).where(Consent.consent_id == consent_id))
    if not consent:
        raise HTTPException(status_code=404, detail="Consent not found")
    if actor.role == "patient" and consent.patient_id != actor.id:
        raise HTTPException(status_code=403, detail="You can only revoke your own consent")
    if actor.role not in {"patient", "admin"}:
        raise HTTPException(status_code=403, detail="You cannot revoke this consent")

    ist_tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    today = datetime.datetime.now(ist_tz).date()
    now_ist = datetime.datetime.now(ist_tz)
    consent.status = "Revoked"
    consent.end_date = today
    try:
        audit = AuditLog(
            patient_id=consent.patient_id,
            doctor_id=consent.doctor_id,
            action="CONSENT_CHANGE",
            action_time=now_ist,
            details=f"consent_id={consent.consent_id} status=Revoked hospital={consent.hospital_id or '—'} doctor={consent.doctor_id or '—'}",
        )
        db.add(audit)
    except Exception as audit_err:
        print(f"Warning: failed to write revoke audit log: {audit_err}")

    # If revoking a doctor consent, also cascade revoke any duplicate active consents for this exact doctor
    if consent.doctor_id:
        other_doc_consents = db.scalars(
            select(Consent).where(
                Consent.patient_id == consent.patient_id,
                Consent.doctor_id == consent.doctor_id,
                Consent.consent_id != consent.consent_id,
                Consent.status == "Active",
            )
        ).all()
        for odc in other_doc_consents:
            odc.status = "Revoked"
            odc.end_date = today
            try:
                db.add(AuditLog(
                    patient_id=odc.patient_id,
                    doctor_id=odc.doctor_id,
                    action="CONSENT_CHANGE",
                    action_time=now_ist,
                    details=f"consent_id={odc.consent_id} status=Revoked doctor={odc.doctor_id} (doctor revoked)",
                ))
            except Exception:
                pass

    # If revoking a hospital consent, also cascade revoke any active consents for doctors at that hospital
    if consent.hospital_id:
        # 1. Any other active consent for this exact hospital
        other_hosp_consents = db.scalars(
            select(Consent).where(
                Consent.patient_id == consent.patient_id,
                Consent.hospital_id == consent.hospital_id,
                Consent.consent_id != consent.consent_id,
                Consent.status == "Active",
            )
        ).all()
        for ohc in other_hosp_consents:
            ohc.status = "Revoked"
            ohc.end_date = today
            try:
                db.add(AuditLog(
                    patient_id=ohc.patient_id,
                    doctor_id=None,
                    action="CONSENT_CHANGE",
                    action_time=datetime.datetime.now(),
                    details=f"consent_id={ohc.consent_id} status=Revoked hospital={consent.hospital_id} (hospital revoked)",
                ))
            except Exception:
                pass

        # 2. Any active consent for doctors practicing at this hospital
        doc_ids = db.scalars(select(Doctor.doctor_id).where(Doctor.hospital_id == consent.hospital_id)).all()
        if doc_ids:
            doctor_consents = db.scalars(
                select(Consent).where(
                    Consent.patient_id == consent.patient_id,
                    Consent.doctor_id.in_(doc_ids),
                    Consent.status == "Active",
                )
            ).all()
            for dc in doctor_consents:
                dc.status = "Revoked"
                dc.end_date = today
                try:
                    db.add(AuditLog(
                        patient_id=dc.patient_id,
                        doctor_id=dc.doctor_id,
                        action="CONSENT_CHANGE",
                        action_time=datetime.datetime.now(),
                        details=f"consent_id={dc.consent_id} status=Revoked hospital={consent.hospital_id} doctor={dc.doctor_id} (hospital revoked)",
                    ))
                except Exception:
                    pass

    db.commit()
    return {"consent_id": consent.consent_id, "status": "Revoked"}


@router.get("/check")
def check_consent(
    request: Request,
    patient_id: str = Query(...),
    doctor_id: str = Query(...),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Execute fn_has_consent(patient_id, doctor_id) stored function in PostgreSQL."""
    actor = actor_from(request)
    if actor.role == "doctor":
        doctor_id = actor.id or doctor_id
    elif actor.role == "patient":
        if patient_id != actor.id:
            raise HTTPException(status_code=403, detail="You can only open your own record")
    elif actor.role != "admin":
        raise HTTPException(status_code=403, detail="This action is not available for your role")
    try:
        has_consent = db.scalar(
            text("SELECT fn_has_consent(:pid, :did)"),
            {"pid": patient_id, "did": doctor_id},
        )
    except Exception:
        # Fallback query
        doc = db.scalar(select(Doctor).where(Doctor.doctor_id == doctor_id))
        if not doc:
            has_consent = False
        else:
            ist_tz = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
            today = datetime.datetime.now(ist_tz).date()
            consent = db.scalar(
                select(Consent).where(
                    Consent.patient_id == patient_id,
                    Consent.status == "Active",
                    Consent.start_date <= today,
                    (Consent.end_date.is_(None) | (Consent.end_date >= today)),
                    ((Consent.doctor_id == doctor_id) | (Consent.hospital_id == doc.hospital_id)),
                )
            )
            has_consent = consent is not None

    return {
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "has_consent": bool(has_consent),
    }


@router.delete("/{consent_id}")
def delete_consent(consent_id: int, request: Request, db: Session = Depends(get_db)):
    """Remove a consent row and leave a CONSENT_DELETE event in the audit log."""
    actor = actor_from(request)
    c = db.scalar(select(Consent).where(Consent.consent_id == consent_id))
    if not c:
        raise HTTPException(status_code=404, detail="Consent record not found")
    if actor.role == "patient" and c.patient_id != actor.id:
        raise HTTPException(status_code=403, detail="You can only delete your own consent")
    if actor.role not in {"patient", "admin"}:
        raise HTTPException(status_code=403, detail="You cannot delete this consent")
    try:
        db.add(
            AuditLog(
                patient_id=c.patient_id,
                doctor_id=c.doctor_id if actor.role != "admin" else c.doctor_id,
                action="CONSENT_DELETE",
                action_time=datetime.datetime.now(datetime.timezone.utc),
                details=(
                    f"consent_id={c.consent_id} status={c.status} "
                    f"hospital={c.hospital_id or '—'} doctor={c.doctor_id or '—'} "
                    f"deleted_by={actor.role}:{actor.email}"
                ),
            )
        )
        db.delete(c)
        db.commit()
        return {"status": "ok", "message": f"Consent {consent_id} permanently removed."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
