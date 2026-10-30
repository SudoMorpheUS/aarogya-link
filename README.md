# AarogyaLink (आरोग्यLink)

> **Consent-Driven Multi-Hospital Health Data Sharing Platform**  
> *Database Management Systems (DBMS) — Digital Assignment 02*

---

## 🌟 Overview & Problem Statement

### The Problem
* When a patient visits a new hospital, the attending doctor typically cannot access prior diagnostic history, drug allergies, or active prescriptions.
* Medical records remain fragmented across proprietary hospital silos, traveling as loose paper printouts, emailed PDFs, or folders carried by patients.
* Recent clinical investigations (e.g., Blood tests, ECGs, MRIs) are frequently re-ordered simply because the previous results cannot be retrieved across hospital boundaries.
* ABDM and HL7/FHIR standards exist, but national hospital adoption remains incomplete.

### The Solution: AarogyaLink
AarogyaLink provides a unified digital health data exchange built on a clean, centralized **PostgreSQL 17** relational architecture (BCNF) without blockchain overhead:

1. **One Global Profile:** Every patient receives a unique national identifier (e.g., `PAT-IN-1001` / `PAT100001`). All clinical encounters across affiliated hospitals consolidate into one longitudinal record.
2. **Consent-First Dynamic Authorization:** Patients have sole ownership of their records. They grant or revoke time-bound access at the facility level (hospital-wide) or doctor-specific level via stored database functions (`fn_has_consent`).
3. **Emergency "Break-Glass" Access:** In life-threatening clinical emergencies, doctors can bypass standard consent by supplying mandatory clinical justification, which immediately records an immutable `EMERGENCY_OVERRIDE` entry in the audit ledger.
4. **Cross-Hospital Duplicate Lab Test Detection:** Intelligent analytics automatically flag repeated investigations (e.g., ECG, HbA1c, Serum Creatinine) ordered within a 90-day window across different hospital networks, reducing patient costs and unnecessary procedures.
5. **Idle Privacy Guard:** Built-in client-side inactivity protection automatically blurs sensitive Protected Health Information (PHI) after 2 minutes of idle time.
6. **Immutable Audit Ledger:** Every chart lookup, visit creation, consent adjustment, and emergency override is recorded to an append-only audit trail (`audit_log`) powered by database triggers.

---

## 🏗️ System Architecture (3-Tier Production Stack)

```
Browser (Next.js 16 • React 19)   →   REST API (FastAPI & Uvicorn)   →   Database (PostgreSQL 17 BCNF)
```

```mermaid
flowchart TD
    subgraph Presentation["Presentation Layer (Next.js 16 • React 19)"]
        P["👤 Patient Portal\n(/dashboard, /consents)"]
        D["🩺 Doctor Portal\n(/patients, /visits/new)"]
        A["🛡️ Admin Portal\n(/dashboard, /hospitals, /audit)"]
        IG["🔒 Idle Privacy Guard\n(Client-side Screen Blurring)"]
        UI["Clinical UI & 1-Click Persona Switcher"]
    end

    subgraph Application["Application Layer (FastAPI & Uvicorn)"]
        API["FastAPI REST Endpoints\n(/api/patients, /api/visits, /api/duplicates,\n/api/hospitals, /api/consents, /api/audit)"]
        PolicyEngine["Consent Policy Engine\n& Break-Glass Verifier"]
        AuthRouter["Session Authentication Router\n(PBKDF2 Local / Supabase Auth)"]
    end

    subgraph Database["Database Layer (PostgreSQL 17 • Relational BCNF)"]
        Tables[("10 Relational Tables (BCNF)\nPatients, Doctors, Hospitals, Visits,\nDiagnoses, Prescriptions, Lab Tests,\nConsent, Audit Log, Admin User")]
        Procs["Stored Procedures & Functions\n• fn_has_consent(patient_id, doctor_id)\n• sp_grant_consent(...)"]
        Triggers["PL/pgSQL Triggers\n• tr_visit_audit ➔ trg_visit_audit()"]
        Views["Analytical Views\n• v_duplicate_lab_tests (90-day cross-hospital)"]
        Ledger[("Immutable Audit Ledger\n(audit_log)")]
    end

    P --> UI
    D --> UI
    A --> UI
    IG -.-> UI
    UI --> AuthRouter
    AuthRouter --> API
    API --> PolicyEngine
    PolicyEngine --> Procs
    PolicyEngine --> Tables
    API --> Views
    API --> Tables
    Tables --> Triggers
    Triggers --> Ledger
```

