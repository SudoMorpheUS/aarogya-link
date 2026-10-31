# AarogyaLink — Complete Project Exploration & Codebase Audit Report

**Date:** October 14, 2026  
**Project Path:** `d:\Projects\aarogya-link`  
**Platform Overview:** Multi-Hospital Health Data Sharing Platform  

---

## 1. Executive Summary

**AarogyaLink** is a federated multi-hospital healthcare platform designed to share longitudinal patient medical records (encounters, diagnoses, prescriptions, and diagnostic lab tests) across hospitals while enforcing granular patient consent, preventing redundant/duplicate lab testing, and maintaining strict audit trails.

### Current Implementation Status
- **Backend (`backend/`)**: Built with **FastAPI** and **Python 3.13**, managed via **uv**. Contains fully defined SQLAlchemy 2.0 ORM models and Pydantic v2 schemas for all 9 entities matching the relational database schema. A debug SQL runner exists at `POST /debug/sql`, but domain API routers (auth, patients, visits, consent, audit) are not yet implemented.
- **Frontend (`frontend/`)**: A **Next.js 16 (App Router) + React 19 + TypeScript** application running on Node.js. It serves the patient, doctor and administrator portals from the Assignment 2 sample data (in-memory store, Node route handlers under `/api`) and uses a 3D tower loader as its visual motif.
- **Database (`database/`)**: PostgreSQL schema migration (`init_migration_001.sql`) defines 9 tables in BCNF. A comprehensive synthetic dataset of ~50,000 SQL lines (`initial_mock_data_load_fixed.sql`) is ready for testing.
- **Docker Orchestration (`docker-compose.yml`)**: Coordinates 3 services (`db`, `backend`, `frontend`). Note that `backend/Dockerfile` and `frontend/Dockerfile` are currently empty 0-byte placeholders that require definition.
- **Documentation (`docs/`)**: Extensive design specifications, including database queries, stored procedures, triggers, views, full-stack implementation plan, and role-based frontend architecture.

---

## 2. Complete File & Directory Structure

```text
d:\Projects\aarogya-link\
├── .gitignore                                       # Comprehensive Git ignore rules (secrets, venv, node_modules)
├── docker-compose.yml                               # Local multi-service orchestration (db, backend, frontend)
│
├── backend\                                         # FastAPI Python service
│   ├── .env                                         # Local dev environment configuration (DEBUG=true)
│   ├── .python-version                              # Python runtime version pinned to 3.13
│   ├── Dockerfile                                   # Placeholder container definition (0 bytes)
│   ├── main.py                                      # FastAPI application entrypoint
│   ├── pyproject.toml                               # uv / pip packaging specification
│   ├── README.md                                    # Backend documentation (empty)
│   ├── requirements.txt                             # Legacy requirements file (0 bytes)
│   ├── uv.lock                                      # Locked dependency graph
│   └── src\
│       ├── __init__.py                              # Exports Base, SessionLocal, engine, get_db
│       ├── core\
│       │   ├── __init__.py                          # Core exports (DATABASE_URL, DEBUG)
│       │   ├── config.py                            # Environment loader and configuration variables
│       │   ├── database.py                          # SQLAlchemy engine, sessionmaker, Base, get_db dependency
│       │   └── debug.py                             # Raw SQL execution utility for debug endpoints
│       ├── DTOs\                                    # Directory reserved for data transfer objects (empty)
│       ├── models\
│       │   ├── __init__.py                          # Registers and exports all SQLAlchemy models
│       │   ├── audit_log.py                         # AuditLog ORM model (action, timestamp, details)
│       │   ├── consent.py                           # Consent ORM model (active/revoked, doctor/hospital scope)
│       │   ├── doctor.py                            # Doctor ORM model (hospital link, license, specialty)
│       │   ├── enums.py                             # Python Enums: Gender, VisitType, ConsentStatus
│       │   ├── hospital.py                          # Hospital ORM model (registration, address, contact)
│       │   ├── patient.py                           # Patient ORM model (demographics, contact info)
│       │   ├── schemas.py                           # Pydantic v2 Base/Create/Update/Read schemas for all entities
│       │   └── visit.py                             # Visit, Diagnosis, Prescription, and LabTest ORM models
│       └── routers\
│           ├── __init__.py                          # Debug router mount
│           └── debug.py                             # POST /debug/sql route for direct SQL queries
│
├── database\                                        # Relational database scripts
│   ├── init_migration_001.sql                       # DDL creating all 9 core tables and constraints
│   ├── initial_mock_data_load.sql                   # Initial mock dataset
│   └── initial_mock_data_load_fixed.sql             # Sanitized realistic Indian hospital dataset (~50k lines)
│
├── docs\                                            # Architecture and assignment specifications
│   ├── 07_frontend_ui.md                            # High-level UI requirements across 3 roles
│   ├── AarogyaLink_DA2_SQL_Queries.md               # PostgreSQL assignment queries, views, procedures, triggers
│   ├── AarogyaLink_Frontend_Implementation_Plan.md  # Full-stack implementation roadmap and API contract
│   ├── AarogyaLink_Frontend_Only_Implementation_Plan.md # Role-based frontend architecture (4 roles)
│   └── WATTUPDA2.docx                               # Source assignment document
│
└── frontend\                                        # Next.js application (Node.js)
    ├── Dockerfile                                   # Multi-stage Node 22 build (standalone server)
    ├── next.config.ts                               # Next.js configuration
    ├── package.json                                 # React 19, Next.js 16, TypeScript 5
    ├── package-lock.json                            # Locked node dependencies
    ├── public\
    │   └── robots.txt
    └── src\
        ├── app\                                     # App Router: pages, layouts, loading UI, /api routes
        ├── components\                              # TowerLoader, Timeline, forms, navigation
        └── lib\                                     # Types, sample data, in-memory store, session, server actions
```

