-- ============================================================================
-- AarogyaLink — Demo Consents & Care Team Synchronization Script
-- ============================================================================
-- 1. Cleans up any orphaned test patients
-- 2. Inserts canonical demo Doctors (DOC-01 to DOC-06) matching Apollo, Fortis, AIIMS
-- 3. Inserts canonical demo Patients (PAT-IN-1001 to PAT-IN-1006)
-- 4. Inserts demo visits, diagnoses, prescriptions, and lab tests for demo patients
-- 5. Grants Active consents to EVERY patient's care team's doctors and hospitals
-- 6. Generates CONSENT_CHANGE audit log entries for all active consents
-- ============================================================================

BEGIN;

-- 1. Clean up test patient with duplicate email if present
DELETE FROM consent WHERE patient_id = 'PAT-IN-105002';
DELETE FROM audit_log WHERE patient_id = 'PAT-IN-105002';
DELETE FROM visit WHERE patient_id = 'PAT-IN-105002';
DELETE FROM patient WHERE patient_id = 'PAT-IN-105002';

-- 2. Insert or update demo Doctors
INSERT INTO doctor (doctor_id, hospital_id, full_name, specialization, license_number, email)
VALUES
  ('DOC-01', 'HSP1001', 'Dr. Rohan Mehta', 'Cardiology', 'MCI-TN-88210', 'rohan.mehta@example.in'),
  ('DOC-02', 'HSP1001', 'Dr. Priya Krishnan', 'Endocrinology', 'MCI-TN-77344', 'priya.krishnan@example.in'),
  ('DOC-03', 'HSP1002', 'Dr. Arjun Singh', 'Emergency Medicine', 'MCI-KA-55102', 'arjun.singh@example.in'),
  ('DOC-04', 'HSP1002', 'Dr. Nisha Kapoor', 'Internal Medicine', 'MCI-KA-60918', 'nisha.kapoor@example.in'),
  ('DOC-05', 'HSP1005', 'Dr. Vikram Sharma', 'Orthopedics', 'MCI-DL-10455', 'vikram.sharma@example.in'),
  ('DOC-06', 'HSP1005', 'Dr. Leela Menon', 'Pulmonology', 'MCI-DL-22190', 'leela.menon@example.in')
ON CONFLICT (doctor_id) DO UPDATE SET
  hospital_id = EXCLUDED.hospital_id,
  full_name = EXCLUDED.full_name,
  specialization = EXCLUDED.specialization,
  license_number = EXCLUDED.license_number,
  email = EXCLUDED.email;

-- 3. Insert or update demo Patients
INSERT INTO patient (patient_id, full_name, date_of_birth, gender, blood_group, contact_number, email)
VALUES
  ('PAT-IN-1001', 'Ananya Sharma', '1994-03-18', 'F', 'B+', '9840011223', 'ananya.sharma@example.in'),
  ('PAT-IN-1002', 'Karthik Iyer', '1968-11-02', 'M', 'O+', '9886012345', 'karthik.iyer@example.in'),
  ('PAT-IN-1003', 'Fatima Rahman', '1999-07-21', 'F', 'A+', '9810011122', 'fatima.rahman@example.in'),
  ('PAT-IN-1004', 'Rajesh Patel', '1981-01-09', 'M', 'AB+', '9725019988', 'rajesh.patel@example.in'),
  ('PAT-IN-1005', 'Meera Nair', '1955-05-30', 'F', 'O-', '9447012233', 'meera.nair@example.in'),
  ('PAT-IN-1006', 'Devansh Gupta', '2007-09-14', 'M', 'B-', '9876543210', 'devansh.gupta@example.in'),
  ('PAT-IN-105001', 'Archit Singh', '1998-04-12', 'M', 'O+', '9876500105', 'archit@gmail.com')
