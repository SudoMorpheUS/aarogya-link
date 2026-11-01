"""Slide-over drawer panel endpoints.

Returns HTML fragments for the patient dashboard slide-over drawer:
- GET /panel/results   -> _panel_results.html
- GET /panel/medicines -> _panel_medicines.html
- GET /panel/care-team -> _panel_care_team.html

Security & access:
- Requires signed-in patient session (@login_required).
- Requires X-Requested-With: XMLHttpRequest header (404 on direct browser visit).
- Parameterised SQL queries filtered by current patient ID.
- Appends tamper-evident audit ledger rows: VIEW_RESULTS, VIEW_MEDICINES, VIEW_CARE_TEAM.
"""

from __future__ import annotations

import datetime
import os
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
import jinja2
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..core.access import actor_from, record_access, require_roles
from ..core.database import get_db

router = APIRouter(prefix="/panel", tags=["panel"])

# Jinja2 environment with autoescape enabled
TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")
jinja_env = jinja2.Environment(
    loader=jinja2.FileSystemLoader(TEMPLATES_DIR),
    autoescape=jinja2.select_autoescape(["html", "xml"]),
)

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _format_date(val: Any) -> str:
    if not val:
        return "—"
    if isinstance(val, (datetime.date, datetime.datetime)):
        return f"{val.day:02d} {MONTHS[val.month - 1]} {val.year}"
    s = str(val)[:10]
    try:
        parts = s.split("-")
        return f"{int(parts[2]):02d} {MONTHS[int(parts[1]) - 1]} {parts[0]}"
    except Exception:
        return s


# Reference ranges from frontend/src/lib/lab-ranges.ts
RANGES: dict[str, dict[str, float]] = {
    "hba1c": {"high": 6.5, "criticalHigh": 9.0},
    "tsh": {"low": 0.4, "high": 4.0, "criticalHigh": 10.0},
    "free t4": {"low": 0.8, "high": 1.8},
    "ldl cholesterol": {"high": 130.0, "criticalHigh": 190.0},
    "troponin i": {"high": 0.04, "criticalHigh": 0.4},
    "bnp": {"high": 100.0, "criticalHigh": 500.0},
    "wbc count": {"low": 4.0, "high": 11.0, "criticalHigh": 20.0},
    "fasting glucose": {"low": 70.0, "high": 126.0, "criticalHigh": 250.0},
    "total ige": {"high": 100.0},
    "serum creatinine": {"high": 1.3, "criticalHigh": 4.0},
    "serum potassium": {"low": 3.5, "high": 5.0, "criticalLow": 2.8, "criticalHigh": 6.0},
    "uric acid": {"high": 7.0},
    "serum uric acid": {"high": 7.0},
}


def _assess_lab(test_name: str, result: str | None) -> tuple[str, str | None]:
    if not result:
        return "normal", None
    try:
        val = float(result.strip())
    except (ValueError, TypeError):
        return "normal", None

    key = test_name.strip().lower()
    rng = RANGES.get(key)
    if not rng:
        return "normal", None

    crit_high = rng.get("criticalHigh")
    crit_low = rng.get("criticalLow")
    high = rng.get("high")
    low = rng.get("low")

    if crit_high is not None and val >= crit_high:
        return "critical", "high"
    if crit_low is not None and val <= crit_low:
        return "critical", "low"
    if high is not None and val > high:
        return "watch", "high"
    if low is not None and val < low:
        return "watch", "low"
    return "normal", None


def _duration_days(duration: str | None) -> int | None:
    if not duration:
        return None
    m = re.search(r"(\d+)\s*(day|week|month)", duration, re.IGNORECASE)
    if not m:
        return None
    n = int(m.group(1))
    unit = m.group(2).lower()
    return n if unit == "day" else (n * 7 if unit == "week" else n * 30)


def _course_days_left(visit_date: Any, duration: str | None) -> int | None:
    days = _duration_days(duration)
    if days is None:
        return None
    if isinstance(visit_date, datetime.datetime):
        v_date = visit_date.date()
    elif isinstance(visit_date, datetime.date):
        v_date = visit_date
    else:
        try:
            v_date = datetime.date.fromisoformat(str(visit_date)[:10])
        except Exception:
            return None
    end_date = v_date + datetime.timedelta(days=days)
    today = datetime.date.today()
    return (end_date - today).days


def _initials(name: str) -> str:
    clean = re.sub(r"^Dr\.\s*", "", name).strip()
    parts = clean.split()
    return "".join(p[0] for p in parts[:2]).upper() if parts else "DR"