---

## 3. Configuration Analysis

### 3.1 Docker Compose (`docker-compose.yml`)
- **`frontend` service**: Builds from `./frontend` using the multi-stage `./frontend/Dockerfile` (Node 22, Next.js standalone output) and exposes port `3000:3000`. It receives `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **`backend` service**: Builds from `./backend` using `./backend/Dockerfile`, exposes port `8000:8000`, mounts `./backend:/app`, and sets `DATABASE_URL` to the Supabase PostgreSQL pooler.
- There is no database container. Schema and data live in the Supabase project and are loaded from the SQL files under `database/`.

### 3.2 Backend Configuration
- **Package Manager**: `uv` with `pyproject.toml`.
- **Dependencies**:
  - `fastapi[standard] >= 0.143.0`
  - `uvicorn >= 0.54.0`
  - `sqlalchemy >= 2.0`
  - `psycopg[binary] >= 3.0`
  - `python-dotenv >= 1.0`
- **Environment (`.env`)**:
  - `DEBUG=true`: Controls exposure of raw SQL debugger.
  - `DATABASE_URL`: required. It must be the Supabase PostgreSQL connection string. Compose sets it for the backend container.

### 3.3 Frontend Configuration
- **Location**: `frontend/`.
- **Dependencies**: React 19 (`^19.2.8`), React DOM (`^19.2.8`).
- **Tooling**: Next.js 16, TypeScript 5, ESLint 9 (`eslint-config-next`).
- **Missing Dependencies**:
  - Routing: built into Next.js (App Router)
  - Data: Node route handlers and server actions over the in-memory sample store (swap for the FastAPI/PostgreSQL backend later)
  - Styling: plain CSS with CSS variables and one CSS module (no framework)

---

## 4. Database Architecture & Schema

### 4.1 Tables Defined in `database/init_migration_001.sql`
1. **`hospital`**:
   - `hospital_id` VARCHAR(15) PRIMARY KEY
   - `hospital_name` VARCHAR(150) NOT NULL
   - `address` VARCHAR(255) NOT NULL
   - `contact_number` VARCHAR(15) NOT NULL
   - `registration_no` VARCHAR(30) UNIQUE NOT NULL
2. **`doctor`**:
   - `doctor_id` VARCHAR(15) PRIMARY KEY
   - `hospital_id` VARCHAR(15) NOT NULL REFERENCES hospital(hospital_id)
   - `full_name` VARCHAR(100) NOT NULL
   - `specialization` VARCHAR(80) NOT NULL
   - `license_number` VARCHAR(30) UNIQUE NOT NULL
3. **`patient`**:
   - `patient_id` VARCHAR(20) PRIMARY KEY
   - `full_name` VARCHAR(100) NOT NULL
   - `date_of_birth` DATE NOT NULL
   - `gender` CHAR(1) NOT NULL CHECK (gender IN ('M', 'F', 'O'))
   - `blood_group` VARCHAR(5)
   - `contact_number` VARCHAR(15) NOT NULL
   - `email` VARCHAR(100) UNIQUE
4. **`visit`**:
   - `visit_id` SERIAL PRIMARY KEY
   - `patient_id` VARCHAR(20) NOT NULL REFERENCES patient(patient_id)
   - `hospital_id` VARCHAR(15) NOT NULL REFERENCES hospital(hospital_id)
   - `doctor_id` VARCHAR(15) NOT NULL REFERENCES doctor(doctor_id)
   - `visit_date` TIMESTAMP NOT NULL DEFAULT NOW()
   - `visit_type` VARCHAR(20) NOT NULL CHECK (visit_type IN ('OPD', 'Emergency', 'Inpatient'))
   - `chief_complaint` VARCHAR(255)
5. **`diagnosis`**:
   - `diagnosis_id` SERIAL PRIMARY KEY
   - `visit_id` INTEGER NOT NULL REFERENCES visit(visit_id) ON DELETE CASCADE
   - `disease_code` VARCHAR(10) NOT NULL
   - `description` VARCHAR(255) NOT NULL
   - `diagnosed_date` DATE NOT NULL
6. **`prescription`**:
   - `prescription_id` SERIAL PRIMARY KEY
   - `visit_id` INTEGER NOT NULL REFERENCES visit(visit_id) ON DELETE CASCADE
   - `medicine_name` VARCHAR(100) NOT NULL
   - `dosage` VARCHAR(50) NOT NULL
   - `frequency` VARCHAR(50) NOT NULL
   - `duration` VARCHAR(50) NOT NULL
7. **`lab_test`**:
   - `lab_test_id` SERIAL PRIMARY KEY
   - `visit_id` INTEGER NOT NULL REFERENCES visit(visit_id) ON DELETE CASCADE
   - `test_name` VARCHAR(100) NOT NULL
   - `result` VARCHAR(100)
   - `unit` VARCHAR(30)
   - `test_date` DATE NOT NULL
8. **`consent`**:
   - `consent_id` SERIAL PRIMARY KEY
   - `patient_id` VARCHAR(20) NOT NULL REFERENCES patient(patient_id)
   - `hospital_id` VARCHAR(15) REFERENCES hospital(hospital_id)
   - `doctor_id` VARCHAR(15) REFERENCES doctor(doctor_id)
   - `start_date` DATE NOT NULL
   - `end_date` DATE
   - `status` VARCHAR(15) NOT NULL CHECK (status IN ('Active', 'Revoked'))
   - *Constraint*: `hospital_id IS NOT NULL OR doctor_id IS NOT NULL`
   - *Constraint*: `end_date IS NULL OR end_date >= start_date`
9. **`audit_log`**:
   - `log_id` SERIAL PRIMARY KEY
   - `patient_id` VARCHAR(20) NOT NULL REFERENCES patient(patient_id)
   - `doctor_id` VARCHAR(15) REFERENCES doctor(doctor_id)
   - `action` VARCHAR(30) NOT NULL
   - `action_time` TIMESTAMP NOT NULL DEFAULT NOW()
   - `details` TEXT

### 4.2 Key SQL Objects Specified in `docs/AarogyaLink_DA2_SQL_Queries.md`
- **Views**:
  - `v_patient_timeline`: Gathers chronological visit history with concatenated diagnosis descriptions and counts of prescriptions and lab tests.
  - `v_duplicate_lab_tests`: Detects identical lab test names for the same patient conducted across multiple different hospitals within a 90-day window.
  - `v_hospital_caseload`: Aggregates doctor count, total visits, unique patients, and breakdown of OPD/Emergency/Inpatient encounters per hospital.
- **Stored Procedures / Functions**:
  - `sp_grant_consent(p_patient_id, p_hospital_id, p_doctor_id, p_start_date, p_end_date)`: Creates an active consent entry.
  - `fn_has_consent(p_patient_id, p_doctor_id)`: Evaluates if a doctor is currently authorized to view a patient's records either directly or via their associated hospital.
- **Triggers**:
  - `trg_visit_audit()` on `AFTER INSERT ON visit`: Automatically generates an `audit_log` row for every encounter logged in the system.

---

## 5. Backend Codebase Review

### 5.1 Entrypoint (`backend/main.py`)
```python
from fastapi import FastAPI
from src.core.config import DEBUG