ON CONFLICT (patient_id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  date_of_birth = EXCLUDED.date_of_birth,
  gender = EXCLUDED.gender,
  blood_group = EXCLUDED.blood_group,
  contact_number = EXCLUDED.contact_number,
  email = EXCLUDED.email;

-- 4. Insert demo Visits for demo patients if not already present
-- Use a temporary table or CTE to avoid duplicate visits
DO $$
DECLARE
  v_rec RECORD;
  new_vid INT;
BEGIN
  -- Ananya Sharma (PAT-IN-1001) Visit 1
  IF NOT EXISTS (SELECT 1 FROM visit WHERE patient_id = 'PAT-IN-1001' AND doctor_id = 'DOC-02') THEN
    INSERT INTO visit (patient_id, hospital_id, doctor_id, visit_date, visit_type, chief_complaint)
    VALUES ('PAT-IN-1001', 'HSP1001', 'DOC-02', '2025-11-12 10:20:00', 'OPD', 'Fatigue and irregular cycles')
    RETURNING visit_id INTO new_vid;

    INSERT INTO diagnosis (visit_id, disease_code, description, diagnosed_date)
    VALUES (new_vid, 'E03.9', 'Hypothyroidism, unspecified', '2025-11-12');

    INSERT INTO prescription (visit_id, medicine_name, dosage, frequency, duration)
    VALUES (new_vid, 'Levothyroxine', '50 mcg', 'Once daily, empty stomach', '90 days');

    INSERT INTO lab_test (visit_id, test_name, result, unit, test_date)
    VALUES (new_vid, 'TSH', '8.4', 'mIU/L', '2025-11-12'),
           (new_vid, 'Free T4', '0.7', 'ng/dL', '2025-11-12');
  END IF;

  -- Ananya Sharma (PAT-IN-1001) Visit 2
  IF NOT EXISTS (SELECT 1 FROM visit WHERE patient_id = 'PAT-IN-1001' AND doctor_id = 'DOC-04') THEN
    INSERT INTO visit (patient_id, hospital_id, doctor_id, visit_date, visit_type, chief_complaint)
    VALUES ('PAT-IN-1001', 'HSP1002', 'DOC-04', '2026-07-03 16:10:00', 'OPD', 'Second opinion on thyroid panel')
    RETURNING visit_id INTO new_vid;

    INSERT INTO diagnosis (visit_id, disease_code, description, diagnosed_date)
    VALUES (new_vid, 'E03.9', 'Hypothyroidism, unspecified', '2026-07-03');

    INSERT INTO prescription (visit_id, medicine_name, dosage, frequency, duration)
    VALUES (new_vid, 'Levothyroxine', '50 mcg', 'Once daily, empty stomach', '90 days');

    INSERT INTO lab_test (visit_id, test_name, result, unit, test_date)
    VALUES (new_vid, 'TSH', '5.2', 'mIU/L', '2026-07-03');
  END IF;

  -- Archit Singh (PAT-IN-105001) Visit 1: cardiology follow-up with Dr. Rohan Mehta at Apollo Hospitals Chennai
  IF NOT EXISTS (SELECT 1 FROM visit WHERE patient_id = 'PAT-IN-105001' AND doctor_id = 'DOC-01') THEN
    INSERT INTO visit (patient_id, hospital_id, doctor_id, visit_date, visit_type, chief_complaint)
    VALUES ('PAT-IN-105001', 'HSP1001', 'DOC-01', '2026-09-08 11:00:00', 'OPD', 'Palpitations and mild chest discomfort')
    RETURNING visit_id INTO new_vid;

    INSERT INTO diagnosis (visit_id, disease_code, description, diagnosed_date)
    VALUES (new_vid, 'I49.9', 'Cardiac arrhythmia, unspecified', '2026-09-08');

    INSERT INTO prescription (visit_id, medicine_name, dosage, frequency, duration)
    VALUES (new_vid, 'Metoprolol', '25 mg', 'Twice daily', '30 days');

    INSERT INTO lab_test (visit_id, test_name, result, unit, test_date)
    VALUES (new_vid, 'ECG', 'Sinus tachycardia', NULL, '2026-09-08'),
           (new_vid, 'TSH', '2.1', 'mIU/L', '2026-09-08');
  END IF;

  -- Archit Singh (PAT-IN-105001) Visit 2: internal medicine review with Dr. Nisha Kapoor at Fortis Healthcare Bengaluru
  IF NOT EXISTS (SELECT 1 FROM visit WHERE patient_id = 'PAT-IN-105001' AND doctor_id = 'DOC-04') THEN
    INSERT INTO visit (patient_id, hospital_id, doctor_id, visit_date, visit_type, chief_complaint)
    VALUES ('PAT-IN-105001', 'HSP1002', 'DOC-04', '2026-10-05 14:30:00', 'OPD', 'Metabolic health review and chronic fatigue')
    RETURNING visit_id INTO new_vid;

    INSERT INTO diagnosis (visit_id, disease_code, description, diagnosed_date)
    VALUES (new_vid, 'E11.9', 'Type 2 diabetes mellitus without complications', '2026-10-05');

    INSERT INTO prescription (visit_id, medicine_name, dosage, frequency, duration)
    VALUES (new_vid, 'Metformin', '500 mg', 'Twice daily with meals', '60 days');

    INSERT INTO lab_test (visit_id, test_name, result, unit, test_date)
    VALUES (new_vid, 'HbA1c', '6.5', '%', '2026-10-05'),
           (new_vid, 'Fasting Glucose', '126', 'mg/dL', '2026-10-05');
  END IF;

  -- Archit Singh (PAT-IN-105001) Visit 3: orthopedic trauma emergency with Dr. Vikram Sharma at AIIMS New Delhi
  IF NOT EXISTS (SELECT 1 FROM visit WHERE patient_id = 'PAT-IN-105001' AND doctor_id = 'DOC-05') THEN
    INSERT INTO visit (patient_id, hospital_id, doctor_id, visit_date, visit_type, chief_complaint)
    VALUES ('PAT-IN-105001', 'HSP1005', 'DOC-05', '2026-10-20 09:15:00', 'Emergency', 'Acute right knee twisting injury during football match')
    RETURNING visit_id INTO new_vid;

    INSERT INTO diagnosis (visit_id, disease_code, description, diagnosed_date)
    VALUES (new_vid, 'S83.5', 'Sprain and strain of anterior cruciate ligament of knee', '2026-10-20');

    INSERT INTO prescription (visit_id, medicine_name, dosage, frequency, duration)
    VALUES (new_vid, 'Aceclofenac + Paracetamol', '100mg/325mg', 'Twice daily after meals', '7 days'),
           (new_vid, 'Pantoprazole', '40 mg', 'Once daily before breakfast', '7 days');

    INSERT INTO lab_test (visit_id, test_name, result, unit, test_date)
    VALUES (new_vid, 'Knee X-Ray', 'Soft tissue swelling, no fracture', NULL, '2026-10-20'),
           (new_vid, 'Serum Uric Acid', '4.8', 'mg/dL', '2026-10-20');
  END IF;

  -- Karthik Iyer (PAT-IN-1002) Visit 3
  IF NOT EXISTS (SELECT 1 FROM visit WHERE patient_id = 'PAT-IN-1002' AND doctor_id = 'DOC-01') THEN
    INSERT INTO visit (patient_id, hospital_id, doctor_id, visit_date, visit_type, chief_complaint)
    VALUES ('PAT-IN-1002', 'HSP1001', 'DOC-01', '2026-02-18 09:00:00', 'OPD', 'Chest tightness on exertion')
    RETURNING visit_id INTO new_vid;

    INSERT INTO diagnosis (visit_id, disease_code, description, diagnosed_date)
    VALUES (new_vid, 'I25.10', 'Atherosclerotic heart disease', '2026-02-18');

    INSERT INTO prescription (visit_id, medicine_name, dosage, frequency, duration)
    VALUES (new_vid, 'Atorvastatin', '40 mg', 'Once daily at night', '90 days'),
           (new_vid, 'Aspirin', '75 mg', 'Once daily after food', '90 days');

    INSERT INTO lab_test (visit_id, test_name, result, unit, test_date)
    VALUES (new_vid, 'LDL Cholesterol', '162', 'mg/dL', '2026-02-18'),
           (new_vid, 'Troponin I', '0.02', 'ng/mL', '2026-02-18');
  END IF;

  -- Karthik Iyer (PAT-IN-1002) Visit 4
  IF NOT EXISTS (SELECT 1 FROM visit WHERE patient_id = 'PAT-IN-1002' AND doctor_id = 'DOC-02') THEN
    INSERT INTO visit (patient_id, hospital_id, doctor_id, visit_date, visit_type, chief_complaint)
    VALUES ('PAT-IN-1002', 'HSP1001', 'DOC-02', '2026-08-02 11:30:00', 'OPD', 'Diabetes review')
    RETURNING visit_id INTO new_vid;

    INSERT INTO diagnosis (visit_id, disease_code, description, diagnosed_date)
    VALUES (new_vid, 'E11.9', 'Type 2 diabetes mellitus without complications', '2026-08-02');

    INSERT INTO prescription (visit_id, medicine_name, dosage, frequency, duration)
    VALUES (new_vid, 'Metformin', '500 mg', 'Twice daily with meals', '90 days');

    INSERT INTO lab_test (visit_id, test_name, result, unit, test_date)
    VALUES (new_vid, 'HbA1c', '8.1', '%', '2026-08-02'),
           (new_vid, 'Fasting Glucose', '164', 'mg/dL', '2026-08-02');
  END IF;

  -- Karthik Iyer (PAT-IN-1002) Visit 5
  IF NOT EXISTS (SELECT 1 FROM visit WHERE patient_id = 'PAT-IN-1002' AND doctor_id = 'DOC-04') THEN
    INSERT INTO visit (patient_id, hospital_id, doctor_id, visit_date, visit_type, chief_complaint)
    VALUES ('PAT-IN-1002', 'HSP1002', 'DOC-04', '2026-08-20 14:45:00', 'OPD', 'Travel consult, requested HbA1c')
    RETURNING visit_id INTO new_vid;

    INSERT INTO diagnosis (visit_id, disease_code, description, diagnosed_date)
    VALUES (new_vid, 'E11.9', 'Type 2 diabetes mellitus without complications', '2026-08-20');

    INSERT INTO prescription (visit_id, medicine_name, dosage, frequency, duration)
    VALUES (new_vid, 'Metformin', '500 mg', 'Twice daily with meals', '30 days');

    INSERT INTO lab_test (visit_id, test_name, result, unit, test_date)
    VALUES (new_vid, 'HbA1c', '7.9', '%', '2026-08-20');
  END IF;

  -- Karthik Iyer (PAT-IN-1002) Visit 6
  IF NOT EXISTS (SELECT 1 FROM visit WHERE patient_id = 'PAT-IN-1002' AND doctor_id = 'DOC-06') THEN
    INSERT INTO visit (patient_id, hospital_id, doctor_id, visit_date, visit_type, chief_complaint)
    VALUES ('PAT-IN-1002', 'HSP1005', 'DOC-06', '2026-04-09 08:15:00', 'Emergency', 'Acute breathlessness')
    RETURNING visit_id INTO new_vid;

    INSERT INTO diagnosis (visit_id, disease_code, description, diagnosed_date)
    VALUES (new_vid, 'J18.9', 'Pneumonia, unspecified organism', '2026-04-09'),
           (new_vid, 'I50.9', 'Congestive heart failure', '2026-04-09');

    INSERT INTO prescription (visit_id, medicine_name, dosage, frequency, duration)
    VALUES (new_vid, 'Furosemide', '40 mg', 'Once daily in the morning', '14 days'),
           (new_vid, 'Amoxicillin-Clavulanate', '625 mg', 'Three times daily', '7 days');

    INSERT INTO lab_test (visit_id, test_name, result, unit, test_date)
    VALUES (new_vid, 'WBC Count', '15.2', 'x10^3/uL', '2026-04-09'),
           (new_vid, 'BNP', '740', 'pg/mL', '2026-04-09');
  END IF;

  -- Fatima Rahman (PAT-IN-1003) Visit 7
  IF NOT EXISTS (SELECT 1 FROM visit WHERE patient_id = 'PAT-IN-1003' AND doctor_id = 'DOC-06') THEN
    INSERT INTO visit (patient_id, hospital_id, doctor_id, visit_date, visit_type, chief_complaint)
    VALUES ('PAT-IN-1003', 'HSP1005', 'DOC-06', '2026-05-22 13:00:00', 'OPD', 'Persistent dry cough')
    RETURNING visit_id INTO new_vid;

    INSERT INTO diagnosis (visit_id, disease_code, description, diagnosed_date)
    VALUES (new_vid, 'R05.9', 'Cough, unspecified', '2026-05-22');

    INSERT INTO prescription (visit_id, medicine_name, dosage, frequency, duration)
    VALUES (new_vid, 'Montelukast', '10 mg', 'Once daily at night', '30 days');

    INSERT INTO lab_test (visit_id, test_name, result, unit, test_date)
    VALUES (new_vid, 'Total IgE', '180', 'IU/mL', '2026-05-22');
  END IF;

  -- Rajesh Patel (PAT-IN-1004) Visits 8 & 9
  IF NOT EXISTS (SELECT 1 FROM visit WHERE patient_id = 'PAT-IN-1004' AND doctor_id = 'DOC-01') THEN
    INSERT INTO visit (patient_id, hospital_id, doctor_id, visit_date, visit_type, chief_complaint)
    VALUES ('PAT-IN-1004', 'HSP1001', 'DOC-01', '2026-03-11 10:00:00', 'Inpatient', 'Unstable angina')
    RETURNING visit_id INTO new_vid;

    INSERT INTO diagnosis (visit_id, disease_code, description, diagnosed_date)
    VALUES (new_vid, 'I20.0', 'Unstable angina', '2026-03-11');

    INSERT INTO prescription (visit_id, medicine_name, dosage, frequency, duration)
    VALUES (new_vid, 'Clopidogrel', '75 mg', 'Once daily', '180 days'),
           (new_vid, 'Metoprolol', '25 mg', 'Twice daily', '180 days');

    INSERT INTO lab_test (visit_id, test_name, result, unit, test_date)
    VALUES (new_vid, 'Troponin I', '0.45', 'ng/mL', '2026-03-11'),
           (new_vid, 'Serum Creatinine', '1.0', 'mg/dL', '2026-03-11');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM visit WHERE patient_id = 'PAT-IN-1004' AND doctor_id = 'DOC-03') THEN
    INSERT INTO visit (patient_id, hospital_id, doctor_id, visit_date, visit_type, chief_complaint)
    VALUES ('PAT-IN-1004', 'HSP1002', 'DOC-03', '2026-06-19 22:40:00', 'Emergency', 'Palpitations after travel')
    RETURNING visit_id INTO new_vid;

    INSERT INTO diagnosis (visit_id, disease_code, description, diagnosed_date)
    VALUES (new_vid, 'R00.2', 'Palpitations', '2026-06-19');

    INSERT INTO prescription (visit_id, medicine_name, dosage, frequency, duration)
    VALUES (new_vid, 'Metoprolol', '25 mg', 'Twice daily', '30 days');

    INSERT INTO lab_test (visit_id, test_name, result, unit, test_date)
    VALUES (new_vid, 'Serum Potassium', '4.1', 'mmol/L', '2026-06-19');
  END IF;

  -- Meera Nair (PAT-IN-1005) Visits 10, 11, 12
  IF NOT EXISTS (SELECT 1 FROM visit WHERE patient_id = 'PAT-IN-1005' AND doctor_id = 'DOC-01') THEN
    INSERT INTO visit (patient_id, hospital_id, doctor_id, visit_date, visit_type, chief_complaint)
    VALUES ('PAT-IN-1005', 'HSP1001', 'DOC-01', '2025-09-04 09:30:00', 'OPD', 'Hypertension follow-up')
    RETURNING visit_id INTO new_vid;

    INSERT INTO diagnosis (visit_id, disease_code, description, diagnosed_date)
    VALUES (new_vid, 'I10', 'Essential (primary) hypertension', '2025-09-04');

    INSERT INTO prescription (visit_id, medicine_name, dosage, frequency, duration)
    VALUES (new_vid, 'Amlodipine', '5 mg', 'Once daily', '90 days');

    INSERT INTO lab_test (visit_id, test_name, result, unit, test_date)
    VALUES (new_vid, 'Serum Creatinine', '0.9', 'mg/dL', '2025-09-04');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM visit WHERE patient_id = 'PAT-IN-1005' AND doctor_id = 'DOC-05') THEN
    INSERT INTO visit (patient_id, hospital_id, doctor_id, visit_date, visit_type, chief_complaint)
    VALUES ('PAT-IN-1005', 'HSP1005', 'DOC-05', '2026-01-16 12:00:00', 'OPD', 'Knee pain, difficulty climbing stairs')
    RETURNING visit_id INTO new_vid;

    INSERT INTO diagnosis (visit_id, disease_code, description, diagnosed_date)
    VALUES (new_vid, 'M17.9', 'Osteoarthritis of knee, unspecified', '2026-01-16');

    INSERT INTO prescription (visit_id, medicine_name, dosage, frequency, duration)
    VALUES (new_vid, 'Paracetamol', '650 mg', 'As needed, max 3 per day', '10 days'),
           (new_vid, 'Glucosamine', '1500 mg', 'Once daily', '60 days');

    INSERT INTO lab_test (visit_id, test_name, result, unit, test_date)
    VALUES (new_vid, 'Uric Acid', '5.8', 'mg/dL', '2026-01-16');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM visit WHERE patient_id = 'PAT-IN-1005' AND doctor_id = 'DOC-04') THEN
    INSERT INTO visit (patient_id, hospital_id, doctor_id, visit_date, visit_type, chief_complaint)
    VALUES ('PAT-IN-1005', 'HSP1002', 'DOC-04', '2026-08-28 15:20:00', 'OPD', 'Annual labs and medication review')
    RETURNING visit_id INTO new_vid;

    INSERT INTO diagnosis (visit_id, disease_code, description, diagnosed_date)
    VALUES (new_vid, 'Z00.00', 'General adult medical examination', '2026-08-28');

    INSERT INTO prescription (visit_id, medicine_name, dosage, frequency, duration)
    VALUES (new_vid, 'Amlodipine', '5 mg', 'Once daily', '90 days');

    INSERT INTO lab_test (visit_id, test_name, result, unit, test_date)
    VALUES (new_vid, 'HbA1c', '5.6', '%', '2026-08-28'),
           (new_vid, 'TSH', '2.4', 'mIU/L', '2026-08-28'),
           (new_vid, 'LDL Cholesterol', '118', 'mg/dL', '2026-08-28'),
           (new_vid, 'Serum Creatinine', '0.9', 'mg/dL', '2026-08-28');
  END IF;

  -- Devansh Gupta (PAT-IN-1006) Visit 13
  IF NOT EXISTS (SELECT 1 FROM visit WHERE patient_id = 'PAT-IN-1006' AND doctor_id = 'DOC-03') THEN
    INSERT INTO visit (patient_id, hospital_id, doctor_id, visit_date, visit_type, chief_complaint)
    VALUES ('PAT-IN-1006', 'HSP1002', 'DOC-03', '2026-08-11 19:05:00', 'Emergency', 'Twisted ankle during cricket')
    RETURNING visit_id INTO new_vid;

    INSERT INTO diagnosis (visit_id, disease_code, description, diagnosed_date)
    VALUES (new_vid, 'S93.40', 'Sprain of ankle, unspecified', '2026-08-11');

    INSERT INTO prescription (visit_id, medicine_name, dosage, frequency, duration)
    VALUES (new_vid, 'Ibuprofen', '400 mg', 'Three times daily after food', '5 days');
  END IF;