---

## 🗄️ Relational Database Design (Boyce-Codd Normal Form)

The database schema is organized into three logical operational domains:
* **People & Facilities:** `patient`, `hospital`, `doctor`, `admin_user`.
* **Clinical Encounters:** `visit` acts as the hub connecting to dependent child tables `diagnosis`, `prescription`, and `lab_test`.
* **Trust & Compliance:** `consent` dictates access policies; `audit_log` records all data access.

### Entity-Relationship Diagram

```mermaid
erDiagram
    HOSPITAL ||--o{ DOCTOR : employs
    HOSPITAL ||--o{ VISIT : hosts
    HOSPITAL ||--o{ CONSENT : "receives consent"
    PATIENT ||--o{ VISIT : has
    PATIENT ||--o{ CONSENT : grants
    PATIENT ||--o{ AUDIT_LOG : tracks
    DOCTOR ||--o{ VISIT : conducts
    DOCTOR ||--o{ CONSENT : "receives consent"
    DOCTOR ||--o{ AUDIT_LOG : logs
    VISIT ||--o{ DIAGNOSIS : contains
    VISIT ||--o{ PRESCRIPTION : generates
    VISIT ||--o{ LAB_TEST : orders

    PATIENT {
        varchar(20) patient_id PK
        varchar(100) full_name
        date date_of_birth
        char(1) gender
        varchar(5) blood_group
        varchar(15) contact_number
        varchar(100) email UK
    }

    HOSPITAL {
        varchar(15) hospital_id PK
        varchar(150) hospital_name
        varchar(255) address
        varchar(15) contact_number
        varchar(30) registration_no UK
    }

    DOCTOR {
        varchar(15) doctor_id PK
        varchar(15) hospital_id FK
        varchar(100) full_name
        varchar(80) specialization
        varchar(30) license_number UK
        varchar(100) email
        varchar(15) contact_number
    }

    VISIT {
        serial visit_id PK
        varchar(20) patient_id FK
        varchar(15) hospital_id FK
        varchar(15) doctor_id FK
        timestamp visit_date
        varchar(20) visit_type
        varchar(255) chief_complaint
    }

    DIAGNOSIS {
        serial diagnosis_id PK
        int visit_id FK
        varchar(10) disease_code
        varchar(255) description
        date diagnosed_date
    }

    PRESCRIPTION {
        serial prescription_id PK
        int visit_id FK
        varchar(100) medicine_name
        varchar(50) dosage
        varchar(50) frequency
        varchar(50) duration
    }

    LAB_TEST {
        serial lab_test_id PK
        int visit_id FK
        varchar(100) test_name
        varchar(100) result
        varchar(30) unit
        date test_date
    }

    CONSENT {
        serial consent_id PK
        varchar(20) patient_id FK
        varchar(15) hospital_id FK
        varchar(15) doctor_id FK
        date start_date
        date end_date
        varchar(15) status
    }

    AUDIT_LOG {
        serial log_id PK
        varchar(20) patient_id FK
        varchar(15) doctor_id FK
        varchar(30) action
        timestamp action_time
        text details
    }

    ADMIN_USER {
        varchar(100) email PK
        varchar(100) full_name
        timestamp created_at
    }
```

---

### Relational Schema Summary

| Table | Primary Key | Foreign Keys | Cascade / Restrict | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `hospital` | `hospital_id` | — | RESTRICT | Accredited hospital network facilities, registration numbers, and addresses. |
| `doctor` | `doctor_id` | `hospital_id` → `hospital` | RESTRICT | Physicians, medical licenses, specializations, and affiliated hospital. |
| `patient` | `patient_id` | — | RESTRICT | Registered citizens with unique emails, masked IDs, and blood groups. |
| `visit` | `visit_id` | `patient_id`, `hospital_id`, `doctor_id` | RESTRICT | Clinical encounter records (`OPD`, `Emergency`, `Inpatient`). |
| `diagnosis` | `diagnosis_id` | `visit_id` → `visit` | **CASCADE** | Clinical ICD-10 diagnosis codes and descriptions. |
| `prescription` | `prescription_id` | `visit_id` → `visit` | **CASCADE** | Formulations, dosages, intake frequencies, and durations. |
| `lab_test` | `lab_test_id` | `visit_id` → `visit` | **CASCADE** | Laboratory diagnostic investigations, units, values, and test dates. |
| `consent` | `consent_id` | `patient_id`, `hospital_id` (opt), `doctor_id` (opt) | RESTRICT | Dynamic time-bound authorization rules (`Active` / `Revoked`). |
| `audit_log` | `log_id` | `patient_id`, `doctor_id` (opt) | SET NULL / RESTRICT | Append-only ledger recording all data access and clinical actions. |
| `admin_user` | `email` | — | RESTRICT | Platform administrative accounts for compliance governance. |

