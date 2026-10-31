# AarogyaLink — DBMS Implementation & Demonstration Guide

This document provides a step-by-step walkthrough to demonstrate all database concepts and operations implemented in the AarogyaLink health data exchange platform.

---

## 1. Data Insertion (INSERT)

### A. Patient Registration
- **Where to show:** Log in as Doctor or Admin &rarr; Navigate to `/patients` &rarr; Click **"Register patient"** &rarr; Submit full name, date of birth, gender, blood group, contact number, and email.
- **Underlying SQL / Backend:**
  - Endpoint: `POST /api/patients` in [`backend/src/routers/patients.py`](backend/src/routers/patients.py)
  - Auto-generates patient ID (`PAT-IN-XXXX`) using `SELECT COALESCE(MAX(SUBSTRING(patient_id FROM '[0-9]+')::integer), 1000) FROM patient`.
  - Inserts into `patient` table with unique email and check constraint validation on `gender IN ('M', 'F', 'O')`.

### B. Doctor Registration
- **Where to show:** Log out &rarr; Click **"Create Account"** tab &rarr; Select role **Doctor** &rarr; Select affiliated hospital &rarr; Enter specialization and medical license number &rarr; Submit.
- **Underlying SQL / Backend:**
  - Endpoint: `POST /api/doctors` in [`backend/src/routers/doctors.py`](backend/src/routers/doctors.py)
  - Normalizes hospital foreign keys (`hospital_id` &rarr; `hospital.hospital_id`), auto-generates `DOC-XXXX`, and stores email and license number.

### C. Clinical Visit Encounter
- **Where to show:** Log in as `Dr. Rohan Mehta` &rarr; Open patient `Mudit Jha` (`/patients/PAT-IN-105001`) &rarr; Click **"Record visit"** (`/visits/new`).
- Add ICD-10 diagnosis codes, prescription details (drug, dose, frequency, duration), and lab test results &rarr; Click **"Save visit"**.
- **Underlying SQL / Backend:**
  - Endpoint: `POST /api/visits` in [`backend/src/routers/visits.py`](backend/src/routers/visits.py)
  - Inserts atomically into 4 relational tables: `visit`, `diagnosis`, `prescription`, `lab_test`.
  - Fires PostgreSQL database trigger `tr_visit_audit` on `AFTER INSERT ON visit`.

### D. Granting Consent
- **Where to show:** Log in as patient `Mudit Jha` &rarr; Navigate to `/consents` &rarr; Select a target hospital or doctor, valid start date, and expiry &rarr; Click **"Allow access"**.
- **Underlying SQL / Backend:**
  - Invokes stored procedure `sp_grant_consent(...)` which writes to `consent` and `audit_log`.

---

## 2. Data Retrieval (SELECT)

### A. Longitudinal Unified Patient Timeline
- **Where to show:** Log in as Doctor &rarr; Open any consented patient (`/patients/PAT-IN-1002`).
- **Underlying SQL / Backend:**
  - Endpoint: `GET /api/patients/{patient_id}/timeline` in [`backend/src/routers/patients.py`](backend/src/routers/patients.py)
  - Queries `visit` joined with `hospital`, `doctor`, `diagnosis`, `prescription`, and `lab_test`, sorted by `visit_date DESC`.

### B. Multi-Attribute Patient Search
- **Where to show:** On `/patients`, search by name (`"Karthik"`), patient ID (`"1002"`), contact number (`"98"`), or blood group (`"O+"`).
- **Underlying SQL:**
  ```sql
  SELECT * FROM patient
  WHERE LOWER(full_name) LIKE :q
     OR LOWER(patient_id) LIKE :q
     OR contact_number LIKE :q
     OR LOWER(blood_group) = :q
  ORDER BY patient_id DESC LIMIT 100;
  ```

### C. Active Prescriptions & Lab Results
- **Where to show:** Patient or Doctor Dashboard (`/dashboard`).
- **Underlying SQL:**
  - Active Prescriptions: Filters ongoing prescriptions with calculated remaining course duration (`days_left`).
  - Lab Diagnostics: Queries `lab_test` joined with `visit` and `hospital`, evaluating flags (`critical`, `watch`, `normal`) against clinical reference ranges.

---

## 3. Update & Delete Operations (UPDATE & DELETE)

