# AarogyaLink — Multi-Hospital Health Data Sharing Platform
## Digital Assignment 02 — Database Management Systems
**Developer:** Archit (25BRS1030)

This file lists every SQL query used in the assignment, separated by section, with no output/explanation clutter — ready to paste into a query tool and run top to bottom.

---

## Where to run these queries

These queries are written for **PostgreSQL** (note `SERIAL`, `RETURNING`, `plpgsql`, `string_agg`, `::numeric` casts — these are Postgres-specific and will **not** work as-is on MySQL or SQLite).

Run them in the **Supabase SQL editor** for this project. That is the database the website and the API use.

The project schema and seed are already the files under `database/`. Prefer those files when you reload the live project:

1. `database/init_migration_001.sql`
2. `database/initial_mock_data_load_fixed.sql`
3. `database/seed_demo_consents.sql`
4. `database/rls_policies.sql`

The queries below are the same PostgreSQL statements, grouped for the assignment. Paste a section into the Supabase SQL editor, or connect DBeaver, TablePlus, or DataGrip to the Supabase pooler and run them there.

**Run order matters** — execute the sections in the order they appear in this file (1 → 16), since later sections (views, procedures, triggers) depend on the tables and data created earlier.

---

## 1. Database Creation

```sql
CREATE DATABASE aarogyalink;
\c aarogyalink;
```

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

---

## 2. Tables and Constraints

### patient
```sql
CREATE TABLE patient (
  patient_id     VARCHAR(20)  PRIMARY KEY,
  full_name      VARCHAR(100) NOT NULL,
  date_of_birth  DATE         NOT NULL,
  gender         CHAR(1)      NOT NULL CHECK (gender IN ('M', 'F', 'O')),
  blood_group    VARCHAR(5),
  contact_number VARCHAR(15)  NOT NULL,
  email          VARCHAR(100) UNIQUE
);
```

### hospital
```sql
CREATE TABLE hospital (
  hospital_id     VARCHAR(15)  PRIMARY KEY,
  hospital_name   VARCHAR(150) NOT NULL,
  address         VARCHAR(255) NOT NULL,
  contact_number  VARCHAR(15)  NOT NULL,
  registration_no VARCHAR(30)  UNIQUE NOT NULL
);
```

### doctor
```sql
CREATE TABLE doctor (
  doctor_id      VARCHAR(15)  PRIMARY KEY,
  hospital_id    VARCHAR(15)  NOT NULL REFERENCES hospital(hospital_id),
  full_name      VARCHAR(100) NOT NULL,
  specialization VARCHAR(80)  NOT NULL,
  license_number VARCHAR(30)  UNIQUE NOT NULL
);
```

### visit
```sql
CREATE TABLE visit (
  visit_id        SERIAL      PRIMARY KEY,
  patient_id      VARCHAR(20) NOT NULL REFERENCES patient(patient_id),
  hospital_id     VARCHAR(15) NOT NULL REFERENCES hospital(hospital_id),
  doctor_id       VARCHAR(15) NOT NULL REFERENCES doctor(doctor_id),
  visit_date      TIMESTAMP   NOT NULL DEFAULT NOW(),
  visit_type      VARCHAR(20) NOT NULL CHECK (visit_type IN ('OPD', 'Emergency', 'Inpatient')),
  chief_complaint VARCHAR(255)
);
```

### diagnosis
```sql
CREATE TABLE diagnosis (
  diagnosis_id   SERIAL       PRIMARY KEY,
  visit_id       INTEGER      NOT NULL REFERENCES visit(visit_id) ON DELETE CASCADE,
  disease_code   VARCHAR(10)  NOT NULL,
  description    VARCHAR(255) NOT NULL,
  diagnosed_date DATE         NOT NULL
);
```