> *Note on Local Authentication:* When running self-hosted without cloud IAM, an auxiliary credential table `public.auth_user` (`email PK`, `password_hash`, `role`, `user_id`, `created_at`) is maintained in `database/local/00_local_auth_compat.sql` to manage salted PBKDF2 hashes for local logins.

---

## ⚡ Stored Procedures, Functions, Triggers & Views

### 1. Dynamic Consent Evaluation (`fn_has_consent`)
Evaluates whether a doctor has active authorization to read a patient's longitudinal health record:
```sql
CREATE OR REPLACE FUNCTION public.fn_has_consent(
    p_patient_id character varying, 
    p_doctor_id character varying
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM consent c
    JOIN doctor d ON d.doctor_id = p_doctor_id
    WHERE c.patient_id = p_patient_id
      AND c.status = 'Active'
      AND c.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
      AND (c.end_date IS NULL OR c.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date)
      AND (c.doctor_id = p_doctor_id OR c.hospital_id = d.hospital_id)
  );
$$;
```

### 2. Atomic Consent Granting Procedure (`sp_grant_consent`)
Synchronizes ID sequences and inserts active consent records safely:
```sql
CREATE OR REPLACE FUNCTION sp_grant_consent(
  p_patient_id VARCHAR, p_hospital_id VARCHAR, p_doctor_id VARCHAR,
  p_start_date DATE, p_end_date DATE
) RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE new_id INTEGER;
BEGIN
  IF p_hospital_id IS NULL AND p_doctor_id IS NULL THEN
    RAISE EXCEPTION 'Consent must name a hospital or a doctor';
  END IF;

  PERFORM setval('consent_consent_id_seq', (SELECT COALESCE(MAX(consent_id), 0) + 1 FROM consent), false);

  INSERT INTO consent (patient_id, hospital_id, doctor_id, start_date, end_date, status)
  VALUES (p_patient_id, p_hospital_id, p_doctor_id, p_start_date, p_end_date, 'Active')
  RETURNING consent_id INTO new_id;
  RETURN new_id;
END;
$$;
```

### 3. Automated Clinical Audit Trigger (`tr_visit_audit`)
Guarantees that every newly recorded clinical encounter is immediately captured in the append-only audit ledger:
```sql
CREATE OR REPLACE FUNCTION trg_visit_audit() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_log (patient_id, doctor_id, action, details)
  VALUES (
    NEW.patient_id, NEW.doctor_id, 'INSERT',
    format('visit_id=%s type=%s hospital=%s', NEW.visit_id, NEW.visit_type, NEW.hospital_id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_visit_audit
AFTER INSERT ON visit
FOR EACH ROW EXECUTE FUNCTION trg_visit_audit();
```

### 4. Cross-Hospital Duplicate Lab Test Analytical View (`v_duplicate_lab_tests`)
Identifies identical laboratory investigations conducted on the same patient across different hospitals within a 90-day window:
```sql
CREATE OR REPLACE VIEW v_duplicate_lab_tests AS
SELECT 
    lt1.lab_test_id AS initial_test_id,
    lt1.test_name,
    lt1.test_date AS initial_date,
    v1.patient_id,
    v1.hospital_id AS initial_hospital_id,
    lt2.lab_test_id AS duplicate_test_id,
    lt2.test_date AS duplicate_date,
    v2.hospital_id AS duplicate_hospital_id,
    (lt2.test_date - lt1.test_date) AS days_between
FROM lab_test lt1
JOIN visit v1 ON lt1.visit_id = v1.visit_id
JOIN lab_test lt2 ON lt1.test_name = lt2.test_name AND lt1.lab_test_id < lt2.lab_test_id
JOIN visit v2 ON lt2.visit_id = v2.visit_id AND v1.patient_id = v2.patient_id
WHERE v1.hospital_id <> v2.hospital_id
  AND lt2.test_date >= lt1.test_date
  AND lt2.test_date - lt1.test_date <= 90;
```