### A. UPDATE Operations
1. **Consent Revocation:**
   - **Where to show:** Log in as patient &rarr; `/consents` &rarr; Click **"Revoke"** on any active consent row.
   - **Underlying SQL:**
     ```sql
     UPDATE consent 
     SET status = 'Revoked', end_date = CURRENT_DATE 
     WHERE consent_id = :id;
     ```
     *(If revoking hospital consent, cascade revokes all active doctor consents associated with that hospital network).*
2. **Patient Demographics Update:**
   - **Endpoint:** `PUT /api/patients/{patient_id}` in [`backend/src/routers/patients.py`](backend/src/routers/patients.py)
   - Updates contact number, email, or blood group in PostgreSQL.
3. **Doctor Profile Update:**
   - **Endpoint:** `PUT /api/doctors/{doctor_id}` in [`backend/src/routers/doctors.py`](backend/src/routers/doctors.py)
   - Updates specialization, contact details, or affiliated hospital network.

### B. DELETE Operations
1. **Consent Hard Deletion:**
   - **Endpoint:** `DELETE /api/consents/{consent_id}` in [`backend/src/routers/consents.py`](backend/src/routers/consents.py)
   - Executes `DELETE FROM consent WHERE consent_id = :id`.
2. **Clinical Encounter Deletion:**
   - **Endpoint:** `DELETE /api/visits/{visit_id}` in [`backend/src/routers/visits.py`](backend/src/routers/visits.py)
   - Atomically removes dependent `diagnosis`, `prescription`, and `lab_test` rows before deleting the parent `visit` record.
3. **Doctor Record Deletion:**
   - **Endpoint:** `DELETE /api/doctors/{doctor_id}` in [`backend/src/routers/doctors.py`](backend/src/routers/doctors.py)
   - Validates foreign key constraints; rolls back safely if active visits or audit logs depend on the doctor.

---

## 4. SQL Queries, Joins, Nested Queries & Aggregate Functions

### A. Complex Multi-Table Joins
- **Duplicate Diagnostic Detection (`v_duplicate_lab_tests`):**
  Uses a 4-table self-join comparing tests taken across distinct hospitals within a short timeframe:
  ```sql
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
  WHERE v1.hospital_id <> v2.hospital_id;
  ```
  *(Viewable live in the Admin portal under `/duplicates`).*

### B. Nested Subqueries
- **Accessible Patient Query:**
  ```sql
  SELECT DISTINCT c.patient_id
  FROM consent c
  JOIN doctor d ON d.doctor_id = :doctor_id
  WHERE c.status = 'Active'
    AND c.start_date <= CURRENT_DATE
    AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
    AND (c.doctor_id = :doctor_id OR c.hospital_id = d.hospital_id);
  ```

### C. Aggregate Functions
- **Hospital Caseload Analytics (`v_hospital_caseload`):**
  Uses `COUNT(*)`, `COUNT(DISTINCT ...)`, `FILTER (WHERE ...)`:
  ```sql
  SELECT 
      h.hospital_id,
      h.hospital_name,
      COUNT(DISTINCT d.doctor_id) AS doctor_count,
      COUNT(v.visit_id) AS visit_count,
      COUNT(DISTINCT v.patient_id) AS patient_count,
      COUNT(v.visit_id) FILTER (WHERE v.visit_type = 'OPD') AS opd_visits,
      COUNT(v.visit_id) FILTER (WHERE v.visit_type = 'Emergency') AS emergency_visits,
      COUNT(v.visit_id) FILTER (WHERE v.visit_type = 'Inpatient') AS inpatient_visits
  FROM hospital h
  LEFT JOIN doctor d ON h.hospital_id = d.hospital_id
  LEFT JOIN visit v ON h.hospital_id = v.hospital_id
  GROUP BY h.hospital_id, h.hospital_name;
  ```
  *(Viewable live under `/hospitals`).*

---

## 5. Views

AarogyaLink defines three core relational views in [`database/init_migration_001.sql`](database/init_migration_001.sql):

1. **`v_patient_timeline`**: Flattened cross-hospital clinical timeline combining visits, doctor names, hospital details, and diagnoses.
2. **`v_duplicate_lab_tests`**: Diagnostic waste detection view detecting repeated investigations across separate institutions.
3. **`v_hospital_caseload`**: Operational caseload metric view aggregating clinical volumes by department and institution.

---

## 6. Stored Procedures, Functions & Triggers

