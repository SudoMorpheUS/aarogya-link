from __future__ import annotations

import datetime
import json
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from ..core.access import actor_from, open_chart, record_access, require_roles, same_email
from ..core.chart_sql import CHART_SQL
from ..core.database import get_db
from ..core.identity import clean_email, find_account
from ..models.patient import Patient

router = APIRouter(prefix="/api/patients", tags=["patients"])


def _patient_dict(p: Patient) -> dict[str, Any]:
    return {
        "patient_id": p.patient_id,
        "full_name": p.full_name,
        "date_of_birth": p.date_of_birth.isoformat() if p.date_of_birth else "",
        "gender": p.gender,
        "blood_group": p.blood_group,
        "contact_number": p.contact_number,
        "email": p.email,
    }


def _load_chart(db: Session, patient_id: str) -> dict[str, Any]:
    """One SQL round trip. The JSON shape matches the portal's chart fields."""
    raw = db.scalar(text(CHART_SQL), {"pid": patient_id})
    data = json.loads(raw) if isinstance(raw, str) else raw
    if not isinstance(data, dict) or not data.get("patient"):
        raise HTTPException(status_code=404, detail="Patient not found")
    for key in ("timeline", "labs", "prescriptions", "consents"):
        if not isinstance(data.get(key), list):
            data[key] = []
    data["access_events"] = int(data.get("access_events") or 0)
    return data


