# AarogyaLink — Complete Slide-by-Slide Presentation Guide & Viva Manual

> **Project:** AarogyaLink — A Federated, Consent-Driven Multi-Hospital Health Data Sharing Platform  
> **Course:** Database Management Systems (DBMS) — Digital Assignment 02  
> **Developer:** Archit (25BRS1030)  
> **Architecture Reference:** Next.js 16 (React 19) • FastAPI & Uvicorn • PostgreSQL 17 (Relational BCNF)

---

## Table of Contents
1. [Slide 1: Title Slide](#slide-1-title-slide)
2. [Slide 2: The Problem](#slide-2-the-problem)
3. [Slide 3: Project Objectives](#slide-3-project-objectives)
4. [Slide 4: Existing System vs. Our Solution](#slide-4-existing-system-vs-our-solution)
5. [Slide 5: System Architecture & Workflow](#slide-5-system-architecture--workflow)
6. [Slide 6: Database Design (Domain Decomposition)](#slide-6-database-design-domain-decomposition)
7. [Slide 7: Entity-Relationship (ER) Diagram & Cardinalities](#slide-7-entity-relationship-er-diagram--cardinalities)
8. [Slide 8: Relational Schema & Integrity Constraints](#slide-8-relational-schema--integrity-constraints)
9. [Slide 9: Database Normalization (BCNF Analysis)](#slide-9-database-normalization-bcnf-analysis)
10. [Slide 10: SQL Implementation & DDL Construction](#slide-10-sql-implementation--ddl-construction)
11. [Slide 11: Deployment on Supabase](#slide-11-deployment-on-supabase)
12. [Slide 12: Indexing & Query Optimization](#slide-12-indexing--query-optimization)
13. [Slide 13: Security & Role-Based Access Control (RBAC)](#slide-13-security--role-based-access-control-rbac)
14. [Slide 14: Administrator Dashboard (UI Walkthrough)](#slide-14-administrator-dashboard-ui-walkthrough)
15. [Slide 15: Doctor Dashboard & Clinical Workflow](#slide-15-doctor-dashboard--clinical-workflow)
16. [Slide 16: Patient Dashboard & Consent Ownership](#slide-16-patient-dashboard--consent-ownership)
17. [Slide 17: Cross-Hospital Duplicate Test Alert (Live UI)](#slide-17-cross-hospital-duplicate-test-alert-live-ui)
18. [Slide 18: Consent Check Execution & Cross-Join Verification](#slide-18-consent-check-execution--cross-join-verification)
19. [Slide 19: Database Verification — `admin_user` Table](#slide-19-database-verification--admin_user-table)
20. [Slide 20: Database Verification — `audit_log` Table](#slide-20-database-verification--audit_log-table)
21. [Slide 21: Database Verification — `consent` Table](#slide-21-database-verification--consent-table)
22. [Slide 22: Database Verification — `diagnosis` Table](#slide-22-database-verification--diagnosis-table)
23. [Slide 23: Database Verification — `doctor` Table](#slide-23-database-verification--doctor-table)
24. [Slide 24: Database Verification — `hospital` Table](#slide-24-database-verification--hospital-table)
25. [Slide 25: Database Verification — `lab_test` Table](#slide-25-database-verification--lab_test-table)
26. [Slide 26: Database Verification — `patient` Table](#slide-26-database-verification--patient-table)
27. [Slide 27: Database Verification — `prescription` Table](#slide-27-database-verification--prescription-table)
28. [Slide 28: Database Verification — `visit` Table](#slide-28-database-verification--visit-table)
29. [Slide 29: Trigger Implementation — `trg_visit_audit()`](#slide-29-trigger-implementation--trg_visit_audit)
30. [Slide 30: Conclusion & Future Scope](#slide-30-conclusion--future-scope)

---

### Slide 1: Title Slide
* **Slide Text:**  
  *AarogyaLink — A multi-hospital health data sharing platform*  
  *Developer: Archit (25BRS1030)*
* **Technical Overview:**  
  Introduces the core concept: a federated, consent-governed longitudinal health record exchange designed for multi-institutional healthcare ecosystems in India.
* **What to Say (Speaking Script):**  
  > "Good morning, respected professor. Today I am presenting AarogyaLink, a federated healthcare data exchange platform. AarogyaLink bridges the clinical communication gap across independent hospital networks using a clean, normalized relational database architecture built strictly in Boyce-Codd Normal Form (BCNF), governed by dynamic patient consent, database-level security, and immutable audit logging."
* **Viva Q&A:**  
  * **Q:** What is the primary purpose of this project?  
    * **A:** To eliminate isolated healthcare data silos by allowing doctors across different hospital institutions to view a patient's historical medical records, while guaranteeing that the patient retains complete legal ownership and dynamic consent control over their health data.

---

### Slide 2: The Problem
* **Slide Text:**  
  * When a patient goes to a new hospital, the doctor usually can’t see their history, allergies or current medicines.
  * Reports travel as printouts, emailed PDFs or folders the patient carries around.
  * Tests that were already done get repeated because nobody can find the result.
  * Every hospital keeps its own database, and those databases don’t talk to each other.
* **Technical Overview:**  
  Highlights the real-world healthcare fragmentation crisis:
  1. **Information Asymmetry:** No interoperability between distinct Hospital Management Information Systems (HMIS).
  2. **Economic Waste:** Costly redundant diagnostics (e.g., repeating a \$150 MRI or routine HbA1c because records were lost).
  3. **Patient Safety Risk:** Untracked drug-drug interactions or unknown allergies during emergency admissions.
* **What to Say (Speaking Script):**  
  > "In the current Indian healthcare ecosystem, medical records are locked inside proprietary hospital databases. When a patient moves from AIIMS to Apollo or Fortis, their records do not travel with them. Patients are forced to carry physical paper files and PDFs. If those records are unavailable, doctors are blind to prior diagnoses, drug allergies, or current prescriptions. Most crucially, diagnostic tests are repeated unnecessarily, draining patient finances and consuming hospital bandwidth."
* **Viva Q&A:**  
  * **Q:** Why don't existing hospital databases communicate with each other?  
    * **A:** Hospitals use proprietary, closed schemas with local internal IDs. There is no unified schema standardization, no federated consent framework, and strict institutional isolation prevents raw database sharing without an intermediary governing layer.

---

### Slide 3: Project Objectives
* **Slide Text:**  
  * **One profile:** All of a patient’s history from different hospitals in one place.
  * **Consent first:** A doctor only sees records the patient has allowed.
  * **Quick retrieval:** A patient’s history should come back fast when searched.
  * **Fewer repeat tests:** Show recent results from other hospitals.
  * **Clean data:** Every hospital enters records in the same format.
* **Technical Overview:**  
  Establishes the core engineering objectives:
  * Global entity identity mapping via unique national patient identifiers.
  * Deterministic authorization evaluated at query execution time (`fn_has_consent`).
  * Sub-millisecond indexed relational access paths.
  * 90-day cross-institutional duplicate test detection.
  * Strict schema typing, domain check constraints, and referential integrity.
* **What to Say (Speaking Script):**  
  > "AarogyaLink addresses this through five core DBMS objectives: first, establishing a single longitudinal patient profile under a global identifier; second, enforcing consent-first access control so records are inaccessible without patient approval; third, optimizing retrieval performance using specialized B-tree indexing; fourth, implementing analytical duplicate lab test detection to warn doctors against repeating tests done within 90 days; and fifth, enforcing strict BCNF relational normalization so all hospitals record clinical data uniformly."

---

### Slide 4: Existing System vs. Our Solution
* **Slide Text:**  
  * **Today:** Each hospital has its own software and patient ID; sharing is done with PDFs and paper; consent is handled inside each hospital; ABDM and HL7/FHIR exist, but adoption is incomplete.
  * **Our Approach:** One PostgreSQL database with a global patient ID; patient grants or revokes access per hospital or doctor; every access is written to an audit log; a normal relational design, no blockchain.
* **Technical Overview:**  
  * Justifies architectural choices: why a normalized relational model (RDBMS) is superior to complex, slow, and expensive distributed ledgers (blockchain) for high-frequency clinical transactions.
  * Relational ACID properties guarantee consistent updates, transactional foreign-key rollbacks, and instant trigger firing.
* **What to Say (Speaking Script):**  
  > "While solutions like blockchain are frequently proposed in academic literature, they introduce unacceptable query latency, high storage costs, and lack SQL expressiveness. Instead, AarogyaLink proves that a centralized, high-performance PostgreSQL 17 relational database—governed by relational integrity constraints, stored functions, and trigger-based immutable audit logging—solves the problem cleanly with sub-millisecond query latency and strict ACID compliance."
* **Viva Q&A:**  
  * **Q:** Why choose a relational database over blockchain for medical records?  
    * **A:** Medical data requires complex relational joins (patients to visits, visits to diagnoses, prescriptions, and lab tests) and sub-millisecond lookups. Relational databases offer full ACID transactions, strict referential integrity with cascading constraints, rich SQL query capability, and mature indexing, whereas blockchain has severe transaction throughput limits and high overhead.

---

### Slide 5: System Architecture & Workflow
* **Slide Text & Visual:**  
  * 3-Tier Production Architecture:
    * **Presentation Layer (Next.js 16 • React 19):** Patient Portal, Doctor Portal, Admin Portal, Idle Privacy Guard.
    * **Application Layer (FastAPI & Uvicorn):** REST services, Consent Policy Engine & Break-Glass Verifier.
    * **Database Layer (PostgreSQL 17 • Relational BCNF):** 10 Relational Tables, Stored Procedures, PL/pgSQL Triggers, Analytical Views, Immutable Audit Ledger.
* **Technical Overview:**  
  * **Presentation:** Next.js 16 App Router renders clinical portals with zero-layout shift, Tailwind Neo-brutalism, and an **Idle Privacy Guard** that blurs patient PHI after 2 minutes of idle time.
  * **Application:** Python FastAPI uses connection pooling (`psycopg3`), enforces JWT/session verification, validates schemas via Pydantic, and handles break-glass emergency exceptions.
  * **Database:** PostgreSQL 17 houses 10 normalized tables, stored functions (`fn_has_consent`), sequence-synchronized procedures (`sp_grant_consent`), and triggers (`tr_visit_audit`).
* **What to Say (Speaking Script):**  
  > "Here is our 3-tier architecture. At the top is the Presentation Layer running Next.js 16 with React 19, delivering dedicated portals for Patients, Doctors, and Administrators, as well as an Idle Privacy Guard that blurs screens after 2 minutes of inactivity to safeguard patient confidentiality on shared hospital computers. The Application Layer is powered by FastAPI and Uvicorn, which houses the Consent Policy Engine and REST endpoints. Finally, the Database Layer runs PostgreSQL 17 in Boyce-Codd Normal Form, containing 10 core tables, stored procedures, triggers, and analytical views."

---

### Slide 6: Database Design (Domain Decomposition)
* **Slide Text:**  
  * **People:** `patient`, `hospital`, `doctor`. Each patient gets one global ID, like `PAT-IN-1001`.
  * **Care:** `visit` is the hub. `diagnosis`, `prescription` and `lab_test` each belong to a visit.
  * **Trust:** `consent` records who is allowed to look. `audit_log` records who did.
* **Technical Overview:**  
  Decomposes the healthcare operational domain into three distinct subsystems:
  1. **Master Entities (People & Facilities):** Foundational master records with unique constraints on emails, license numbers, and hospital registration codes.
  2. **Clinical Transaction Hub (Care):** Star-cluster model centered on `visit`. A visit records the temporal and physical encounter, while `diagnosis`, `prescription`, and `lab_test` are child tables referencing `visit_id`.
  3. **Governance & Compliance (Trust):** Dual-layer security where `consent` manages declarative time-bound rules, and `audit_log` is an append-only transaction ledger.
* **What to Say (Speaking Script):**  
  > "We structured the database into three logical domains: People, Care, and Trust. In the People domain, we model Patients, Hospitals, and Doctors, giving each citizen a unique national identifier. In the Care domain, the Visit table serves as the central hub; child tables Diagnosis, Prescription, and Lab Test attach directly to a visit via foreign keys. In the Trust domain, the Consent table manages dynamic permissions, while the Audit Log table maintains an immutable record of every access event."

---

### Slide 7: Entity-Relationship (ER) Diagram & Cardinalities
* **Slide Visual:**  
  Full Entity-Relationship Diagram showing crows-foot notation across all entities.
* **Technical Breakdown of Cardinalities:**
  * **`HOSPITAL` 1:N `DOCTOR`:** A hospital employs zero or more doctors; each doctor is affiliated with exactly one primary hospital (`hospital_id` FK).
  * **`HOSPITAL` 1:N `VISIT`:** A hospital hosts zero or more visits.
  * **`PATIENT` 1:N `VISIT`:** A patient has one or more visits across the national network.
  * **`DOCTOR` 1:N `VISIT`:** A doctor conducts zero or more clinical visits.
  * **`VISIT` 1:N `DIAGNOSIS`:** A visit contains one or more ICD-10 diagnostic entries.
  * **`VISIT` 1:N `PRESCRIPTION`:** A visit generates zero or more prescription line items.
  * **`VISIT` 1:N `LAB_TEST`:** A visit orders zero or more laboratory investigations.
  * **`PATIENT` 1:N `CONSENT`:** A patient grants zero or more consent authorizations.
  * **`DOCTOR` / `HOSPITAL` 0:N `CONSENT`:** A doctor or hospital receives consent grants.
  * **`PATIENT` 1:N `AUDIT_LOG`:** Every action concerning a patient is captured in the audit ledger.
* **What to Say (Speaking Script):**  
  > "Looking at the ER diagram, you can see how referential integrity is established. Hospital has a one-to-many relationship with Doctor and Visit. Patient has a one-to-many relationship with Visit, Consent, and Audit Log. The Visit table acts as a relational bridge connecting Patient, Doctor, and Hospital. In turn, Visit has one-to-many relationships with Diagnosis, Prescription, and Lab Test, representing the clinical outputs of an encounter."
* **Viva Q&A:**  
  * **Q:** Why don't Diagnosis, Prescription, and Lab Test link directly to Patient?  
    * **A:** Linking them directly to Patient would violate 3NF/BCNF by introducing transitive dependencies. Clinical observations and treatments occur strictly within the context of a specific visit (`visit_id`). By linking them to `visit`, we preserve temporal integrity and encounter context.

---

### Slide 8: Relational Schema & Integrity Constraints
* **Slide Visual:**  
  Relational Schema Summary Table (Table, Primary Key, Foreign Keys, Cascade/Restrict, Purpose).
* **Technical Integrity Analysis:**
  * **Cascade Deletes:**
    * `diagnosis`, `prescription`, and `lab_test` specify `ON DELETE CASCADE` referencing `visit(visit_id)`. If an erroneously created visit is purged, its child clinical items are cleanly removed to prevent orphan rows.
  * **Restrict Deletes:**
    * `visit` specifies `ON DELETE RESTRICT` for `patient_id`, `doctor_id`, and `hospital_id`. A patient, doctor, or facility cannot be deleted if historical medical visits are on record, ensuring medical records cannot be expunged.
    * `consent` specifies `ON DELETE RESTRICT`. Consents can be `Revoked` via state change, but historical consent rules must be preserved for compliance.
  * **Domain CHECK Constraints:**
    * `patient.gender IN ('M', 'F', 'O')`
    * `visit.visit_type IN ('OPD', 'Emergency', 'Inpatient')`
    * `consent.status IN ('Active', 'Revoked')`
    * `consent CHECK (hospital_id IS NOT NULL OR doctor_id IS NOT NULL)`
    * `consent CHECK (end_date IS NULL OR end_date >= start_date)`
* **What to Say (Speaking Script):**  
  > "This table summarizes the 10 relational tables, their primary keys, foreign key rules, and operational purposes. We enforce strict delete policies: clinical child tables like Diagnosis, Prescription, and Lab Test cascade on Visit deletion, while core master entities like Patient, Doctor, and Hospital enforce RESTRICT delete rules to guarantee legal data retention and prevent orphaned medical history."

---

### Slide 9: Database Normalization (BCNF Analysis)
* **Slide Visual:**  
  Abstract visual representation of mathematical normalization and decomposition.
* **Technical Proof of BCNF:**
  A relation $R$ is in **Boyce-Codd Normal Form (BCNF)** if, for every non-trivial functional dependency $X \rightarrow Y$, $X$ is a superkey of $R$.
  1. **1NF:** All table columns contain atomic, indivisible values; no repeating groups (e.g. prescriptions are individual rows, not comma-separated lists).
  2. **2NF:** No partial dependencies; every non-prime attribute is fully functionally dependent on the entire primary key (all tables possess single-column primary keys: `patient_id`, `visit_id`, `doctor_id`, etc.).
  3. **3NF:** No transitive dependencies ($X \rightarrow Y$ and $Y \rightarrow Z$).
  4. **BCNF Verification:**
     * In `visit`: Primary Key is `visit_id`. Non-trivial FDs:  
       $\text{visit\_id} \rightarrow \{\text{patient\_id}, \text{hospital\_id}, \text{doctor\_id}, \text{visit\_date}, \text{visit\_type}, \text{chief\_complaint}\}$.  
       Since $\text{visit\_id}$ is the primary key (and superkey), BCNF holds.
     * In `doctor`: Primary Key is `doctor_id`.  
       $\text{doctor\_id} \rightarrow \{\text{hospital\_id}, \text{full\_name}, \text{specialization}, \text{license\_number}, \text{email}\}$.  
       $\text{license\_number} \rightarrow \{\text{doctor\_id}, \dots\}$ is an alternate superkey due to `UNIQUE` constraint. BCNF holds.
     * In `consent`: Primary Key is `consent_id`.  
       $\text{consent\_id} \rightarrow \{\text{patient\_id}, \text{hospital\_id}, \text{doctor\_id}, \text{start\_date}, \text{end\_date}, \text{status}\}$.  
       $\text{consent\_id}$ is a superkey. BCNF holds.
* **What to Say (Speaking Script):**  
  > "Our database strictly achieves Boyce-Codd Normal Form (BCNF). All functional dependencies have a candidate key or superkey on their left-hand side. There are zero partial key dependencies and zero transitive dependencies. This eliminates insertion, update, and deletion anomalies. For instance, updating a hospital's telephone number requires updating exactly one row in the Hospital table, with no risk of inconsistent data across thousands of historical visits."

---

### Slide 10: SQL Implementation & DDL Construction
* **Slide Visual:**  
  Abstract network/cloud device image representing SQL schema deployment.
* **Technical Details:**  
  * Implemented in [`database/init_migration_001.sql`](file:///d:/Projects/DBMS/arogya-link_new\arogya-link_new\arogya-link\database\init_migration_001.sql).
  * Uses PostgreSQL native data types: `VARCHAR`, `CHAR(1)`, `DATE`, `TIMESTAMP`, `SERIAL` (auto-incrementing integers), and `TEXT`.
  * Integrates explicit foreign keys, check constraints, default timestamps (`DEFAULT NOW()`), and time-zone conversion (`CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'`).
* **What to Say (Speaking Script):**  
  > "The schema is implemented in raw PostgreSQL DDL within our migration scripts. It leverages auto-incrementing serial sequences for clinical transaction counters, timestamp defaults for temporal audit trails, and strict schema constraints that reject malformed clinical inputs at the database engine level before they can corrupt the system."

---

### Slide 11: Deployment on Supabase
* **Slide Text:**  
  * PostgreSQL 17 runs on Supabase.
  * Docker Compose starts only the Next.js frontend and the FastAPI backend.
  * Sign-in is Supabase Authentication. The API maps the email to one role and sets an httpOnly session cookie.
* **Technical Details:**  
  * **Database:** Hosted Supabase project `izgtbzxrruajihrbxzyx`, region `ap-southeast-2`. The backend uses the Supabase pooler through `DATABASE_URL` in `docker-compose.yml`.
  * **Schema load order in the Supabase SQL editor:** `database/init_migration_001.sql`, `database/initial_mock_data_load_fixed.sql`, `database/seed_demo_consents.sql`, `database/rls_policies.sql`.
  * **Start command:** `docker compose up -d --build`. Frontend at `http://localhost:3000`. API at `http://localhost:8000`.
  * **Row Level Security** is installed by `database/rls_policies.sql`. The synthetic seed is the evaluation dataset already loaded in that project.
* **What to Say (Speaking Script):**  
  > "The database is PostgreSQL 17 on Supabase. Docker runs the website and the API on this laptop, and both of them connect to that hosted database. Accounts are created in Supabase Authentication. After sign-in, the API looks up the email in patient, doctor, or admin_user and issues a signed session cookie. The schema, seed data, demo consents, and row-level security policies are the four SQL files we run in the Supabase SQL editor."

---

### Slide 12: Indexing & Query Optimization
* **Slide Text:**  
  * Indexing and query optimization strategies for rapid retrieval.
* **Technical Implementation:**
  Four targeted B-Tree indexes defined in [`database/init_migration_001.sql`](file:///d:/Projects/DBMS/arogya-link_new/arogya-link_new/arogya-link/database/init_migration_001.sql#L99-L104):
  ```sql
  CREATE INDEX IF NOT EXISTS idx_visit_patient ON visit(patient_id);
  CREATE INDEX IF NOT EXISTS idx_consent_patient_status ON consent(patient_id, status);
  CREATE INDEX IF NOT EXISTS idx_lab_test_name_date ON lab_test(test_name, test_date);
  CREATE INDEX IF NOT EXISTS idx_audit_patient_time ON audit_log(patient_id, action_time DESC);
  ```
  * **`idx_visit_patient`:** Eliminates sequential scans when assembling a patient's historical medical timeline, converting an $O(N)$ table scan into an $O(\log N)$ index scan.
  * **`idx_consent_patient_status`:** Optimizes the `fn_has_consent` stored function by rapidly filtering for `'Active'` consents belonging to a patient.
  * **`idx_lab_test_name_date`:** Accelerates duplicate lab test detection by indexing test names and chronological dates.
  * **`idx_audit_patient_time`:** Accelerates descending chronological audit retrieval for the compliance log.
* **What to Say (Speaking Script):**  
  > "To ensure sub-millisecond retrieval speeds across thousands of encounters, we designed four strategic B-tree indexes. For example, `idx_visit_patient` ensures that when a doctor pulls up a patient's history, PostgreSQL executes an index scan rather than a full table scan. Similarly, our composite index on `(patient_id, status)` optimizes our consent verification function so that permission checks add virtually zero latency to API calls."

---

### Slide 13: Security & Role-Based Access Control (RBAC)
* **Slide Text:**  
  * **Patient:** Owns data. Grants or revokes consent and can see who accessed their records.
  * **Doctor:** Adds visits, diagnoses, prescriptions and lab results. Reads history only with active consent.
  * **Admin:** Registers hospitals and doctors and reviews the audit log.
* **Technical Model:**
  * **Role Segregation:** Enforced across API middleware and database stored functions.
  * **Patient Authority:** Consent is affirmative and dynamic; revoking a consent immediately flips `consent.status = 'Revoked'`, causing subsequent calls to `fn_has_consent` to return `false`.
  * **Doctor Restriction:** Doctors cannot query clinical tables directly without providing their `doctor_id`; the API queries `fn_has_consent(patient_id, doctor_id)` before releasing chart data.
  * **Break-Glass Emergency Protocol:** In life-threatening scenarios, doctors can override consent by entering a clinical justification, generating a high-visibility `EMERGENCY_OVERRIDE` record in `audit_log`.
* **What to Say (Speaking Script):**  
  > "AarogyaLink enforces strict Role-Based Access Control across three personas. Patients are the data owners who grant and revoke time-bound access. Doctors can record visits and review charts, but chart access is strictly gated by our `fn_has_consent` stored function. In life-threatening emergencies, doctors can trigger an audited 'Break-Glass' override. Administrators manage hospital registration and monitor the audit log for compliance."

---

### Slide 14: Administrator Dashboard (UI Walkthrough)
* **Slide Visual:**  
  Live screenshot of `localhost:3000/dashboard` under the Administrator role.
* **UI & Technical Highlights:**
  * **Network Totals:** 50 Hospitals, 701 Patients, 1,324 Visits, 2,891 Active Consents, 4,997 Audit Entries.
  * **Hospital Caseload Analytics:** Real-time visit volumes across facilities (e.g., SIMS Hospital: 47 visits, Continental Hospital: 47 visits, Columbia Asia: 47 visits).
  * **Synchronized Patient Roster:** Live patient roster displaying Masked IDs (`ID ••••0693`), Blood Group/Sex (`A+ • F`), visit counts, and last visit timestamps.
* **What to Say (Speaking Script):**  
  > "Here is our live Administrator Dashboard. The metric cards display our benchmark dataset: 50 participating hospitals, 701 registered patients, 1,324 clinical visits, and nearly 5,000 audit entries. On the left, administrators can monitor hospital caseloads. Selecting a hospital like SIMS Hospital immediately synchronizes the live patient roster, showing visit counts and masked privacy IDs."

---

### Slide 15: Doctor Dashboard & Clinical Workflow
* **Slide Visual:**  
  Live screenshot of `localhost:3000/dashboard` under Dr. Rohan Mehta (Cardiology, Apollo Hospitals).
* **UI & Technical Highlights:**
  * **Clinical Priority Alerts:** Highlights critical diagnostic values (e.g. `Critical BNP: 740 pg/mL` for Karthik Iyer at AIIMS, and `Critical Troponin I: 0.45 ng/mL` at Apollo Hospitals Chennai) with one-click chart opening.
  * **Operational Metrics:** 29 Patients sharing data, 2 Critical results, 3 Visits recorded, 1 Repeat-test alert.
  * **Patient Queue:** Chronologically sorted patient waiting room queue with masked IDs and last visit dates.
  * **Recent Activity Feed:** Real-time log showing recent consent grants and clinical encounter creations.
* **What to Say (Speaking Script):**  
  > "This is the Doctor Dashboard for Dr. Rohan Mehta, a cardiologist at Apollo Hospitals. The system immediately surfaces high-priority clinical alerts—such as critical elevated cardiac biomarkers like Troponin I and BNP from recent hospital visits. The dashboard also displays his patient queue and recent activity, allowing him to rapidly identify which patients have authorized consent."

---

### Slide 16: Patient Dashboard & Consent Ownership
* **Slide Visual:**  
  Live screenshot of `localhost:3000/dashboard` under Patient Mudit.
* **UI & Technical Highlights:**
  * **Personal Health Overview:** 1 Visit, 1 Hospital, 2 Active Consents, 1 Access Event.
  * **Diagnostic Summary:** Latest lab tests (ECG: Sinus tachycardia, TSH: 2.1 mIU/L).
  * **Active Medications:** Metoprolol 25 mg twice daily prescribed by Dr. Rohan Mehta.
  * **Consent Transparency Card:** Displays exactly which doctors and hospitals currently hold active access permissions (`Dr. Rohan Mehta until 22 Oct 2027`, `Apollo Hospitals until 22 Oct 2027`).
  * **Access Audit Feed:** Real-time transparency showing that Dr. Rohan Mehta performed a clinical read on 22 Oct 2026 at 06:02.
* **What to Say (Speaking Script):**  
  > "The Patient Dashboard empowers the citizen. Here, the patient can see their complete diagnostic history, active medications, and care team in one view. Crucially, the right-hand panel gives them complete transparency: it lists every doctor and hospital that holds an active consent grant, along with an audit feed showing exactly who looked at their medical chart and when."

---

### Slide 17: Cross-Hospital Duplicate Test Alert (Live UI)
* **Slide Visual:**  
  Screenshot of `/visits/new?patient=PAT-IN-105001`.
* **Technical Highlights:**
  * When Dr. Rohan Mehta enters an "ECG" lab test during visit recording, an instant alert triggers:  
    `ⓘ ECG was already run 44 days ago at Apollo Hospitals (Sinus tachycardia ). Consider reusing that result.`
  * Driven by [`frontend/src/components/VisitForm.tsx`](file:///d:/Projects/DBMS/arogya-link_new/arogya-link_new/arogya-link/frontend/src/components/VisitForm.tsx#L146-L153) evaluating the SQL View `v_duplicate_lab_tests`.
  * **Advisory Design:** The system warns the physician to save costs and avoid duplicate procedures, but does not hard-block the doctor in case a fresh test is clinically indicated.
* **What to Say (Speaking Script):**  
  > "This slide demonstrates our cross-hospital duplicate test detection in action. While a doctor is recording a new encounter, if they order a test that was already completed within the last 90 days at any network hospital—such as this ECG done 44 days ago—the system immediately warns the doctor with the prior result and hospital location. This prevents redundant medical testing without blocking the physician if a repeat test is genuinely necessary."

---

### Slide 18: Consent Check Execution & Cross-Join Verification
* **Slide Visual:**  
  * Screenshot 1: Doctor Portal `/patients` list showing "Allowed" vs "No consent" badges.
  * Screenshot 2: pgAdmin 4 executing SQL query:
  ```sql
  SELECT 
    p.full_name AS patient,
    d.full_name AS doctor,
    h.hospital_name,
    fn_has_consent(p.patient_id, d.doctor_id) AS has_consent
  FROM patient p
  CROSS JOIN doctor d
  JOIN hospital h ON h.hospital_id = d.hospital_id
  WHERE p.patient_id IN ('PAT-IN-1001', 'PAT-IN-1006')
    AND d.doctor_id IN ('DOC-01', 'DOC-03', 'DOC-05')
  ORDER BY patient, doctor;
  ```
* **Query Output Analysis:**
  * Ananya Sharma (`PAT-IN-1001`) grants consent to Fortis Healthcare (`DOC-03`, Dr. Arjun Singh &rarr; `true`) and Apollo Hospitals (`DOC-01`, Dr. Rohan Mehta &rarr; `true`), but has **no consent** for AIIMS (`DOC-05`, Dr. Vikram Sharma &rarr; `false`).
  * Devansh Gupta (`PAT-IN-1006`) has consent for Dr. Arjun Singh (`true`), but `false` for Dr. Rohan Mehta and Dr. Vikram Sharma.
* **What to Say (Speaking Script):**  
  > "Here we prove that our consent model works at the database level. In pgAdmin, we ran a cross-join between patients and doctors across three major hospital networks. You can see the boolean output of `fn_has_consent`: Ananya Sharma has active consent with Dr. Arjun Singh and Dr. Rohan Mehta, but returns `false` for Dr. Vikram Sharma at AIIMS. This directly matches the 'Allowed' and 'No consent' badges visible in the web portal."

---

### Slide 19: Database Verification — `admin_user` Table
* **Slide Visual:**  
  pgAdmin 4 query: `SELECT * FROM public.admin_user ORDER BY email ASC LIMIT 100;`
* **Schema & Output:**
  * Columns: `email` (PK), `full_name`, `created_at`.
  * Row: `admin@arogyalink.in`, `Central Administrator`, `2026-10-22 04:27:50`.
* **Technical Point:**  
  Stores privileged administrative governance accounts for hospital onboarding and audit oversight.
* **What to Say (Speaking Script):**  
  > "This slide displays the `admin_user` table in pgAdmin. It holds platform administrator accounts responsible for system-wide governance and network facility compliance."

---

### Slide 20: Database Verification — `audit_log` Table
* **Slide Visual:**  
  pgAdmin 4 query: `SELECT * FROM public.audit_log ORDER BY log_id ASC LIMIT 100;`
* **Schema & Output:**
  * Columns: `log_id` (PK, Serial), `patient_id` (FK), `doctor_id` (FK), `action`, `action_time`, `details`.
  * Rows show actions: `VISIT_CREATED`, `DATA_VIEWED`, `EMERGENCY_OVERRIDE`, `CONSENT_CHANGE`.
* **Technical Point:**  
  Append-only ledger. No `UPDATE` or `DELETE` endpoints exist in the application layer for this table.
* **What to Say (Speaking Script):**  
  > "Here is our append-only `audit_log` table. Every chart access and clinical event is automatically logged with timestamps, patient ID, doctor ID, and descriptive details. This provides legal non-repudiation and transparency."

---

### Slide 21: Database Verification — `consent` Table
* **Slide Visual:**  
  pgAdmin 4 query: `SELECT * FROM public.consent ORDER BY consent_id ASC LIMIT 100;`
* **Schema & Output:**
  * Columns: `consent_id` (PK), `patient_id` (FK), `hospital_id` (FK, Nullable), `doctor_id` (FK, Nullable), `start_date`, `end_date`, `status`.
  * Rows demonstrate both facility-level consent (`hospital_id` filled) and doctor-specific consent (`doctor_id` filled), with `Active` and `Revoked` status flags.
* **Technical Point:**  
  Enforces CHECK constraint `CHECK (hospital_id IS NOT NULL OR doctor_id IS NOT NULL)` and date sequence validation.
* **What to Say (Speaking Script):**  
  > "The `consent` table stores dynamic authorization rules. Notice that a patient can grant consent to an entire hospital facility or restrict it strictly to an individual physician, with time-bounded start and end dates."

---

### Slide 22: Database Verification — `diagnosis` Table
* **Slide Visual:**  
  pgAdmin 4 query: `SELECT * FROM public.diagnosis ORDER BY diagnosis_id ASC LIMIT 100;`
* **Schema & Output:**
  * Columns: `diagnosis_id` (PK), `visit_id` (FK CASCADE), `disease_code` (ICD-10), `description`, `diagnosed_date`.
  * Real clinical codes: `E11` (Type 2 Diabetes), `J45` (Asthma), `I63` (Stroke), `N18` (Chronic Kidney Disease), `C50` (Breast Cancer).
* **Technical Point:**  
  Child table to `visit`; cascade deletes if a visit is removed.
* **What to Say (Speaking Script):**  
  > "The `diagnosis` table stores clinical findings categorized by standard ICD-10 diagnostic codes, linked directly to the parent visit encounter."

---

### Slide 23: Database Verification — `doctor` Table
* **Slide Visual:**  
  pgAdmin 4 query: `SELECT * FROM public.doctor ORDER BY doctor_id ASC LIMIT 100;`
* **Schema & Output:**
  * Columns: `doctor_id` (PK), `hospital_id` (FK RESTRICT), `full_name`, `specialization`, `license_number` (UNIQUE), `email`, `contact_number`.
  * Specialties: Cardiology, Endocrinology, Emergency Medicine, Internal Medicine, Orthopedics, Pulmonology, Gastroenterology.
* **What to Say (Speaking Script):**  
  > "Here is the `doctor` table. Every physician is registered with a unique medical council license number, specialization, and affiliated hospital foreign key."

---

### Slide 24: Database Verification — `hospital` Table
* **Slide Visual:**  
  pgAdmin 4 query: `SELECT * FROM public.hospital ORDER BY hospital_id ASC LIMIT 100;`
* **Schema & Output:**
  * Columns: `hospital_id` (PK), `hospital_name`, `address`, `contact_number`, `registration_no` (UNIQUE).
  * Facilities: Apollo Hospitals, Fortis Healthcare, Max Super Speciality, Medanta The Medicity, AIIMS, Manipal Hospitals.
* **What to Say (Speaking Script):**  
  > "The `hospital` table catalogues all 50 accredited medical institutions on our network, complete with government registration numbers, contact information, and physical facility addresses across India."

---

### Slide 25: Database Verification — `lab_test` Table
* **Slide Visual:**  
  pgAdmin 4 query: `SELECT * FROM public.lab_test ORDER BY lab_test_id ASC LIMIT 100;`
* **Schema & Output:**
  * Columns: `lab_test_id` (PK), `visit_id` (FK CASCADE), `test_name`, `result`, `unit`, `test_date`.
  * Diagnostic tests: Ultrasound Abdomen, Urine Routine, Iron Studies, Vitamin D Total, MRI Brain, CT Scan Abdomen, Blood Glucose Fasting.
* **Technical Point:**  
  Indexed on `(test_name, test_date)` to support the 90-day duplicate detection view.
* **What to Say (Speaking Script):**  
  > "The `lab_test` table stores laboratory investigations, measured values, units, and test dates. This table is indexed to power our cross-hospital duplicate test detection engine."

---

### Slide 26: Database Verification — `patient` Table
* **Slide Visual:**  
  pgAdmin 4 query: `SELECT * FROM public.patient ORDER BY patient_id ASC LIMIT 100;`
* **Schema & Output:**
  * Columns: `patient_id` (PK), `full_name`, `date_of_birth`, `gender` (CHECK 'M','F','O'), `blood_group`, `contact_number`, `email` (UNIQUE).
* **Technical Point:**  
  Global citizen master entity. Prevents duplication by enforcing unique emails and standardized patient IDs.
* **What to Say (Speaking Script):**  
  > "The `patient` table is the citizen master registry. Each patient has a globally unique ID, demographic records, blood group, and contact details."

---

### Slide 27: Database Verification — `prescription` Table
* **Slide Visual:**  
  pgAdmin 4 query: `SELECT * FROM public.prescription ORDER BY prescription_id ASC LIMIT 100;`
* **Schema & Output:**
  * Columns: `prescription_id` (PK), `visit_id` (FK CASCADE), `medicine_name`, `dosage`, `frequency`, `duration`.
  * Medications: Ciprofloxacin (500mg, 1-1-1), Salbutamol Inhaler (100mcg, SOS), Losartan (50mg, 1-0-0), Pantoprazole (40mg, 1-0-0), Dolo 650, Atorvastatin, Metformin.
* **What to Say (Speaking Script):**  
  > "The `prescription` table contains discrete medication lines generated during a visit, recording the pharmaceutical drug name, dosage, intake frequency, and treatment duration."

---

### Slide 28: Database Verification — `visit` Table
* **Slide Visual:**  
  pgAdmin 4 query: `SELECT * FROM public.visit ORDER BY visit_id ASC LIMIT 100;`
* **Schema & Output:**
  * Columns: `visit_id` (PK), `patient_id` (FK), `hospital_id` (FK), `doctor_id` (FK), `visit_date`, `visit_type` (CHECK 'OPD','Emergency','Inpatient'), `chief_complaint`.
* **Technical Point:**  
  The central operational hub connecting Patient, Doctor, and Hospital.
* **What to Say (Speaking Script):**  
  > "Here is the central `visit` table. Every clinical consultation records the patient ID, treating doctor, hosting hospital, encounter type, and chief complaint. This table anchors all diagnosis, prescription, and lab test child records."

---

### Slide 29: Trigger Implementation — `trg_visit_audit()`
* **Slide Visual:**  
  pgAdmin 4 function editor displaying `trg_visit_audit()`.
* **SQL Code:**
  ```sql
  CREATE OR REPLACE FUNCTION trg_visit_audit() RETURNS TRIGGER
  LANGUAGE plpgsql AS $$
  BEGIN
    INSERT INTO audit_log (patient_id, doctor_id, action, details)
    VALUES (
      NEW.patient_id, 
      NEW.doctor_id, 
      'INSERT',
      format('visit_id=%s type=%s hospital=%s', NEW.visit_id, NEW.visit_type, NEW.hospital_id)
    );
    RETURN NEW;
  END;
  $$;

  CREATE TRIGGER tr_visit_audit
  AFTER INSERT ON visit
  FOR EACH ROW EXECUTE FUNCTION trg_visit_audit();
  ```
* **Technical Details:**  
  * Executes as an `AFTER INSERT` trigger on the `visit` table.
  * Guarantees audit compliance at the database kernel level: even if an external tool or script inserts a visit directly via raw SQL without going through the web app, an audit record is created atomically within the same transaction.
* **What to Say (Speaking Script):**  
  > "This slide displays our PL/pgSQL audit trigger, `trg_visit_audit()`. Whenever a new visit row is inserted into the Visit table, this trigger fires automatically, inserting an audit entry containing the patient ID, doctor ID, visit type, and hospital ID into the audit log. Because this is enforced at the database engine level, no clinical encounter can ever bypass our audit trail."
* **Viva Q&A:**  
  * **Q:** What is the advantage of using a database trigger for auditing instead of handling it in FastAPI backend code?  
    * **A:** Application-level auditing can be bypassed by direct database queries, script migrations, or API bugs. A database trigger guarantees atomicity—the audit record is written in the exact same transaction as the visit insert. If the audit log fails, the visit insert rolls back, ensuring 100% audit integrity.

---

### Slide 30: Conclusion & Future Scope
* **Slide Text:**  
  * **Conclusion:** Patient records can be shared across hospitals on an ordinary relational database. A global patient ID, patient-controlled consent and an audit log cover most of what is needed.
  * **Future Scope:** ABDM and FHIR integration, Cloud hosting, Encryption at rest, OTP-based consent, Tamper-proof audit log.
* **Technical Roadmap:**
  * **ABDM / HL7 FHIR Interoperability:** Mapping AarogyaLink BCNF relational entities to FHIR R4 JSON resources (`Patient`, `Encounter`, `Condition`, `MedicationRequest`, `Observation`).
  * **Column-Level Encryption at Rest:** Applying `pgcrypto` to encrypt sensitive clinical descriptions.
  * **Multi-Factor Mobile OTP Consent:** Real-time SMS/WhatsApp one-time password verification for out-of-network emergency chart access.
  * **Cryptographic Tamper-Evident Ledger:** Chaining audit log hashes using SHA-256 for cryptographic non-repudiation.
* **What to Say (Speaking Script):**  
  > "In conclusion, AarogyaLink demonstrates that solving multi-hospital health data fragmentation does not require complex distributed ledger technology. A well-normalized PostgreSQL relational database in BCNF, combined with global patient identifiers, dynamic stored-function consent checks, and automated trigger auditing, fulfills all clinical sharing requirements with high performance and data integrity. In the future, we plan to integrate full ABDM/FHIR standards, column-level pgcrypto encryption, and OTP-based emergency authorization. Thank you! I am now ready to answer any questions."