### A. Stored Procedure: `sp_grant_consent`
- **Location:** [`database/init_migration_001.sql`](database/init_migration_001.sql)
- **Signature:**
  ```sql
  CREATE OR REPLACE PROCEDURE sp_grant_consent(
    p_patient_id  VARCHAR(20),
    p_hospital_id VARCHAR(15),
    p_doctor_id   VARCHAR(15),
    p_start_date  DATE,
    p_end_date    DATE
  )
  ```
- **Functionality:** Validates date constraints, inserts active consent, and records an automated audit ledger entry.

### B. Database Function: `fn_has_consent`
- **Location:** [`database/init_migration_001.sql`](database/init_migration_001.sql)
- **Signature:**
  ```sql
  CREATE OR REPLACE FUNCTION fn_has_consent(
    p_patient_id VARCHAR(20),
    p_doctor_id  VARCHAR(15)
  ) RETURNS BOOLEAN
  ```
- **Functionality:** Evaluates whether active consent exists either naming the doctor directly or naming their affiliated hospital network.

### C. Database Trigger: `tr_visit_audit`
- **Location:** [`database/init_migration_001.sql`](database/init_migration_001.sql)
- **Trigger Definition:**
  ```sql
  CREATE TRIGGER tr_visit_audit
  AFTER INSERT ON visit
  FOR EACH ROW EXECUTE FUNCTION trg_visit_audit();
  ```
- **Functionality:** Automatically writes an immutable `INSERT` audit row to `audit_log` whenever a new clinical visit is inserted into PostgreSQL.

---

## 7. NoSQL / Hybrid Document Capabilities

- **JSONB Medical Payloads:** PostgreSQL natively supports unstructured clinical payloads via the `JSONB` data type.
- Unstructured lab biomarkers, genomic parameters, and FHIR resource objects can be queried using PostgreSQL JSONB operators (`->`, `->>`, `@>`) and GIN indexes, demonstrating hybrid relational + document modeling.

---

## 8. Supabase Database

- PostgreSQL runs on Supabase. The backend reads one connection string:
  ```env
  DATABASE_URL=postgresql+psycopg://user:password@host:5432/dbname
  ```