app = FastAPI(title="Aarogya-Link API")

if DEBUG:
    from src.routers.debug import router as debug_router
    app.include_router(debug_router)

@app.get("/")
async def read_root():
    return {"message": "Hello, World!"}
```

### 5.2 Core Infrastructure
- **`backend/src/core/database.py`**: Initializes SQLAlchemy 2.0 `create_engine` using `DATABASE_URL` with `pool_pre_ping=True`, defines `SessionLocal = sessionmaker(...)`, `Base(DeclarativeBase)`, and yields DB sessions via standard FastAPI dependency `get_db()`.
- **`backend/src/core/debug.py`**: Implements `run_sql(sql, params, max_rows)`. Select queries return formatted rows, column names, and row counts; write queries commit transactions and return affected row counts.
- **`backend/src/routers/debug.py`**: Mounts `POST /debug/sql` protected by `_ensure_debug()` dependency.

### 5.3 Models & Schemas
- **ORM Models (`backend/src/models/`)**:
  - Cleanly decoupled declarative models using SQLAlchemy 2.0 typed `Mapped[...]` and `mapped_column(...)`.
  - Cascading deletes properly configured for child records (`diagnosis`, `prescription`, `lab_test`) when a `visit` is deleted.
  - Bi-directional relationships registered across all entities.
- **Validation Schemas (`backend/src/models/schemas.py`)**:
  - Built with Pydantic v2 using `model_config = ConfigDict(from_attributes=True)`.
  - Provides complete `Base`, `Create`, `Update`, and `Read` schemas for all 9 entities.
  - Strict field validations for contact numbers, emails (`EmailStr`), enums, and string length bounds.

---

## 6. Frontend Codebase Review

### 6.1 Current Files
- `frontend/arogya-link/src/main.tsx`: Standard React root rendering `<App />` inside `StrictMode`.
- `frontend/src/app/`: App Router pages (landing, dashboard, patients, consents, audit, hospitals, duplicates, visits) and `/api` route handlers; `frontend/src/lib/` holds the sample data and in-memory store.
- `frontend/arogya-link/src/index.css` & `App.css`: Basic layout styles, CSS custom properties (`--bg`, `--text`, `--accent`), and typography definitions.

### 6.2 Target Architecture (from `docs/AarogyaLink_Frontend_Only_Implementation_Plan.md`)
The frontend is designed around four primary roles with tailored experiences:

```text
AarogyaLink Application
├── 1. Authentication
│   ├── Login Page (Generic multi-role login with dev-mode quick selectors)
│   └── Session state (CurrentUser: role, user_id, hospital_id)
│
├── 2. Role-Based Dashboards
│   ├── A. Doctor Dashboard
│   │   ├── Metric cards & quick search
│   │   ├── Patient Search & Selection
│   │   ├── Longitudinal Timeline (Visits, Diagnoses, Prescriptions, Labs)
│   │   ├── Visit Creation form
│   │   └── Duplicate Lab Test Alerts
│   │
│   ├── B. Hospital Admin Dashboard
│   │   ├── Hospital Caseload Statistics (OPD, Emergency, Inpatient)
│   │   ├── Doctor & Staff Directories
│   │   └── Hospital-scoped Audit Log
│   │
│   ├── C. Patient Dashboard
│   │   ├── Personal Health Timeline
│   │   ├── Active Consent Permissions
│   │   └── Grant / Revoke Consent Management
│   │
│   └── D. Platform Admin Dashboard
│       ├── Network-wide Hospital & Doctor Overview
│       ├── Cross-hospital Caseload & Usage Trends
│       └── System-wide Immutable Audit Logs
│
├── 3. Shared Components
│   ├── AppLayout, Sidebar (collapsible), Topbar (role badge & hospital badge)
│   ├── DataTable, SearchInput, FilterBar, Pagination
│   ├── StatusBadge (Active, Revoked, OPD, Emergency, Inpatient)
│   └── LoadingSkeleton, EmptyState, ErrorState, ConfirmDialog
```

---

## 7. Gap Analysis & Recommended Action Plan

| Component | Current State | Required State | Action Required |
|---|---|---|---|
| **Frontend Location** | In `frontend/arogya-link/` | `docker-compose.yml` expects `./frontend/` | Move files to `frontend/` root or update compose context |
| **Frontend Dependencies** | React 19 only | Router, Query, Icons, Tailwind | Install `react-router-dom`, `@tanstack/react-query`, `lucide-react`, `tailwindcss` |
| **Frontend App Structure** | Single starter `App.tsx` | Role-based router & layout | Create `routes/`, `layouts/`, `pages/`, `components/`, `api/` |
| **Backend Dockerfile** | 0 bytes | Working Python container | Write Dockerfile (using `ghcr.io/astral-sh/uv:python3.13-bookworm-slim`) |
| **Frontend Dockerfile** | Multi-stage Node 22 build | Working Node container | Done: Next.js standalone server on port 3000 |
| **Backend API Endpoints** | Only `GET /` and `POST /debug/sql` | REST API for all resources | Implement routers: `auth`, `dashboard`, `patients`, `visits`, `consents`, `hospitals`, `doctors`, `duplicate_tests`, `audit` |
| **Auth / User Model** | No user table in schema | Role-based authentication | Implement mock authentication service or add `app_user` table |
| **Database Objects** | 9 base tables in DDL | Views, functions, triggers | Execute `v_patient_timeline`, `v_duplicate_lab_tests`, `fn_has_consent`, etc. |