### 5. Indexing and Query Optimization
B-Tree indexes targeting the high-frequency query paths:
```sql
CREATE INDEX IF NOT EXISTS idx_visit_patient ON visit(patient_id);
CREATE INDEX IF NOT EXISTS idx_consent_patient_status ON consent(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_lab_test_name_date ON lab_test(test_name, test_date);
CREATE INDEX IF NOT EXISTS idx_audit_patient_time ON audit_log(patient_id, action_time DESC);
```

---

## 👥 Security & Role-Based Access Control (RBAC)

AarogyaLink enforces strict separation of concerns across three distinct user roles:

1. **Patient (Data Owner):**
   * Inspects complete longitudinal medical records (visits, diagnoses, lab investigations, medications).
   * Grants or revokes time-bound dynamic consent (hospital-wide or doctor-specific).
   * Reviews personal audit history to observe exactly which doctors accessed their chart and when.
2. **Doctor (Clinical Provider):**
   * Searches patient directory; reads patient medical charts **only** when active consent exists (`fn_has_consent = true`).
   * Records clinical visits, chief complaints, ICD-10 diagnoses, medications, and laboratory tests.
   * Receives real-time advisory alerts when ordering a duplicate lab test recently conducted at another facility.
   * Can trigger audited emergency **Break-Glass access** if no consent exists during urgent care.
3. **Administrator (Platform Compliance Officer):**
   * Monitors network-wide statistics (50 hospitals, 700+ patients, 1,300+ visits, 2,800+ consents).
   * Analyzes operational hospital caseload distributions (OPD vs. Emergency vs. Inpatient).
   * Inspects live system audit trails and emergency access override justifications.

---

## 🚀 How to Run the Project

### Method 1: Fully Local Docker Stack (Recommended / Demo Mode)
Runs **PostgreSQL 17, FastAPI backend, and Next.js frontend entirely inside Docker**. All data stays on your local machine, keeping sample patient health records private and off the public internet.

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

