from __future__ import annotations

import datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..core.identity import clean_email, find_account
from ..models.doctor import Doctor
from ..models.hospital import Hospital
from ..models.patient import Patient
from ..models.schemas import PatientCreate, PatientRead
from ..models.visit import Diagnosis, LabTest, Prescription, Visit

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


@router.get("")
def list_patients(
    q: str = Query(default="", description="Search query by name, ID, or email"),
    limit: int = Query(default=100, ge=1, le=5000),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Search and list patients."""
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
def get_patient(patient_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Get patient by ID."""
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
def register_patient(payload: dict[str, Any], db: Session = Depends(get_db)) -> dict[str, Any]:
    """Register a new patient. Writes only to ``patient`` and never to another role's table."""
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


@router.get("/{patient_id}/timeline")
def get_patient_timeline(
    patient_id: str,
    doctor_id: str | None = Query(default=None, description="Doctor requesting access for consent verification"),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Retrieve full longitudinal health timeline for a patient across all hospitals.

    Enforces data privacy: if doctor_id is specified, verifies fn_has_consent or active break-glass.
    """
    if doctor_id:
        has_consent = db.scalar(
            text("SELECT fn_has_consent(:pid, :did)"),
            {"pid": patient_id, "did": doctor_id},
        )
        if not has_consent:
            emergency_active = db.scalar(
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
            if not emergency_active:
                raise HTTPException(
                    status_code=403,
                    detail="Access Denied: No active consent or emergency break-glass override granted for this patient.",
                )

    visits = (
        db.scalars(
            select(Visit)
            .where(Visit.patient_id == patient_id)
            .order_by(Visit.visit_date.desc())
        )
        .all()
    )

    timeline = []
    for v in visits:
        doctor = db.scalar(select(Doctor).where(Doctor.doctor_id == v.doctor_id))
        hospital = db.scalar(select(Hospital).where(Hospital.hospital_id == v.hospital_id))
        diagnoses = db.scalars(select(Diagnosis).where(Diagnosis.visit_id == v.visit_id)).all()
        prescriptions = db.scalars(select(Prescription).where(Prescription.visit_id == v.visit_id)).all()
        lab_tests = db.scalars(select(LabTest).where(LabTest.visit_id == v.visit_id)).all()

        timeline.append({
            "visit_id": v.visit_id,
            "visit_date": v.visit_date.isoformat() if v.visit_date else "",
            "visit_type": v.visit_type,
            "chief_complaint": v.chief_complaint,
            "doctor": {
                "doctor_id": doctor.doctor_id if doctor else v.doctor_id,
                "full_name": doctor.full_name if doctor else "Doctor",
                "specialization": doctor.specialization if doctor else "Specialist",
            },
            "hospital": {
                "hospital_id": hospital.hospital_id if hospital else v.hospital_id,
                "hospital_name": hospital.hospital_name if hospital else "Hospital",
                "address": hospital.address if hospital else "",
            },
            "diagnoses": [
                {
                    "diagnosis_id": d.diagnosis_id,
                    "disease_code": d.disease_code,
                    "description": d.description,
                    "diagnosed_date": d.diagnosed_date.isoformat() if d.diagnosed_date else "",
                }
                for d in diagnoses
            ],
            "prescriptions": [
                {
                    "prescription_id": p.prescription_id,
                    "medicine_name": p.medicine_name,
                    "dosage": p.dosage,
                    "frequency": p.frequency,
                    "duration": p.duration,
                }
                for p in prescriptions
            ],
            "lab_tests": [
                {
                    "lab_test_id": l.lab_test_id,
                    "test_name": l.test_name,
                    "result": l.result,
                    "unit": l.unit,
                    "test_date": l.test_date.isoformat() if l.test_date else "",
                }
                for l in lab_tests
            ],
        })
    return timeline


@router.get("/{patient_id}/prescriptions/active")
def get_active_prescriptions(patient_id: str, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """Return recent / active prescriptions for the patient."""
    stmt = (
        select(Prescription, Visit, Doctor, Hospital)
        .join(Visit, Prescription.visit_id == Visit.visit_id)
        .join(Doctor, Visit.doctor_id == Doctor.doctor_id)
        .join(Hospital, Visit.hospital_id == Hospital.hospital_id)
        .where(Visit.patient_id == patient_id)
        .order_by(Visit.visit_date.desc())
        .limit(20)
    )
    rows = db.execute(stmt).all()
    results = []
    for rx, v, doc, hosp in rows:
        results.append({
            "prescription_id": rx.prescription_id,
            "visit_id": rx.visit_id,
            "medicine_name": rx.medicine_name,
            "dosage": rx.dosage,
            "frequency": rx.frequency,
            "duration": rx.duration,
            "visit_date": v.visit_date.isoformat() if v.visit_date else "",
            "doctor_name": doc.full_name,
            "hospital_name": hosp.hospital_name,
        })
    return results


@router.get("/{patient_id}/labs")
def get_patient_labs(patient_id: str, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """Return diagnostic investigations for the patient."""
    stmt = (
        select(LabTest, Visit, Hospital)
        .join(Visit, LabTest.visit_id == Visit.visit_id)
        .join(Hospital, Visit.hospital_id == Hospital.hospital_id)
        .where(Visit.patient_id == patient_id)
        .order_by(LabTest.test_date.desc())
    )
    rows = db.execute(stmt).all()
    results = []
    for lab, v, hosp in rows:
        results.append({
            "lab_test_id": lab.lab_test_id,
            "visit_id": lab.visit_id,
            "test_name": lab.test_name,
            "result": lab.result,
            "unit": lab.unit,
            "test_date": lab.test_date.isoformat() if lab.test_date else "",
            "hospital_name": hosp.hospital_name,
            "hospital_id": hosp.hospital_id,
        })
    return results


@router.put("/{patient_id}")
def update_patient(patient_id: str, payload: dict[str, Any], db: Session = Depends(get_db)) -> dict[str, Any]:
    """Update patient demographic details in PostgreSQL (Update operation)."""
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
def delete_patient(patient_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Delete patient record from PostgreSQL (Delete operation)."""
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