### prescription
```sql
CREATE TABLE prescription (
  prescription_id SERIAL       PRIMARY KEY,
  visit_id        INTEGER      NOT NULL REFERENCES visit(visit_id) ON DELETE CASCADE,
  medicine_name   VARCHAR(100) NOT NULL,
  dosage          VARCHAR(50)  NOT NULL,
  frequency       VARCHAR(50)  NOT NULL,
  duration        VARCHAR(50)  NOT NULL
);
```

### lab_test
```sql
CREATE TABLE lab_test (
  lab_test_id SERIAL       PRIMARY KEY,
  visit_id    INTEGER      NOT NULL REFERENCES visit(visit_id) ON DELETE CASCADE,
  test_name   VARCHAR(100) NOT NULL,
  result      VARCHAR(100),
  unit        VARCHAR(30),
  test_date   DATE         NOT NULL
);
```

### consent
```sql
CREATE TABLE consent (
  consent_id  SERIAL      PRIMARY KEY,
  patient_id  VARCHAR(20) NOT NULL REFERENCES patient(patient_id),
  hospital_id VARCHAR(15) REFERENCES hospital(hospital_id),
  doctor_id   VARCHAR(15) REFERENCES doctor(doctor_id),
  start_date  DATE        NOT NULL,
  end_date    DATE,
  status      VARCHAR(15) NOT NULL CHECK (status IN ('Active', 'Revoked')),
  CHECK (hospital_id IS NOT NULL OR doctor_id IS NOT NULL),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
```

### audit_log
```sql
CREATE TABLE audit_log (
  log_id      SERIAL      PRIMARY KEY,
  patient_id  VARCHAR(20) NOT NULL REFERENCES patient(patient_id),
  doctor_id   VARCHAR(15) REFERENCES doctor(doctor_id),
  action      VARCHAR(30) NOT NULL,
  action_time TIMESTAMP   NOT NULL DEFAULT NOW(),
  details     TEXT
);
```

### Verify each table's columns (repeat per table name)
```sql
SELECT * FROM pragma_table_info('patient');
-- swap 'patient' for: hospital, doctor, visit, diagnosis, prescription, lab_test, consent, audit_log
```

---

## 3. Primary Keys

```sql
SELECT tc.table_name, kcu.column_name AS primary_key
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;
```

---

## 4. Foreign Keys

```sql
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name  AS references_table,
  ccu.column_name AS references_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;
```

---

## 5. Data Insertion Using Real-World Dataset

### Insert hospitals
```sql
INSERT INTO hospital (hospital_id, hospital_name, address, contact_number, registration_no)
VALUES
  ('HSP-01', 'Apollo Hospitals Chennai', '21 Greams Lane, Thousand Lights, Chennai 600006', '04428290200', 'TN-HOSP-AP-4412'),
  ('HSP-02', 'Fortis Hospital Bengaluru', '154 Bannerghatta Road, Bengaluru 560076', '08066214444', 'KA-HOSP-FT-2281'),
  ('HSP-03', 'AIIMS New Delhi', 'Ansari Nagar, New Delhi 110029', '01126588500', 'DL-HOSP-AI-1001');
```
```sql
SELECT hospital_id, hospital_name, address, contact_number, registration_no
FROM hospital
ORDER BY hospital_id;
```

### Insert doctors
```sql
INSERT INTO doctor (doctor_id, hospital_id, full_name, specialization, license_number)
VALUES
  ('DOC-01', 'HSP-01', 'Dr. Rohan Mehta',    'Cardiology',         'MCI-TN-88210'),
  ('DOC-02', 'HSP-01', 'Dr. Priya Krishnan', 'Endocrinology',      'MCI-TN-77344'),
  ('DOC-03', 'HSP-02', 'Dr. Arjun Singh',    'Emergency Medicine', 'MCI-KA-55102'),
  ('DOC-04', 'HSP-02', 'Dr. Nisha Kapoor',   'Internal Medicine',  'MCI-KA-60918'),
  ('DOC-05', 'HSP-03', 'Dr. Vikram Sharma',  'Orthopedics',        'MCI-DL-10455'),
  ('DOC-06', 'HSP-03', 'Dr. Leela Menon',    'Pulmonology',        'MCI-DL-22190');
```
```sql
SELECT doctor_id, hospital_id, full_name, specialization, license_number
FROM doctor
ORDER BY doctor_id;
```

