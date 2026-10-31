from __future__ import annotations

import datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.access import actor_from, assert_may_treat, open_chart, require_roles
from ..core.database import get_db
from ..models.doctor import Doctor
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
