from __future__ import annotations

import random
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.identity import clean_email, find_account
from ..models.doctor import Doctor
from ..models.hospital import Hospital
from ..models.schemas import DoctorCreate, DoctorRead

router = APIRouter(prefix="/api/doctors", tags=["doctors"])

# Legacy short ids used by the early demo data / in-memory store.
_LEGACY_HOSPITAL_IDS = {"HSP-01": "HSP1001", "HSP-02": "HSP1002", "HSP-03": "HSP1005"}


def _normalize_hospital_id(hospital_id: str) -> str:
    return _LEGACY_HOSPITAL_IDS.get(hospital_id, hospital_id)


@router.get("/{doctor_id}/accessible-patients")
def get_accessible_patients(doctor_id: str, db: Session = Depends(get_db)) -> list[str]:
    """Return list of patient_ids that this doctor has active consent to access (directly or via hospital)."""
    sql = text("""
        SELECT DISTINCT c.patient_id
        FROM consent c
        JOIN doctor d ON d.doctor_id = :did
        WHERE c.status = 'Active'
          AND c.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
          AND (c.end_date IS NULL OR c.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date)
          AND (c.doctor_id = :did OR c.hospital_id = d.hospital_id)
    """)
    rows = db.execute(sql, {"did": doctor_id}).scalars().all()
    return list(rows)


@router.get("")
def list_doctors(
    hospital_id: str | None = None,
    q: str | None = None,
    limit: int = Query(default=1000, ge=1, le=5000),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """List doctors, optionally filtered by hospital or search query."""
    stmt = (
        select(Doctor, Hospital.hospital_name)
        .join(Hospital, Doctor.hospital_id == Hospital.hospital_id)
        .order_by(Doctor.full_name)
    )
    if hospital_id:
        norm_hosp = hospital_id
        if norm_hosp == "HSP-01": norm_hosp = "HSP1001"
        elif norm_hosp == "HSP-02": norm_hosp = "HSP1002"
        elif norm_hosp == "HSP-03": norm_hosp = "HSP1005"
        stmt = stmt.where(Doctor.hospital_id == norm_hosp)
    if q:
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            (Doctor.full_name.ilike(term)) |
            (Doctor.doctor_id.ilike(term)) |
            (Doctor.specialization.ilike(term)) |
            (Hospital.hospital_name.ilike(term))
        )
    stmt = stmt.limit(limit)

    rows = db.execute(stmt).all()
    results = []
    for doc, hosp_name in rows:
        results.append({
            "doctor_id": doc.doctor_id,
            "hospital_id": doc.hospital_id,
            "hospital_name": hosp_name,
            "full_name": doc.full_name,
            "specialization": doc.specialization,
            "license_number": doc.license_number,
            "email": doc.email,
            "contact_number": doc.contact_number,
        })
    return results


@router.get("/{doctor_id}")
def get_doctor(doctor_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Get doctor details by ID."""
    stmt = (
        select(Doctor, Hospital.hospital_name)
        .join(Hospital, Doctor.hospital_id == Hospital.hospital_id)
        .where(Doctor.doctor_id == doctor_id)
    )
    row = db.execute(stmt).first()
    if not row:
        raise HTTPException(status_code=404, detail="Doctor not found")
    doc, hosp_name = row
    return {
        "doctor_id": doc.doctor_id,
        "hospital_id": doc.hospital_id,
        "hospital_name": hosp_name,
        "full_name": doc.full_name,
        "specialization": doc.specialization,
        "license_number": doc.license_number,
        "email": doc.email,
        "contact_number": doc.contact_number,
    }


@router.post("", response_model=DoctorRead, status_code=201)
def create_doctor(payload: DoctorCreate, db: Session = Depends(get_db)):
    """Register a new doctor. Writes only to ``doctor`` and never to another role's table."""
    hosp_id = _normalize_hospital_id(payload.hospital_id)
    if not db.scalar(select(Hospital).where(Hospital.hospital_id == hosp_id)):
        raise HTTPException(status_code=400, detail=f"Hospital '{payload.hospital_id}' does not exist")

    clean = clean_email(payload.email)
    if clean:
        owner = find_account(db, clean)
        if owner and owner["role"] == "doctor":
            return db.scalar(select(Doctor).where(Doctor.doctor_id == owner["id"]))
        if owner:
            raise HTTPException(
                status_code=409,
                detail=f"Email '{clean}' is already registered under the {owner['role']} role. It cannot also be a doctor.",
            )

    doc_id = payload.doctor_id
    if not doc_id or db.scalar(select(Doctor).where(Doctor.doctor_id == doc_id)):
        max_num = db.scalar(
            text("SELECT COALESCE(MAX(SUBSTRING(doctor_id FROM '[0-9]+')::integer), 1000) FROM doctor")
        ) or 1000
        doc_id = f"DOC-{max_num + 1}"

    lic = payload.license_number
    if not lic:
        lic = f"MCI-DL-{random.randint(10000, 99999)}"
    elif db.scalar(select(Doctor).where(Doctor.license_number == lic)):
        lic = f"{lic}-{random.randint(100, 999)}"

    raw_name = (payload.full_name or "").strip()
    formatted_name = raw_name if raw_name.lower().startswith(("dr.", "dr ")) else f"Dr. {raw_name}"

    doc = Doctor(
        doctor_id=doc_id,
        hospital_id=hosp_id,
        full_name=formatted_name,
        specialization=payload.specialization,
        license_number=lic,
        email=clean or None,
        contact_number=payload.contact_number,
    )
    db.add(doc)
    try:
        db.commit()
        db.refresh(doc)
        return doc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/{doctor_id}", response_model=DoctorRead)
def update_doctor(doctor_id: str, payload: dict[str, Any], db: Session = Depends(get_db)):
    """Update doctor profile details in PostgreSQL (Update operation)."""
    doc = db.scalar(select(Doctor).where(Doctor.doctor_id == doctor_id))
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")

    if "full_name" in payload and payload["full_name"]:
        doc.full_name = str(payload["full_name"]).strip()
    if "specialization" in payload and payload["specialization"]:
        doc.specialization = str(payload["specialization"]).strip()
    if "email" in payload:
        new_email = clean_email(payload["email"])
        owner = find_account(db, new_email) if new_email else None
        if owner and not (owner["role"] == "doctor" and owner["id"] == doctor_id):
            raise HTTPException(status_code=409, detail=f"Email '{new_email}' is already registered under the {owner['role']} role.")
        doc.email = new_email or None
    if "contact_number" in payload:
        doc.contact_number = str(payload["contact_number"]).strip() if payload["contact_number"] else None
    if "hospital_id" in payload and payload["hospital_id"]:
        hosp_id = payload["hospital_id"]
        if hosp_id == "HSP-01": hosp_id = "HSP1001"
        elif hosp_id == "HSP-02": hosp_id = "HSP1002"
        elif hosp_id == "HSP-03": hosp_id = "HSP1005"
        doc.hospital_id = hosp_id

    try:
        db.commit()
        db.refresh(doc)
        return doc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{doctor_id}")
def delete_doctor(doctor_id: str, db: Session = Depends(get_db)):
    """Delete doctor record from PostgreSQL (Delete operation)."""
    doc = db.scalar(select(Doctor).where(Doctor.doctor_id == doctor_id))
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")

    try:
        db.delete(doc)
        db.commit()
        return {"status": "ok", "message": f"Doctor {doctor_id} successfully deleted."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete doctor with active clinical visits or audit records: {str(exc)}"
        ) from exc