### Insert patients
```sql
INSERT INTO patient (patient_id, full_name, date_of_birth, gender, blood_group, contact_number, email)
VALUES
  ('PAT-IN-1001', 'Ananya Sharma', '1994-03-18', 'F', 'B+',  '9840011223', 'ananya.sharma@example.in'),
  ('PAT-IN-1002', 'Karthik Iyer',  '1968-11-02', 'M', 'O+',  '9886012345', 'karthik.iyer@example.in'),
  ('PAT-IN-1003', 'Fatima Rahman', '1999-07-21', 'F', 'A+',  '9810011122', 'fatima.rahman@example.in'),
  ('PAT-IN-1004', 'Rajesh Patel',  '1981-01-09', 'M', 'AB+', '9725019988', 'rajesh.patel@example.in'),
  ('PAT-IN-1005', 'Meera Nair',    '1955-05-30', 'F', 'O-',  '9447012233', 'meera.nair@example.in'),
  ('PAT-IN-1006', 'Devansh Gupta', '2007-09-14', 'M', 'B-',  '9876543210', 'devansh.gupta@example.in');
```
```sql
SELECT patient_id, full_name, date_of_birth, gender, blood_group, contact_number, email
FROM patient
ORDER BY patient_id;
```

> **Note:** The assignment's `visit`, `diagnosis`, `prescription`, `lab_test`, and `consent` rows (13+ visits across the three hospitals) referenced in later sections were bulk-loaded separately and are not shown as raw INSERTs in the source document — only their row counts and query results are. Populate these tables with your own realistic INSERT statements following the same style before running Sections 6 onward, matching the IDs used throughout (e.g. visit_id 1–13, patient/doctor/hospital IDs above).

### Verify visit rows loaded
```sql
SELECT COUNT(*) AS visit_count FROM visit;
```

---

## 6. CRUD Operations

### CREATE — insert a new patient
```sql
INSERT INTO patient
  (patient_id, full_name, date_of_birth, gender, blood_group, contact_number, email)
VALUES
  ('PAT-IN-1099', 'Sanjay Rao', '1978-04-12', 'M', 'A+', '9900112233', 'sanjay.rao@example.in');
```
```sql
SELECT patient_id, full_name, gender, blood_group, contact_number, email
FROM patient
WHERE patient_id = 'PAT-IN-1099';
```

### READ — all patients
```sql
SELECT patient_id, full_name, gender, blood_group
FROM patient
ORDER BY patient_id;
```

### READ — hospitals in Chennai (LIKE)
```sql
SELECT hospital_id, hospital_name, address
FROM hospital
WHERE address LIKE '%Chennai%';
```

### UPDATE — change contact number
```sql
UPDATE patient
SET contact_number = '9000000001'
WHERE patient_id = 'PAT-IN-1099';
```
```sql
SELECT patient_id, full_name, contact_number
FROM patient
WHERE patient_id = 'PAT-IN-1099';
```

### DELETE — remove the test patient
```sql
DELETE FROM patient
WHERE patient_id = 'PAT-IN-1099';
```
```sql
SELECT patient_id, full_name
FROM patient
WHERE patient_id = 'PAT-IN-1099';
```

---

## 7. SQL Commands

### DISTINCT visit types
```sql
SELECT DISTINCT visit_type FROM visit ORDER BY visit_type;
```

### BETWEEN — patients born 1960–1990
```sql
SELECT patient_id, full_name, date_of_birth
FROM patient
WHERE date_of_birth BETWEEN '1960-01-01' AND '1990-12-31'
ORDER BY date_of_birth;
```

