# AarogyaLink — Demonstration Personas Guide

This guide details the pre-configured demonstration accounts available via the 1-Click Instant Login panel on the AarogyaLink landing page. Each persona showcases a distinct workflow, security permission tier, or database scenario.

**Universal Demo Password:** `AarogyaLink@123`

---

## 1. Patient Accounts

### A. Archit Singh
- **Email:** `archit@gmail.com`
- **Role:** Patient (`PAT-IN-105001`)
- **Clinical Scenario:** 
  - Longitudinal multi-hospital record bridging **Apollo Hospitals Chennai** (`HSP1001`), **Fortis Healthcare Bengaluru** (`HSP1002`), and **AIIMS New Delhi** (`HSP1005`) under a single global identifier (`PAT-IN-105001`).
  - **Apollo Hospitals (`HSP1001` • Dr. Rohan Mehta `DOC-01`):** Cardiology follow-up &rarr; Palpitations & mild chest discomfort; Cardiac arrhythmia (`I49.9`); Prescribed Metoprolol 25 mg; Lab tests: ECG (Sinus tachycardia), TSH (2.1 mIU/L).
  - **Fortis Healthcare (`HSP1002` • Dr. Nisha Kapoor `DOC-04`):** Internal Medicine consultation &rarr; Metabolic review & fatigue; Type 2 Diabetes (`E11.9`); Prescribed Metformin 500 mg; Lab tests: Fasting Glucose (126 mg/dL), HbA1c (6.5%).
  - **AIIMS New Delhi (`HSP1005` • Dr. Vikram Sharma `DOC-05`):** Orthopedic Emergency &rarr; Acute right knee twisting sports injury; ACL knee sprain (`S83.5`); Prescribed Aceclofenac + Paracetamol, Pantoprazole; Lab tests: Knee X-Ray (Soft tissue swelling), Serum Uric Acid (4.8 mg/dL).
- **What to Demonstrate:**
  - Log in as **Archit Singh** &rarr; View longitudinal unified timeline on `/dashboard` aggregating care across Apollo, Fortis, and AIIMS.
  - Navigate to `/consents` &rarr; Observe active consents granted to all three healthcare institutions and their respective treating clinicians.
  - Log out and log in as `Dr. Rohan Mehta` (Apollo), `Dr. Nisha Kapoor` (Fortis), or `Dr. Vikram Sharma` (AIIMS) &rarr; Navigate to `/patients` &rarr; Archit Singh appears with the green **Allowed** badge and his complete multi-hospital longitudinal chart can be inspected.

---

### B. Karthik Iyer
- **Email:** `karthik.iyer@example.in`
- **Role:** Patient (`PAT-IN-1002`)
- **Clinical Scenario:**
  - Multi-hospital historical data spanning Apollo Hospitals Chennai and Fortis Hospital Bengaluru.
  - Ongoing treatments: Type 2 Diabetes Mellitus, Essential Hypertension.
  - Active prescriptions: Metformin, Telmisartan.
- **What to Demonstrate:**
  - Log in as Karthik Iyer &rarr; View longitudinal unified timeline aggregating care across multiple hospital networks.
  - Demonstrates cross-hospital longitudinal health records and the duplicate diagnostic check (`v_duplicate_lab_tests`).

---

### C. Devansh Gupta
- **Email:** `devansh.gupta@example.in`
- **Role:** Patient (`PAT-IN-1006`)
- **Clinical Scenario:**
  - Has consent registered **only** for Fortis Hospital Bengaluru (`HSP1002`) and `Dr. Arjun Singh` (`DOC-03`).
  - Has **zero consent** granted to Apollo Hospitals or `Dr. Rohan Mehta`.
- **What to Demonstrate:**
  - Log in as `Dr. Rohan Mehta` (Apollo) &rarr; Go to `/patients` &rarr; Switch to **All Patients** &rarr; Devansh Gupta shows **`No consent`**.
  - Attempting to open chart triggers access blocking and records an audited `DENIED` entry.
  - **Emergency Override Demonstration:** Dr. Rohan Mehta fills out the **Emergency Access (Break-Glass)** form with a clinical justification &rarr; grants a 30-minute audited window and logs `EMERGENCY_READ` to PostgreSQL `audit_log`.

---

### D. Meera Nair
- **Email:** `meera.nair@example.in`
- **Role:** Patient (`PAT-IN-1005`)
- **Clinical Scenario:**
  - Senior patient with multiple critical lab results (Elevated HbA1c, elevated LDL Cholesterol, abnormal TSH).
- **What to Demonstrate:**
  - Log in as Meera Nair &rarr; Dashboard automatically flags out-of-range critical diagnostic results (`LabChip` critical tags).
  - Open doctor dashboard with active consent &rarr; Doctor receives urgent clinical attention notifications.

---

## 2. Doctor Accounts

### A. Dr. Rohan Mehta
- **Email:** `rohan.mehta@example.in`
- **Role:** Doctor (`DOC-01`)
- **Hospital:** Apollo Hospitals Chennai (`HSP1001`)
- **Specialization:** Cardiology
- **What to Demonstrate:**
  - Default view on `/patients` filters strictly to **`Allowed Consent`** patients (Archit Singh, Karthik Iyer, Meera Nair).
  - Opening patient charts (`/patients/[id]`) automatically writes tamper-evident `READ` audit logs.
  - Clinical visit recording form (`/visits/new?patient=...`) allows recording diagnoses, prescriptions, and lab tests, triggering database trigger `tr_visit_audit`.

---

### B. Dr. Nisha Kapoor
- **Email:** `nisha.kapoor@example.in`
- **Role:** Doctor (`DOC-04`)
- **Hospital:** Fortis Healthcare Bengaluru (`HSP1002`)
- **Specialization:** Internal Medicine
- **What to Demonstrate:**
  - Access control segregation: Can access Fortis-consented patients (like Devansh Gupta), demonstrating network-isolated permissions.

---

### C. Dr. Vikram Sharma
- **Email:** `vikram.sharma@example.in`
- **Role:** Doctor (`DOC-05`)
- **Hospital:** AIIMS New Delhi (`HSP1005`)
- **Specialization:** Orthopedics
- **What to Demonstrate:**
  - Demonstrates public health / apex institute access within the cross-network exchange.

---

## 3. Administrator Account

### Central Admin
- **Email:** `admin@arogyalink.in`
- **Role:** System Administrator
- **What to Demonstrate:**
  - `/hospitals` &rarr; Hospital Caseload Analytics aggregating volume, department breakdown, and doctor headcounts via database view `v_hospital_caseload`.
  - `/duplicates` &rarr; Cross-Hospital Duplicate Lab Test Detection via multi-table self-join view `v_duplicate_lab_tests`.
  - `/audit` &rarr; Complete compliance audit trail with categorized tabs (`Reads`, `Denied`, `Emergency`, `Consent`, `Visits`), showcasing the SHA-256 cryptographic hash chain (`prev_hash` and `entry_hash`) and append-only database immutability.
  - `/patients` &rarr; National Patient Registry with consent distribution breakdown across hospitals.