- `docker-compose.yml` sets `DATABASE_URL` to the Supabase pooler. Sign-in uses Supabase Authentication (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
- Load the project in the Supabase SQL editor in this order:
  1. [`database/init_migration_001.sql`](database/init_migration_001.sql)
  2. [`database/initial_mock_data_load_fixed.sql`](database/initial_mock_data_load_fixed.sql)
  3. [`database/seed_demo_consents.sql`](database/seed_demo_consents.sql)
  4. [`database/rls_policies.sql`](database/rls_policies.sql)

---

## 9. Dashboard & Visualization

- **Patient Portal (`/dashboard`):** Real-time KPI summary (Total Visits, Holding Hospitals, Active Consents, Access Events), recent lab results table with abnormal value chips, and care team doctor directory.
- **Doctor Portal (`/dashboard`):** Active accessible patient queue, critical lab alert badges, personal consultation count, and avoidable repeat-test counter.
- **Hospital Caseload Analytics (`/hospitals`):** Departmental breakdown charts (OPD vs Emergency vs Inpatient) and doctor headcounts across national healthcare networks.
- **Audit Analytics (`/audit`):** Sub-categorized audit events (`Reads`, `Denied`, `Emergency`, `Consent`, `Visits`) with real-time counters.

---

## 10. Security & Access Control

- **Attribute-Based Access Control (ABAC):** Consent is evaluated dynamically based on doctor ID, hospital ID, patient consent grants, and date validity.
- **Emergency Break-Glass Override:** Unconsented records cannot be viewed by unauthorized doctors (`403 Access Denied`). Doctors with urgent clinical necessity can submit a clinical justification reason, creating an audited 30-minute emergency read window (`EMERGENCY_OVERRIDE`).
- **Privacy Idle Guard:** Frosted glassmorphism screen lock activates after 2 minutes of user inactivity to conceal sensitive health data from unattended displays.
- **Tamper-Evident Audit Ledger:** All system reads, denied attempts, and modifications are recorded in `audit_log` with actor foreign keys and UTC timestamps.

---

## 11. Testing & Error Handling

- **Automated Type Checking:** Run `npm run typecheck` in `/frontend` to verify 100% strict TypeScript typing.
- **Database Rollback Protection:** All write operations in the FastAPI routers wrap SQLAlchemy execution in `try ... except ... db.rollback()` blocks to guarantee ACID atomicity and prevent orphaned partial records.
- **Foreign Key & Check Constraints:** Validated constraints on `patient.gender`, `hospital.hospital_id`, and `doctor.license_number`.

---

## 12. Indexing & Query Optimization

AarogyaLink implements four strategic B-Tree composite secondary indexes to eliminate costly full-table sequential scans (`Seq Scan`) and accelerate high-throughput queries:

1. **`visit(patient_id)` &rarr; `idx_visit_patient`**
   - **Purpose:** Opens a patient's longitudinal clinical timeline (`/patients/[id]`).
   - **Optimization:** Replaces a sequential scan across thousands of visits with a logarithmic index lookup ($O(\log N)$) to fetch only visits matching `patient_id`.
   - **SQL:**
     ```sql
     CREATE INDEX idx_visit_patient ON visit(patient_id);
     ```

2. **`consent(patient_id, status)` &rarr; `idx_consent_patient_status`**
   - **Purpose:** Used on every consent verification check (`fn_has_consent`).
   - **Optimization:** Allows PostgreSQL to perform an `Index Only Scan` for active authorizations (`WHERE patient_id = :id AND status = 'Active'`), immediately discarding revoked and expired records without inspecting table heap pages.
   - **SQL:**
     ```sql
     CREATE INDEX idx_consent_patient_status ON consent(patient_id, status);
     ```

3. **`lab_test(test_name, test_date)` &rarr; `idx_lab_test_name_date`**
   - **Purpose:** Drives the cross-hospital duplicate test detection view (`v_duplicate_lab_tests`).
   - **Optimization:** Accelerates the self-join query finding tests of the same name conducted within a 90-day window (`test_date - test_date <= 90`), preventing an expensive $O(N^2)$ cross product.
   - **SQL:**
     ```sql
     CREATE INDEX idx_lab_test_name_date ON lab_test(test_name, test_date);
     ```

4. **`audit_log(patient_id, action_time DESC)` &rarr; `idx_audit_patient_time`**
   - **Purpose:** Targeted patient audit trail on `/audit?patient_id=...` and patient access history timeline.
   - **Optimization:** Provides pre-sorted retrieval for `WHERE patient_id = :id ORDER BY action_time DESC`, avoiding an in-memory or disk-spill Sort step.
   - **Key Principle:** The index groups entries by patient and orders their timestamps from newest to oldest, which can reduce the work needed to retrieve the latest entries.
   - **UI Integration (Demonstration Workflow):**
     - As **Admin**, open `/patients` and click any patient's name or the **"Audit logs ↗"** button.
     - A **new tab** opens directly at `/audit?patient_id=<PATIENT_ID>`.
     - The page renders the **Patient Access Intelligence** summary banner answering three core security questions:
       1. **Who accessed the patient's records?** — Lists all distinct clinicians and platform actors who inspected the patient's records.
       2. **When did they access them?** — Displays the most recent timestamp and historical timespan across all recorded access events.
       3. **What happened most recently?** — Shows the latest audit action (e.g., `READ`, `INSERT`, `EMERGENCY_OVERRIDE`), the clinician responsible, and event details.
   - **SQL:**
     ```sql
     CREATE INDEX idx_audit_patient_time ON audit_log(patient_id, action_time DESC);
     ```

### E. Uniform Hospital Management & Clinician Roster Tab
- **Where to show:** Navigate to `/hospitals` as Admin.
- **Uniform Facility Layout:** Hospital cards only display facility metadata, registration numbers, contact information, and aggregated caseload chips (Visits, Patients, OPD, Inpatient, Emergency).
- **Dedicated Doctor Roster:** Clicking **"View doctors (count) ↗"** opens a **new tab** (`/hospitals/<HOSPITAL_ID>`) dedicated to displaying that facility's clinician staff, specialization, and medical licenses in a full-width data table without distorting the main hospital grid.

### How to Demonstrate Query Optimization:
Run `EXPLAIN ANALYZE` inside PostgreSQL to verify that the query planner selects index scans:
```sql
EXPLAIN ANALYZE SELECT * FROM visit WHERE patient_id = 'PAT-IN-1002';
EXPLAIN ANALYZE SELECT * FROM consent WHERE patient_id = 'PAT-IN-105001' AND status = 'Active';
EXPLAIN ANALYZE SELECT * FROM audit_log WHERE patient_id = 'PAT-IN-105001' ORDER BY action_time DESC;
```
*(Notice the `Index Scan using idx_...` in the query execution plan instead of `Seq Scan`)*.