@router.get("")
def list_patients(
    request: Request,
    q: str = Query(default="", description="Search query by name, ID, or email"),
    limit: int = Query(default=100, ge=1, le=5000),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Search and list patients. A patient receives only their own row."""
    actor = actor_from(request)
    if actor.role == "patient":
        own = db.scalar(select(Patient).where(Patient.patient_id == actor.id)) if actor.id else None
        return [_patient_dict(own)] if own else []
    require_roles(actor, "doctor", "admin")
    stmt = select(Patient)
    if q.strip():
        search = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Patient.full_name).like(search),
                func.lower(Patient.patient_id).like(search),
                func.lower(Patient.email).like(search),
                Patient.contact_number.like(search),
            )
        )
    stmt = stmt.order_by(Patient.patient_id.desc()).limit(limit)
    patients = db.scalars(stmt).all()

    results = []
    for p in patients:
        results.append({
            "patient_id": p.patient_id,
            "full_name": p.full_name,
            "date_of_birth": p.date_of_birth.isoformat() if p.date_of_birth else "",
            "gender": p.gender,
            "blood_group": p.blood_group,
            "contact_number": p.contact_number,
            "email": p.email,
        })
    return results


@router.get("/{patient_id}")
def get_patient(patient_id: str, request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Demographics for a signed-in doctor, admin, or the patient themselves."""
    actor = actor_from(request)
    require_roles(actor, "patient", "doctor", "admin")
    if actor.role == "patient" and actor.id != patient_id:
        raise HTTPException(status_code=403, detail="You can only open your own record")
    patient = db.scalar(select(Patient).where(Patient.patient_id == patient_id))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {
        "patient_id": patient.patient_id,
        "full_name": patient.full_name,
        "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else "",
        "gender": patient.gender,
        "blood_group": patient.blood_group,
        "contact_number": patient.contact_number,
        "email": patient.email,
    }


@router.post("", status_code=201)
def register_patient(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Register a new patient. Writes only to ``patient`` and never to another role's table.

    A Supabase user who is not in the database yet may create only the row for
    their own email. A signed-in doctor or administrator may register a patient
    during intake.
    """
    actor = actor_from(request)
    full_name = str(payload.get("full_name", "")).strip()
    if not full_name:
        raise HTTPException(status_code=400, detail="Full name is required")

    gender = str(payload.get("gender") or "M").upper()[:1]
    if gender not in ("M", "F", "O"):
        raise HTTPException(status_code=400, detail="Gender must be M, F or O")

    dob_val = payload.get("date_of_birth") or "2000-01-01"
    try:
        dob = datetime.date.fromisoformat(dob_val) if isinstance(dob_val, str) else dob_val
    except ValueError:
        raise HTTPException(status_code=400, detail="date_of_birth must be YYYY-MM-DD") from None

    clean = clean_email(payload.get("email"))
    if actor.role is None:
        same_email(actor, clean)
    elif actor.role not in {"doctor", "admin"}:
        raise HTTPException(status_code=403, detail="You cannot register a patient")
    if clean:
        owner = find_account(db, clean)
        if owner and owner["role"] == "patient":
            return _patient_dict(db.scalar(select(Patient).where(Patient.patient_id == owner["id"])))
        if owner:
            raise HTTPException(
                status_code=409,
                detail=f"Email '{clean}' is already registered under the {owner['role']} role. It cannot also be a patient.",
            )

    patient_id = payload.get("patient_id")
    if not patient_id:
        max_num = db.scalar(
            text("SELECT COALESCE(MAX(SUBSTRING(patient_id FROM '[0-9]+')::integer), 1000) FROM patient")
        ) or 1000
        patient_id = f"PAT-IN-{max_num + 1}"
    elif db.scalar(select(Patient).where(Patient.patient_id == patient_id)):
        raise HTTPException(status_code=400, detail=f"Patient ID {patient_id} already exists")

    pat = Patient(
        patient_id=patient_id,
        full_name=full_name,
        date_of_birth=dob,
        gender=gender,
        blood_group=payload.get("blood_group") or "O+",
        contact_number=str(payload.get("contact_number") or "9800000000"),
        email=clean or None,
    )
    db.add(pat)
    try:
        db.commit()
        db.refresh(pat)
        return _patient_dict(pat)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{patient_id}/chart")
def get_patient_chart(patient_id: str, request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Patient, timeline, labs, medicines, consents and the access count in one query."""
    actor = actor_from(request)
    access = open_chart(db, actor, patient_id)
    chart = _load_chart(db, patient_id)
    chart["access"] = access
    return chart


@router.get("/{patient_id}/timeline")
def get_patient_timeline(
    patient_id: str,
    request: Request,
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Longitudinal history. Consent or a live 30-minute emergency window is required for a doctor."""
    actor = actor_from(request)
    open_chart(db, actor, patient_id)
    if actor.role == "patient" and actor.id == patient_id:
        record_access(db, patient_id, None, "VIEW_ALL_RECORDS", "Patient viewed full records list")
    return _load_chart(db, patient_id)["timeline"]


@router.get("/{patient_id}/prescriptions/active")
def get_active_prescriptions(patient_id: str, request: Request, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """Return recent prescriptions for a caller who may open the chart."""
    actor = actor_from(request)
    open_chart(db, actor, patient_id)
    return _load_chart(db, patient_id)["prescriptions"]


@router.get("/{patient_id}/labs")
def get_patient_labs(patient_id: str, request: Request, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """Return diagnostic investigations for a caller who may open the chart."""
    actor = actor_from(request)
    open_chart(db, actor, patient_id)
    return _load_chart(db, patient_id)["labs"]


@router.put("/{patient_id}")
def update_patient(patient_id: str, payload: dict[str, Any], request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Update patient demographic details. The patient may update their own row; an administrator may update any."""
    actor = actor_from(request)
    if actor.role == "patient" and actor.id != patient_id:
        raise HTTPException(status_code=403, detail="You can only update your own record")
    if actor.role not in {"patient", "admin"}:
        raise HTTPException(status_code=403, detail="You cannot update this record")
    pat = db.scalar(select(Patient).where(Patient.patient_id == patient_id))
    if not pat:
        raise HTTPException(status_code=404, detail="Patient not found")

    if "full_name" in payload and payload["full_name"]:
        pat.full_name = str(payload["full_name"]).strip()
    if "blood_group" in payload:
        pat.blood_group = payload["blood_group"]
    if "contact_number" in payload and payload["contact_number"]:
        pat.contact_number = str(payload["contact_number"]).strip()
    if "email" in payload:
        new_email = clean_email(payload["email"])
        owner = find_account(db, new_email) if new_email else None
        if owner and not (owner["role"] == "patient" and owner["id"] == patient_id):
            raise HTTPException(status_code=409, detail=f"Email '{new_email}' is already registered under the {owner['role']} role.")
        pat.email = new_email or None
    if "gender" in payload and payload["gender"]:
        pat.gender = str(payload["gender"]).upper()[:1]
    if "date_of_birth" in payload and payload["date_of_birth"]:
        dob_val = payload["date_of_birth"]
        pat.date_of_birth = datetime.date.fromisoformat(dob_val) if isinstance(dob_val, str) else dob_val

    try:
        db.commit()
        db.refresh(pat)
        return {
            "patient_id": pat.patient_id,
            "full_name": pat.full_name,
            "date_of_birth": pat.date_of_birth.isoformat() if pat.date_of_birth else "",
            "gender": pat.gender,
            "blood_group": pat.blood_group,
            "contact_number": pat.contact_number,
            "email": pat.email,
            "message": f"Patient {pat.patient_id} successfully updated in PostgreSQL.",
        }
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{patient_id}")
def delete_patient(patient_id: str, request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Delete a patient record. Only an administrator may do this."""
    require_roles(actor_from(request), "admin")
    pat = db.scalar(select(Patient).where(Patient.patient_id == patient_id))
    if not pat:
        raise HTTPException(status_code=404, detail="Patient not found")

    try:
        db.delete(pat)
        db.commit()
        return {"status": "ok", "message": f"Patient {patient_id} successfully deleted from PostgreSQL."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete patient with active clinical visits, consents or audit records: {str(exc)}"
        ) from exc