#### Endpoints:
* **Frontend Web App:** [http://localhost:3000](http://localhost:3000)
* **Backend REST API:** [http://localhost:8000](http://localhost:8000)
* **API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs) or [http://localhost:8000/redoc](http://localhost:8000/redoc)
* **PostgreSQL Port:** `localhost:5434` (mapped from container `5432` to avoid host conflicts)
* **Database Credentials:** user `postgres` / password `postgres` / database `arogya`
* **Local Storage Directory:** `./database/pgdata` (git-ignored)

To reset the database and re-seed from scratch:
```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml down
# Linux / macOS:
rm -rf database/pgdata
# Windows PowerShell:
Remove-Item -Recurse -Force database\pgdata
```

---

### Method 2: Docker Compose with Cloud Database (Supabase)
Connects the containerized frontend and backend to a hosted Supabase PostgreSQL instance:

```bash
docker compose up -d --build
```

---

### Method 3: Hybrid Local Development (Docker DB + Hot Reloading)
Best for active development with FastAPI live reloading and Next.js Turbopack HMR:

1. **Start the local PostgreSQL container:**
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.local.yml up -d postgres
   ```

2. **Run Backend Locally:**
   ```bash
   cd backend
   # Windows PowerShell:
   $env:DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5434/arogya"
   $env:AUTH_MODE="local"
   $env:SESSION_SECRET="dev-session-secret"
   python -m uvicorn main:app --reload --port 8000

   # Linux / macOS:
   # export DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5434/arogya"
   # export AUTH_MODE="local"
   # export SESSION_SECRET="dev-session-secret"
   # uvicorn main:app --reload --port 8000
   ```

3. **Run Frontend Locally:**
   ```bash
   cd frontend
   npm install
   # Windows PowerShell:
   $env:AUTH_MODE="local"
   $env:SESSION_SECRET="dev-session-secret"
   npm run dev

   # Linux / macOS:
   # export AUTH_MODE="local"
   # export SESSION_SECRET="dev-session-secret"
   # npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

---

### Method 4: Standalone Offline Frontend Mode
If Docker or Python is unavailable, Next.js includes a client-side in-memory relational simulation mirroring the BCNF schema, consent rules, and views:
```bash
cd frontend
npm install
npm run dev
```

---

## 🔑 Demo Personas & Test Credentials

The login screen features **1-Click Instant Persona Logins** pre-configured for evaluation:

| Role | Persona Name | Email | Password | Pre-configured Access & Privileges |
| :--- | :--- | :--- | :--- | :--- |
| **Patient** | Karthik Iyer | `karthik.iyer@example.in` | `AarogyaLink@123` | Patient ID `PAT-IN-1001`. View longitudinal records, manage active consents, view access log. |
| **Doctor** | Dr. Rohan Mehta | `rohan.mehta@example.in` | `AarogyaLink@123` | Doctor ID `DOC-01`. Cardiology @ Apollo Hospitals (`HSP1001`). View permitted charts, record visits, view duplicate alerts. |
| **Emergency Doctor** | Dr. Arjun Singh | `arjun.singh@example.in` | `AarogyaLink@123` | Doctor ID `DOC-03`. Emergency Medicine @ Fortis Healthcare (`HSP1002`). Break-glass override testing. |
| **Administrator** | Central Administrator | `admin@aarogyalink.in` | `AarogyaLink@123` | Network overview, 50-hospital caseload statistics, patient roster sync, audit trail inspection. |

---

## 📊 Pre-Loaded Benchmark Dataset

The database seeds a national multi-hospital healthcare network across major Indian metro centers:

* **50 Accredited Hospitals:** Apollo Hospitals, Fortis Healthcare, AIIMS, Medanta, Manipal, Tata Memorial, Christian Medical College, Narayana Health, and more.
* **300+ Registered Physicians:** General Physicians, Cardiologists, Oncologists, Neurologists, Pulmonologists, Pediatricians.
* **700+ Registered Patients:** Demographic diversity with masked identifiers, unique contacts, and blood groups.
* **1,300+ Clinical Encounters:** Realistic OPD, Emergency, and Inpatient encounter records.
* **2,800+ Active / Historical Consents:** Facility-wide and doctor-specific authorization rules.
* **5,000+ Audit Log Entries:** Complete tracking of data views, record creations, consent modifications, and emergency overrides.

---

## 📁 Repository Structure

```
arogya-link/
├── README.md                      # Complete system documentation (this file)
├── docker-compose.yml             # Cloud Supabase deployment configuration
├── docker-compose.local.yml       # Fully local PostgreSQL 17 + local auth stack
├── database/
│   ├── init_migration_001.sql     # Core BCNF Schema (10 tables, views, functions, triggers, indexes)
│   ├── initial_mock_data_load_fixed.sql # Seed dataset (50 hospitals, 700+ patients, 1300+ visits)
│   ├── seed_demo_consents.sql     # Demo patient consents, doctor associations & sequence fix
│   ├── rls_policies.sql           # Row Level Security policies for production hardening
│   ├── check_rls.sql              # Security audit verification script
│   └── local/
│       └── 00_local_auth_compat.sql # Local PBKDF2 auth table & compatibility helpers
├── frontend/                      # Next.js 16 Web Application (App Router, React 19)
│   ├── src/
│   │   ├── app/                   # App Router pages (/dashboard, /consents, /patients, /hospitals, /audit)
│   │   ├── components/            # UI Components (IdleGuard, VisitForm, AuthCard, ThemeToggle, etc.)
│   │   └── lib/                   # REST API client, session management, in-memory store
│   ├── Dockerfile                 # Multi-stage optimized production build
│   └── package.json               # Next.js 16.4.2 & React 19.3.0
├── backend/                       # FastAPI Python REST Application
│   ├── main.py                    # API entry point, CORS configuration, route inclusion
│   ├── requirements.txt           # FastAPI, Uvicorn, SQLAlchemy 2.0, Psycopg 3
│   ├── Dockerfile                 # Python 3.11 container specification
│   └── src/
│       ├── core/                  # Database engines and connection pooling
│       ├── models/                # SQLAlchemy ORM models matching BCNF tables
│       └── routers/               # Endpoints: patients, visits, duplicates, consents, hospitals, audit, auth
└── docs/                          # Detailed DBMS assignment reports & SQL queries
    ├── SLIDE_EXPLANATIONS.md      # Comprehensive slide-by-slide presentation & viva guide
    ├── DATABASE_SCHEMA.md         # Comprehensive schema & data dictionary
    └── AarogyaLink_DA2_SQL_Queries.md # Complete raw SQL queries for assignment evaluation
```

---

## 🔮 Future Scope
* **ABDM & HL7/FHIR Integration:** Full interoperability with Ayushman Bharat Digital Mission (ABDM) and standard FHIR resource mapping.
* **Multi-Factor OTP Consent:** Real-time SMS/WhatsApp OTP authorization when a doctor requests emergency access outside pre-existing consent.
* **Cryptographic Ledger Integrity:** Merkle-tree hashing or cryptographic sealing for append-only audit verification.
* **Field-Level Encryption at Rest:** pgcrypto-based column encryption for sensitive diagnostic descriptions and clinical notes.