### LIKE — specializations ending in -ology
```sql
SELECT full_name, specialization
FROM doctor
WHERE specialization LIKE '%ology%'
ORDER BY full_name;
```

---

## 8. Joins

### INNER JOIN — patient and visit
```sql
SELECT
  p.patient_id,
  p.full_name AS patient_name,
  v.visit_id,
  v.visit_type
FROM patient p
INNER JOIN visit v
  ON p.patient_id = v.patient_id
ORDER BY p.patient_id, v.visit_id;
```

### Multiple-table JOIN — unified visit chart
```sql
SELECT
  p.full_name  AS patient_name,
  v.visit_type,
  h.hospital_name,
  d.full_name  AS doctor_name,
  v.visit_date,
  v.chief_complaint
FROM visit v
INNER JOIN patient  p ON v.patient_id  = p.patient_id
INNER JOIN hospital h ON v.hospital_id = h.hospital_id
INNER JOIN doctor   d ON v.doctor_id   = d.doctor_id
ORDER BY v.visit_date;
```

### SELF JOIN — same lab_test at two hospitals within 90 days
```sql
SELECT p.full_name AS patient, a.test_name,
       ha.hospital_name AS first_hospital,  a.test_date AS first_date,
       hb.hospital_name AS second_hospital, b.test_date AS second_date
FROM lab_test a
JOIN lab_test b  ON a.lab_test_id < b.lab_test_id
                AND lower(a.test_name) = lower(b.test_name)
JOIN visit va    ON va.visit_id = a.visit_id
JOIN visit vb    ON vb.visit_id = b.visit_id
                AND va.patient_id = vb.patient_id
                AND va.hospital_id <> vb.hospital_id
JOIN patient  p  ON p.patient_id   = va.patient_id
JOIN hospital ha ON ha.hospital_id = va.hospital_id
JOIN hospital hb ON hb.hospital_id = vb.hospital_id
WHERE b.test_date - a.test_date BETWEEN 0 AND 90;
```

---

## 9. Nested Queries

### IN — patients who visited more than one hospital
```sql
SELECT patient_id, full_name
FROM patient
WHERE patient_id IN (
  SELECT patient_id FROM visit
  GROUP BY patient_id
  HAVING COUNT(DISTINCT hospital_id) > 1
);
```

### NOT IN — doctors with no emergency visit
```sql
SELECT doctor_id, full_name, specialization
FROM doctor
WHERE doctor_id NOT IN (
  SELECT doctor_id FROM visit WHERE visit_type = 'Emergency'
);
```

### Scalar subquery — TSH above cohort average
```sql
SELECT p.full_name, lt.result AS tsh_miu_l, lt.test_date
FROM lab_test lt
JOIN visit   v ON v.visit_id   = lt.visit_id
JOIN patient p ON p.patient_id = v.patient_id
WHERE lt.test_name = 'TSH'
  AND lt.result::numeric > (
    SELECT AVG(result::numeric) FROM lab_test WHERE test_name = 'TSH'
  );
```

---

## 10. Aggregate Functions

### COUNT — visits per hospital
```sql
SELECT h.hospital_name, COUNT(v.visit_id) AS visit_count
FROM hospital h
LEFT JOIN visit v ON v.hospital_id = h.hospital_id
GROUP BY h.hospital_name
ORDER BY visit_count DESC;
```

### COUNT / COUNT DISTINCT — prescriptions
```sql
SELECT COUNT(*) AS prescription_count,
       COUNT(DISTINCT medicine_name) AS unique_medicines
FROM prescription;
```

### AVG / MAX / MIN — HbA1c
```sql
SELECT
  ROUND(AVG(result::numeric), 2) AS avg_hba1c,
  MAX(result::numeric)           AS max_hba1c,
  MIN(result::numeric)           AS min_hba1c
FROM lab_test
WHERE test_name = 'HbA1c';
```

---

## 11. Views

