CREATE TABLE admin_user (
  email      VARCHAR(100) PRIMARY KEY,
  full_name  VARCHAR(100) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);


CREATE TABLE patient (
  patient_id     VARCHAR(20)  PRIMARY KEY,
  full_name      VARCHAR(100) NOT NULL,
  date_of_birth  DATE         NOT NULL,
  gender         CHAR(1)      NOT NULL CHECK (gender IN ('M', 'F', 'O')),
  blood_group    VARCHAR(5),
  contact_number VARCHAR(15)  NOT NULL,
  email          VARCHAR(100) UNIQUE
);


CREATE TABLE hospital (
  hospital_id     VARCHAR(15)  PRIMARY KEY,
  hospital_name   VARCHAR(150) NOT NULL,
  address         VARCHAR(255) NOT NULL,
  contact_number  VARCHAR(15)  NOT NULL,
  registration_no VARCHAR(30)  UNIQUE NOT NULL
);


CREATE TABLE doctor (
  doctor_id      VARCHAR(15)  PRIMARY KEY,
  hospital_id    VARCHAR(15)  NOT NULL REFERENCES hospital(hospital_id),
  full_name      VARCHAR(100) NOT NULL,
  specialization VARCHAR(80)  NOT NULL,
  license_number VARCHAR(30)  UNIQUE NOT NULL,
  email          VARCHAR(100),
  contact_number VARCHAR(15)
);


CREATE TABLE visit (
  visit_id        SERIAL      PRIMARY KEY,
  patient_id      VARCHAR(20) NOT NULL REFERENCES patient(patient_id),
  hospital_id     VARCHAR(15) NOT NULL REFERENCES hospital(hospital_id),
  doctor_id       VARCHAR(15) NOT NULL REFERENCES doctor(doctor_id),
  visit_date      TIMESTAMP   NOT NULL DEFAULT NOW(),
  visit_type      VARCHAR(20) NOT NULL CHECK (visit_type IN ('OPD', 'Emergency', 'Inpatient')),
  chief_complaint VARCHAR(255)
);


CREATE TABLE diagnosis (
  diagnosis_id   SERIAL       PRIMARY KEY,
  visit_id       INTEGER      NOT NULL REFERENCES visit(visit_id) ON DELETE CASCADE,
  disease_code   VARCHAR(10)  NOT NULL,
  description    VARCHAR(255) NOT NULL,
  diagnosed_date DATE         NOT NULL
);


CREATE TABLE prescription (
  prescription_id SERIAL       PRIMARY KEY,
  visit_id        INTEGER      NOT NULL REFERENCES visit(visit_id) ON DELETE CASCADE,
  medicine_name   VARCHAR(100) NOT NULL,
  dosage          VARCHAR(50)  NOT NULL,
  frequency       VARCHAR(50)  NOT NULL,
  duration        VARCHAR(50)  NOT NULL
);


CREATE TABLE lab_test (
  lab_test_id SERIAL       PRIMARY KEY,
  visit_id    INTEGER      NOT NULL REFERENCES visit(visit_id) ON DELETE CASCADE,
  test_name   VARCHAR(100) NOT NULL,
  result      VARCHAR(100),
  unit        VARCHAR(30),
  test_date   DATE         NOT NULL
);

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

CREATE TABLE audit_log (
  log_id      SERIAL      PRIMARY KEY,
  patient_id  VARCHAR(20) NOT NULL REFERENCES patient(patient_id),
  doctor_id   VARCHAR(15) REFERENCES doctor(doctor_id),
  action      VARCHAR(30) NOT NULL,
  action_time TIMESTAMP   NOT NULL DEFAULT NOW(),
  details     TEXT
);

-- Indexing and Query Optimization
CREATE INDEX IF NOT EXISTS idx_visit_patient ON visit(patient_id);
CREATE INDEX IF NOT EXISTS idx_consent_patient_status ON consent(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_lab_test_name_date ON lab_test(test_name, test_date);
CREATE INDEX IF NOT EXISTS idx_audit_patient_time ON audit_log(patient_id, action_time DESC);


-- Stored Procedures
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

-- Stored Function for Consent Check
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
      AND c.start_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
      AND (c.end_date IS NULL OR c.end_date >= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date)
      AND (c.doctor_id = p_doctor_id OR c.hospital_id = d.hospital_id)
  );
$$;

-- Audit Trigger on Visit Insert
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

DROP TRIGGER IF EXISTS tr_visit_audit ON visit;
CREATE TRIGGER tr_visit_audit
AFTER INSERT ON visit
FOR EACH ROW EXECUTE FUNCTION trg_visit_audit();

-- Cross-Hospital Duplicate Lab Test Detection View
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

-- ============================================================================
-- Row Level Security is NOT enabled by this schema script.
-- Run database/rls_policies.sql immediately afterwards (Supabase SQL Editor or
-- psql -v ON_ERROR_STOP=1 -f database/rls_policies.sql) to enable and force RLS
-- on every table. Use database/check_rls.sql to audit the result.
-- ============================================================================