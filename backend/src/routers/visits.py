from __future__ import annotations

import datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from ..core.access import actor_from, assert_may_treat, open_chart, record_access, require_roles
from ..core.database import get_db
from ..models.doctor import Doctor
from ..models.hospital import Hospital
from ..models.patient import Patient
from ..models.visit import Diagnosis, LabTest, Prescription, Visit

router = APIRouter(prefix="/api/visits", tags=["visits"])


@router.post("", status_code=201)
def create_visit(payload: dict[str, Any], request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Record a clinical encounter for the signed-in doctor, at that doctor's hospital."""
    actor = actor_from(request)
    require_roles(actor, "doctor")
    patient_id = payload.get("patient_id")
    visit_type = payload.get("visit_type", "OPD")
    chief_complaint = payload.get("chief_complaint") or None

    if not patient_id:
        raise HTTPException(status_code=400, detail="patient_id is required")
    if visit_type not in ("OPD", "Emergency", "Inpatient"):
        raise HTTPException(status_code=400, detail="visit_type must be OPD, Emergency or Inpatient")

    assert_may_treat(db, actor, patient_id)
    doctor_id = actor.id
    doctor = db.scalar(select(Doctor).where(Doctor.doctor_id == doctor_id))
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    hospital_id = doctor.hospital_id

    # 1. Create Visit record (fires PostgreSQL trigger `tr_visit_audit`)
    visit = Visit(
        patient_id=patient_id,
        hospital_id=hospital_id,
        doctor_id=doctor_id,
        visit_date=datetime.datetime.now(datetime.timezone.utc),
        visit_type=visit_type,
        chief_complaint=chief_complaint,
    )
    db.add(visit)
    try:
        db.flush()  # Populates visit.visit_id
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    today = datetime.date.today()

    # 2. Add diagnoses
    diagnoses_data = payload.get("diagnoses", [])
    for d in diagnoses_data:
        code = d.get("disease_code")
        desc = d.get("description")
        if code and desc:
            diag = Diagnosis(
                visit_id=visit.visit_id,
                disease_code=code,
                description=desc,
                diagnosed_date=today,
            )
            db.add(diag)

    # 3. Add prescriptions
    prescriptions_data = payload.get("prescriptions", [])
    for p in prescriptions_data:
        name = p.get("medicine_name")
        if name:
            rx = Prescription(
                visit_id=visit.visit_id,
                medicine_name=name,
                dosage=p.get("dosage", "1 tablet"),
                frequency=p.get("frequency", "Once daily"),
                duration=p.get("duration", "5 days"),
            )
            db.add(rx)

    # 4. Add lab tests
    lab_tests_data = payload.get("lab_tests", []) or payload.get("labTests", [])
    for l in lab_tests_data:
        t_name = l.get("test_name")
        if t_name:
            lt = LabTest(
                visit_id=visit.visit_id,
                test_name=t_name,
                result=l.get("result") or None,
                unit=l.get("unit") or None,
                test_date=today,
            )
            db.add(lt)

    try:
        db.commit()
        db.refresh(visit)
        return {
            "visit_id": visit.visit_id,
            "patient_id": visit.patient_id,
            "hospital_id": visit.hospital_id,
            "doctor_id": visit.doctor_id,
            "visit_type": visit.visit_type,
            "chief_complaint": visit.chief_complaint,
            "visit_date": visit.visit_date.isoformat(),
            "message": "Visit successfully recorded and audited in PostgreSQL.",
        }
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("")
def list_visits(
    request: Request,
    patient_id: str | None = None,
    doctor_id: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """List recent visits the caller is allowed to see."""
    actor = actor_from(request)
    if actor.role == "patient":
        patient_id = actor.id
    elif actor.role == "doctor":
        if patient_id:
            open_chart(db, actor, patient_id)
        else:
            doctor_id = actor.id
    elif actor.role != "admin":
        raise HTTPException(status_code=403, detail="This action is not available for your role")
    stmt = select(Visit).order_by(Visit.visit_date.desc())
    if patient_id:
        stmt = stmt.where(Visit.patient_id == patient_id)
    if doctor_id:
        stmt = stmt.where(Visit.doctor_id == doctor_id)
    stmt = stmt.limit(limit)

    visits = db.scalars(stmt).all()
    results = []
    for v in visits:
        results.append({
            "visit_id": v.visit_id,
            "patient_id": v.patient_id,
            "hospital_id": v.hospital_id,
            "doctor_id": v.doctor_id,
            "visit_date": v.visit_date.isoformat() if v.visit_date else "",
            "visit_type": v.visit_type,
            "chief_complaint": v.chief_complaint,
        })
    return results


@router.get("/{visit_id}")
def get_visit_detail(visit_id: int, request: Request, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Return full details for a single clinical encounter.

    Ownership and consent are strictly enforced:
    - Patient can only see their own visit (returns 404 if not found or not owned).
    - Doctor requires active consent or emergency override.
    - Admin can view any visit.
    - An audit log entry is recorded for every view.
    """
    actor = actor_from(request)
    stmt = (
        select(Visit)
        .where(Visit.visit_id == visit_id)
        .options(
            joinedload(Visit.hospital),
            joinedload(Visit.doctor),
            joinedload(Visit.patient),
            selectinload(Visit.diagnoses),
            selectinload(Visit.prescriptions),
            selectinload(Visit.lab_tests),
        )
    )
    visit = db.scalar(stmt)
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    if actor.role == "patient":
        if visit.patient_id != actor.id:
            # Per security spec: return 404 so caller cannot probe whether ID exists
            raise HTTPException(status_code=404, detail="Visit not found")
        record_access(db, visit.patient_id, None, "VIEW_VISIT", f"Patient opened visit #{visit_id}")
    elif actor.role == "doctor":
        open_chart(db, actor, visit.patient_id)
        record_access(db, visit.patient_id, actor.id, "READ", f"Doctor opened visit #{visit_id}")
    elif actor.role == "admin":
        record_access(db, visit.patient_id, None, "READ", f"Administrator opened visit #{visit_id}")
    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    return {
        "visit_id": visit.visit_id,
        "patient_id": visit.patient_id,
        "patient_name": visit.patient.full_name if visit.patient else "",
        "visit_date": visit.visit_date.isoformat() if visit.visit_date else "",
        "visit_type": visit.visit_type,
        "chief_complaint": visit.chief_complaint,
        "hospital": {
            "hospital_id": visit.hospital.hospital_id if visit.hospital else visit.hospital_id,
            "hospital_name": visit.hospital.hospital_name if visit.hospital else "Hospital",
            "address": visit.hospital.address if visit.hospital else "",
        },
        "doctor": {
            "doctor_id": visit.doctor.doctor_id if visit.doctor else visit.doctor_id,
            "full_name": visit.doctor.full_name if visit.doctor else "Doctor",
            "specialization": visit.doctor.specialization if visit.doctor else "Physician",
        },
        "diagnoses": [
            {
                "diagnosis_id": d.diagnosis_id,
                "disease_code": d.disease_code,
                "description": d.description,
                "diagnosed_date": d.diagnosed_date.isoformat() if d.diagnosed_date else "",
            }
            for d in visit.diagnoses
        ],
        "prescriptions": [
            {
                "prescription_id": p.prescription_id,
                "medicine_name": p.medicine_name,
                "dosage": p.dosage,
                "frequency": p.frequency,
                "duration": p.duration,
            }
            for p in visit.prescriptions
        ],
        "lab_tests": [
            {
                "lab_test_id": l.lab_test_id,
                "test_name": l.test_name,
                "result": l.result,
                "unit": l.unit,
                "test_date": l.test_date.isoformat() if l.test_date else "",
            }
            for l in visit.lab_tests
        ],
    }


@router.delete("/{visit_id}")
def delete_visit(visit_id: int, request: Request, db: Session = Depends(get_db)):
    """Delete a clinical visit. Only an administrator may do this."""
    require_roles(actor_from(request), "admin")
    v = db.scalar(select(Visit).where(Visit.visit_id == visit_id))
    if not v:
        raise HTTPException(status_code=404, detail="Visit not found")

    try:
        # Delete associated items first if cascade is not automatic
        db.query(Diagnosis).filter(Diagnosis.visit_id == visit_id).delete()
        db.query(Prescription).filter(Prescription.visit_id == visit_id).delete()
        db.query(LabTest).filter(LabTest.visit_id == visit_id).delete()
        db.delete(v)
        db.commit()
        return {"status": "ok", "message": f"Visit {visit_id} and associated records successfully deleted."}
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