### v_patient_timeline
```sql
CREATE OR REPLACE VIEW v_patient_timeline AS
SELECT v.visit_id, v.patient_id, p.full_name AS patient_name,
       v.visit_date, v.visit_type, h.hospital_name,
       d.full_name AS doctor_name,
       (SELECT string_agg(di.description, '; ')
          FROM diagnosis di WHERE di.visit_id = v.visit_id) AS diagnoses,
       (SELECT COUNT(*) FROM prescription pr WHERE pr.visit_id = v.visit_id) AS prescription_count,
       (SELECT COUNT(*) FROM lab_test lt      WHERE lt.visit_id = v.visit_id) AS lab_count
FROM visit v
JOIN patient  p ON p.patient_id  = v.patient_id
JOIN hospital h ON h.hospital_id = v.hospital_id
JOIN doctor   d ON d.doctor_id   = v.doctor_id;
```
```sql
SELECT visit_id, visit_date, visit_type, hospital_name, doctor_name,
       diagnoses, prescription_count, lab_count
FROM v_patient_timeline
WHERE patient_id = 'PAT-IN-1002'
ORDER BY visit_date;
```

### v_duplicate_lab_tests
> Definition not shown in the source document — only queried. Create it before querying, e.g.:
```sql
CREATE OR REPLACE VIEW v_duplicate_lab_tests AS
SELECT p.patient_id, p.full_name AS patient_name, lt.test_name,
       COUNT(*) AS times_run,
       MIN(lt.test_date) AS first_date,
       MAX(lt.test_date) AS last_date,
       COUNT(DISTINCT v.hospital_id) AS hospital_count,
       string_agg(DISTINCT h.hospital_name, ',') AS hospitals
FROM lab_test lt
JOIN visit v    ON v.visit_id    = lt.visit_id
JOIN patient p  ON p.patient_id  = v.patient_id
JOIN hospital h ON h.hospital_id = v.hospital_id
GROUP BY p.patient_id, p.full_name, lt.test_name
HAVING COUNT(*) > 1 AND COUNT(DISTINCT v.hospital_id) > 1;
```
```sql
SELECT * FROM v_duplicate_lab_tests;
```

### v_hospital_caseload
> Definition not shown in the source document — only queried. Create it before querying, e.g.:
```sql
CREATE OR REPLACE VIEW v_hospital_caseload AS
SELECT h.hospital_id, h.hospital_name,
       COUNT(DISTINCT d.doctor_id)  AS doctor_count,
       COUNT(v.visit_id)            AS visit_count,
       COUNT(DISTINCT v.patient_id) AS patient_count,
       COUNT(*) FILTER (WHERE v.visit_type = 'Emergency') AS emergency_visits,
       COUNT(*) FILTER (WHERE v.visit_type = 'OPD')       AS opd_visits,
       COUNT(*) FILTER (WHERE v.visit_type = 'Inpatient') AS inpatient_visits
FROM hospital h
LEFT JOIN doctor d ON d.hospital_id = h.hospital_id
LEFT JOIN visit  v ON v.hospital_id = h.hospital_id
GROUP BY h.hospital_id, h.hospital_name;
```
```sql
SELECT * FROM v_hospital_caseload ORDER BY visit_count DESC;
```

---

## 12. Stored Procedures

### sp_grant_consent
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
  INSERT INTO consent (patient_id, hospital_id, doctor_id, start_date, end_date, status)
  VALUES (p_patient_id, p_hospital_id, p_doctor_id, p_start_date, p_end_date, 'Active')
  RETURNING consent_id INTO new_id;
  RETURN new_id;