def _verify_ajax_and_patient(request: Request) -> tuple[Any, str]:
    """Check X-Requested-With header and authenticate patient role."""
    xhr = request.headers.get("x-requested-with", "").strip()
    if xhr.lower() != "xmlhttprequest":
        raise HTTPException(
            status_code=404,
            detail="Direct browser navigation not permitted. Only requested via dashboard.",
        )
    actor = actor_from(request)
    require_roles(actor, "patient")
    if not actor.id:
        raise HTTPException(status_code=403, detail="Patient ID not found in session")
    return actor, actor.id


@router.get("/results", response_class=HTMLResponse)
def get_results_panel(request: Request, db: Session = Depends(get_db)):
    """Return HTML fragment for Latest Results slide-over drawer."""
    actor, patient_id = _verify_ajax_and_patient(request)
    record_access(db, patient_id, None, "VIEW_RESULTS", "Patient opened latest results panel")

    stmt = text("""
        SELECT
            lt.lab_test_id,
            lt.test_name,
            lt.result,
            lt.unit,
            lt.test_date
        FROM lab_test lt
        JOIN visit v ON lt.visit_id = v.visit_id
        WHERE v.patient_id = :pid
        ORDER BY lt.test_date DESC, lt.lab_test_id DESC
    """)
    rows = db.execute(stmt, {"pid": patient_id}).mappings().all()

    labs = []
    for r in rows:
        flag, direction = _assess_lab(r["test_name"], r["result"])
        res_str = f"{r['result'] or '—'} {r['unit'] or ''}".strip()
        labs.append({
            "lab_test_id": r["lab_test_id"],
            "test_name": r["test_name"],
            "formatted_result": res_str,
            "flag": flag,
            "direction": direction,
            "formatted_date": _format_date(r["test_date"]),
        })

    template = jinja_env.get_template("_panel_results.html")
    html_content = template.render(labs=labs)
    return HTMLResponse(
        content=html_content,
        status_code=200,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


@router.get("/medicines", response_class=HTMLResponse)
def get_medicines_panel(request: Request, db: Session = Depends(get_db)):
    """Return HTML fragment for My Medicines slide-over drawer."""
    actor, patient_id = _verify_ajax_and_patient(request)
    record_access(db, patient_id, None, "VIEW_MEDICINES", "Patient opened medicines panel")

    stmt = text("""
        SELECT
            p.prescription_id,
            p.medicine_name,
            p.dosage,
            p.frequency,
            p.duration,
            v.visit_date,
            d.full_name AS doctor_name,
            h.hospital_name
        FROM prescription p
        JOIN visit v ON p.visit_id = v.visit_id
        JOIN doctor d ON v.doctor_id = d.doctor_id
        JOIN hospital h ON v.hospital_id = h.hospital_id
        WHERE v.patient_id = :pid
        ORDER BY v.visit_date DESC, p.prescription_id DESC
    """)
    rows = db.execute(stmt, {"pid": patient_id}).mappings().all()

    meds = []
    for r in rows:
        days_left = _course_days_left(r["visit_date"], r["duration"])
        if days_left is None or days_left >= 0:
            meds.append({
                "prescription_id": r["prescription_id"],
                "medicine_name": r["medicine_name"],
                "dosage": r["dosage"],
                "frequency": r["frequency"],
                "doctor_name": r["doctor_name"],
                "hospital_name": r["hospital_name"],
                "days_left": days_left,
            })

    template = jinja_env.get_template("_panel_medicines.html")
    html_content = template.render(meds=meds)
    return HTMLResponse(
        content=html_content,
        status_code=200,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


@router.get("/care-team", response_class=HTMLResponse)
def get_care_team_panel(request: Request, db: Session = Depends(get_db)):
    """Return HTML fragment for My Care Team slide-over drawer."""
    actor, patient_id = _verify_ajax_and_patient(request)
    record_access(db, patient_id, None, "VIEW_CARE_TEAM", "Patient opened care team panel")

    stmt = text("""
        SELECT DISTINCT
            d.doctor_id,
            d.full_name AS doctor_name,
            d.specialization,
            h.hospital_name,
            MAX(v.visit_date) AS last_visit
        FROM visit v
        JOIN doctor d ON v.doctor_id = d.doctor_id
        JOIN hospital h ON v.hospital_id = h.hospital_id
        WHERE v.patient_id = :pid
        GROUP BY d.doctor_id, d.full_name, d.specialization, h.hospital_name
        ORDER BY MAX(v.visit_date) DESC
    """)
    rows = db.execute(stmt, {"pid": patient_id}).mappings().all()

    team = [
        {
            "doctor_id": r["doctor_id"],
            "doctor_name": r["doctor_name"],
            "specialization": r["specialization"] or "Physician",
            "hospital_name": r["hospital_name"],
            "initials": _initials(r["doctor_name"]),
        }
        for r in rows
    ]

    template = jinja_env.get_template("_panel_care_team.html")
    html_content = template.render(team=team)
    return HTMLResponse(
        content=html_content,
        status_code=200,
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )
