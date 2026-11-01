# AarogyaLink Backend (FastAPI REST Service)

A high-performance asynchronous REST API microservice for the AarogyaLink health data exchange platform. Built with **FastAPI**, **SQLAlchemy 2.0**, and **psycopg3**, connecting directly to **PostgreSQL 17 on Supabase**.

---

## ⚡ Tech Stack & Architecture

- **Language / Runtime:** Python 3.12 (packaged via `uv` and pinned in `.python-version`)
- **Web Framework:** FastAPI `0.143+` & Starlette
- **ASGI Web Server:** Uvicorn `0.54+`
- **Database Engine & ORM:** SQLAlchemy 2.0 with connection pooling
- **PostgreSQL Driver:** `psycopg[binary] >= 3.0` (asynchronous + connection pooler compatibility)
- **Data Validation:** Pydantic v2 schemas (`src/models/schemas.py`)
- **Containerization:** Multi-stage `python:3.12-slim` Docker image

---

## 🚀 Running the Backend

### Method 1: Local Development (Host)
Ensure Python 3.12 is installed. Set `DATABASE_URL` to your Supabase PostgreSQL pooler connection string:

```bash
cd backend

# Install dependencies with uv (or pip)
uv sync

# Run with hot reloading on port 8000
python -m uvicorn main:app --reload --port 8000
```

### Method 2: Docker Compose (Default Stack)
From the repository root:

```bash
docker compose up -d --build backend
```

- **API Base URL:** `http://localhost:8000`
- **Interactive Swagger Docs:** `http://localhost:8000/docs`
- **Redoc Documentation:** `http://localhost:8000/redoc`
- **Health Check:** `http://localhost:8000/health`

---

## 📡 API Routers & Operations (31 Paths, 38 Operations)

The API layer is partitioned into 9 domain routers mounted under `/api`:

| Router | Path Prefix | Core Operations & Endpoints |
| :--- | :--- | :--- |
| **Auth** | `/api/auth` | `GET /api/auth/lookup`: Resolves user email against `patient`, `doctor`, and `admin_user` tables for session establishment. |
| **Patients** | `/api/patients` | `GET /api/patients`: Search and list patients.<br>`POST /api/patients`: Register a new patient with auto-generated `PAT-IN-xxxx`.<br>`GET /api/patients/{id}`: Demographic details.<br>`GET /api/patients/{id}/timeline`: Consent-gated longitudinal history. |
| **Doctors** | `/api/doctors` | `GET /api/doctors`: Safe clinician directory via `v_doctor_directory`.<br>`POST /api/doctors`: Register new doctor with medical license and hospital foreign key. |
| **Visits** | `/api/visits` | `POST /api/visits`: Atomically records encounter, diagnoses, prescriptions, and lab tests; activates `trg_visit_audit` trigger. |
| **Consents** | `/api/consents` | `GET /api/consents/check`: Dynamic authorization evaluated via `fn_has_consent()`.<br>`POST /api/consents`: Grants time-bound consent via `sp_grant_consent()`.<br>`POST /api/consents/{id}/revoke`: Revokes access. |
| **Duplicates** | `/api/duplicates` | `GET /api/duplicates`: Queries `v_duplicate_lab_tests` to detect repeat investigations across different hospitals within 90 days. |
| **Hospitals** | `/api/hospitals` | `GET /api/hospitals`: Facility registry.<br>`GET /api/hospitals/caseload`: Aggregates encounter volumes by department and care type. |
| **Audit** | `/api/audit` | `GET /api/audit`: Chronological compliance ledger with SHA-256 seal verification. |
| **Stats** | `/api/stats` | `GET /api/stats`: Network-wide counts for hospitals, doctors, patients, visits, consents, and audit entries. |

---

## 🔒 Automated Sequence Synchronization & Database Lifespan

On application startup, the lifespan hook in `main.py` automatically:
1. Calls `ensure_admin_table()` to guarantee the root `admin_user` record exists.
2. Synchronizes all PostgreSQL auto-incrementing serial sequences with the current maximum primary key values (`setval` for `consent_consent_id_seq`, `visit_visit_id_seq`, `diagnosis_diagnosis_id_seq`, `prescription_prescription_id_seq`, `lab_test_lab_test_id_seq`, and `audit_log_log_id_seq`), preventing duplicate key errors during subsequent insertions.