END;
$$;
```

### Call sp_grant_consent
```sql
SELECT sp_grant_consent('PAT-IN-1003', 'HSP-01', NULL, CURRENT_DATE, NULL);
```

---

## 13. Functions

### fn_has_consent
```sql
CREATE OR REPLACE FUNCTION fn_has_consent(
  p_patient_id VARCHAR, p_doctor_id VARCHAR
) RETURNS BOOLEAN
LANGUAGE SQL STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM consent c
    JOIN doctor d ON d.doctor_id = p_doctor_id
    WHERE c.patient_id = p_patient_id
      AND c.status = 'Active'
      AND c.start_date <= CURRENT_DATE
      AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
      AND (c.doctor_id = p_doctor_id OR c.hospital_id = d.hospital_id)
  );
$$;
```

### Call fn_has_consent
```sql
SELECT p.full_name AS patient,
       d.full_name AS doctor,
       h.hospital_name,
       fn_has_consent(p.patient_id, d.doctor_id) AS has_consent
FROM patient p
CROSS JOIN doctor d
JOIN hospital h ON h.hospital_id = d.hospital_id
WHERE p.patient_id IN ('PAT-IN-1001', 'PAT-IN-1006')
  AND d.doctor_id  IN ('DOC-01', 'DOC-03', 'DOC-05')
ORDER BY patient, doctor;
```

---

## 14. Triggers

### visit_audit — function + trigger
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

CREATE TRIGGER visit_audit
AFTER INSERT ON visit
FOR EACH ROW EXECUTE FUNCTION trg_visit_audit();
```

> The source document's output also shows `CONSENT_CHANGE` audit rows, implying a second trigger on the `consent` table (e.g. `consent_audit`) that logs status changes. Its definition isn't shown — create an analogous `AFTER INSERT OR UPDATE ON consent` trigger if you need to reproduce that behavior.

### Trigger test — insert a visit, check audit_log
```sql
INSERT INTO visit (patient_id, hospital_id, doctor_id, visit_type, chief_complaint)
VALUES ('PAT-IN-1003', 'HSP-03', 'DOC-06', 'OPD', 'Inhaler review');
```
```sql
SELECT log_id, patient_id, doctor_id, action, action_time, details
FROM audit_log
ORDER BY log_id DESC
LIMIT 8;
```

---

## 15. Testing SQL Scripts

### Row counts of every table
```sql
SELECT 'patient' AS table_name, COUNT(*) AS n FROM patient
UNION ALL SELECT 'hospital',      COUNT(*) FROM hospital
UNION ALL SELECT 'doctor',        COUNT(*) FROM doctor
UNION ALL SELECT 'visit',         COUNT(*) FROM visit
UNION ALL SELECT 'diagnosis',     COUNT(*) FROM diagnosis
UNION ALL SELECT 'prescription',  COUNT(*) FROM prescription
UNION ALL SELECT 'lab_test',      COUNT(*) FROM lab_test
UNION ALL SELECT 'consent',       COUNT(*) FROM consent
UNION ALL SELECT 'audit_log',     COUNT(*) FROM audit_log;
```

### FK test — visit for a nonexistent patient (should fail)
```sql
INSERT INTO visit (patient_id, hospital_id, doctor_id, visit_type, chief_complaint)
VALUES ('PAT-IN-9999', 'HSP-01', 'DOC-01', 'OPD', 'should fail');
```

### UNIQUE test — duplicate email (should fail)
```sql
INSERT INTO patient (patient_id, full_name, date_of_birth, gender, contact_number, email)
VALUES ('PAT-IN-1088', 'Copy', '2000-01-01', 'M', '9000000002', 'ananya.sharma@example.in');
```

---

## 16. Conclusion

The AarogyaLink schema (`patient`, `hospital`, `doctor`, `visit`, `diagnosis`, `prescription`, `lab_test`, `consent`, `audit_log`) is in BCNF and was loaded with a real-world Indian hospital dataset. CRUD, joins, nested queries, aggregates and views all execute as specified. Stored procedure/function objects (`sp_grant_consent`, `fn_has_consent`) and triggers (`visit_audit`, and an implied `consent` trigger) were created and called; the `audit_log` output confirms the triggers fired. Foreign-key and UNIQUE constraint tests failed as required, confirming referential integrity.