END $$;

-- 5. GRANT ACTIVE DEMO CONSENTS TO EACH PATIENT'S CARE TEAM'S HOSPITALS
-- For EVERY patient in visit: insert active consent for their visited hospital(s)
INSERT INTO consent (patient_id, hospital_id, doctor_id, start_date, end_date, status)
SELECT DISTINCT 
    v.patient_id, 
    v.hospital_id, 
    NULL, 
    CURRENT_DATE - INTERVAL '60 days', 
    CURRENT_DATE + INTERVAL '365 days', 
    'Active'
FROM visit v
WHERE NOT EXISTS (
    SELECT 1 FROM consent c 
    WHERE c.patient_id = v.patient_id 
      AND c.hospital_id = v.hospital_id 
      AND c.status = 'Active'
);

-- 6. GRANT ACTIVE DEMO CONSENTS TO EACH PATIENT'S CARE TEAM'S DOCTORS
-- For EVERY patient in visit: insert active consent for their visited doctor(s)
INSERT INTO consent (patient_id, hospital_id, doctor_id, start_date, end_date, status)
SELECT DISTINCT 
    v.patient_id, 
    NULL, 
    v.doctor_id, 
    CURRENT_DATE - INTERVAL '60 days', 
    CURRENT_DATE + INTERVAL '365 days', 
    'Active'
FROM visit v
WHERE NOT EXISTS (
    SELECT 1 FROM consent c 
    WHERE c.patient_id = v.patient_id 
      AND c.doctor_id = v.doctor_id 
      AND c.status = 'Active'
);

-- 7. WRITE AUDIT LOG ENTRIES FOR ALL ACTIVE CONSENTS
INSERT INTO audit_log (patient_id, doctor_id, action, action_time, details)
SELECT 
    c.patient_id, 
    c.doctor_id, 
    'CONSENT_CHANGE', 
    NOW() - INTERVAL '30 days',
    'consent_id=' || c.consent_id || ' status=Active hospital=' || COALESCE(c.hospital_id, '—') || ' doctor=' || COALESCE(c.doctor_id, '—')
FROM consent c
WHERE c.status = 'Active'
  AND NOT EXISTS (
      SELECT 1 FROM audit_log a
      WHERE a.patient_id = c.patient_id
        AND a.action = 'CONSENT_CHANGE'
        AND a.details LIKE 'consent_id=' || c.consent_id || ' %'
  );

-- 8. SYNCHRONIZE ALL SERIAL SEQUENCES
SELECT setval('visit_visit_id_seq', (SELECT COALESCE(MAX(visit_id), 1) + 1 FROM visit));
SELECT setval('diagnosis_diagnosis_id_seq', (SELECT COALESCE(MAX(diagnosis_id), 1) + 1 FROM diagnosis));
SELECT setval('prescription_prescription_id_seq', (SELECT COALESCE(MAX(prescription_id), 1) + 1 FROM prescription));
SELECT setval('lab_test_lab_test_id_seq', (SELECT COALESCE(MAX(lab_test_id), 1) + 1 FROM lab_test));
SELECT setval('consent_consent_id_seq', (SELECT COALESCE(MAX(consent_id), 1) + 1 FROM consent));
SELECT setval('audit_log_log_id_seq', (SELECT COALESCE(MAX(log_id), 1) + 1 FROM audit_log));

COMMIT;

