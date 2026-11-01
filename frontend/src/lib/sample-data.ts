// Sample data from Digital Assignment 2 (section 5): 3 hospitals, 6 doctors,
// 6 patients, 13 visits with their diagnoses, prescriptions, lab tests,
// consents and an audit trail. Row counts match the assignment's test script.

import type {
  AuditLogEntry,
  Consent,
  Diagnosis,
  Doctor,
  Hospital,
  LabTest,
  Patient,
  Prescription,
  Visit,
} from "./types";

export const hospitals: Hospital[] = [
  {
    hospital_id: "HSP-01",
    hospital_name: "Apollo Hospitals Chennai",
    address: "21 Greams Lane, Thousand Lights, Chennai 600006",
    contact_number: "04428290200",
    registration_no: "TN-HOSP-AP-4412",
  },
  {
    hospital_id: "HSP-02",
    hospital_name: "Fortis Hospital Bengaluru",
    address: "154 Bannerghatta Road, Bengaluru 560076",
    contact_number: "08066214444",
    registration_no: "KA-HOSP-FT-2281",
  },
  {
    hospital_id: "HSP-03",
    hospital_name: "AIIMS New Delhi",
    address: "Ansari Nagar, New Delhi 110029",
    contact_number: "01126588500",
    registration_no: "DL-HOSP-AI-1001",
  },
];

export const doctors: Doctor[] = [
  { doctor_id: "DOC-01", hospital_id: "HSP-01", full_name: "Dr. Rohan Mehta", specialization: "Cardiology", license_number: "MCI-TN-88210", email: "rohan.mehta@example.in" },
  { doctor_id: "DOC-02", hospital_id: "HSP-01", full_name: "Dr. Priya Krishnan", specialization: "Endocrinology", license_number: "MCI-TN-77344", email: "priya.krishnan@example.in" },
  { doctor_id: "DOC-03", hospital_id: "HSP-02", full_name: "Dr. Arjun Singh", specialization: "Emergency Medicine", license_number: "MCI-KA-55102", email: "arjun.singh@example.in" },
  { doctor_id: "DOC-04", hospital_id: "HSP-02", full_name: "Dr. Nisha Kapoor", specialization: "Internal Medicine", license_number: "MCI-KA-60918", email: "nisha.kapoor@example.in" },
  { doctor_id: "DOC-05", hospital_id: "HSP-03", full_name: "Dr. Vikram Sharma", specialization: "Orthopedics", license_number: "MCI-DL-10455", email: "vikram.sharma@example.in" },
  { doctor_id: "DOC-06", hospital_id: "HSP-03", full_name: "Dr. Leela Menon", specialization: "Pulmonology", license_number: "MCI-DL-22190", email: "leela.menon@example.in" },
];

export const patients: Patient[] = [
  { patient_id: "PAT-IN-1001", full_name: "Ananya Sharma", date_of_birth: "1994-03-18", gender: "F", blood_group: "B+", contact_number: "9840011223", email: "ananya.sharma@example.in" },
  { patient_id: "PAT-IN-1002", full_name: "Karthik Iyer", date_of_birth: "1968-11-02", gender: "M", blood_group: "O+", contact_number: "9886012345", email: "karthik.iyer@example.in" },
  { patient_id: "PAT-IN-1003", full_name: "Fatima Rahman", date_of_birth: "1999-07-21", gender: "F", blood_group: "A+", contact_number: "9810011122", email: "fatima.rahman@example.in" },
  { patient_id: "PAT-IN-1004", full_name: "Rajesh Patel", date_of_birth: "1981-01-09", gender: "M", blood_group: "AB+", contact_number: "9725019988", email: "rajesh.patel@example.in" },
  { patient_id: "PAT-IN-1005", full_name: "Meera Nair", date_of_birth: "1955-05-30", gender: "F", blood_group: "O-", contact_number: "9447012233", email: "meera.nair@example.in" },
  { patient_id: "PAT-IN-1006", full_name: "Devansh Gupta", date_of_birth: "2007-09-14", gender: "M", blood_group: "B-", contact_number: "9876543210", email: "devansh.gupta@example.in" },
  { patient_id: "PAT-IN-105001", full_name: "Archit Singh", date_of_birth: "1998-04-12", gender: "M", blood_group: "O+", contact_number: "9876500105", email: "archit@gmail.com" },
];

const v = (
  visit_id: number,
  patient_id: string,
  hospital_id: string,
  doctor_id: string,
  visit_date: string,
  visit_type: Visit["visit_type"],
  chief_complaint: string,
): Visit => ({ visit_id, patient_id, hospital_id, doctor_id, visit_date, visit_type, chief_complaint });

export const visits: Visit[] = [
  v(1, "PAT-IN-1001", "HSP-01", "DOC-02", "2025-11-12T10:20:00", "OPD", "Fatigue and irregular cycles"),
  v(2, "PAT-IN-1001", "HSP-02", "DOC-04", "2026-07-03T16:10:00", "OPD", "Second opinion on thyroid panel"),
  v(3, "PAT-IN-1002", "HSP-01", "DOC-01", "2026-02-18T09:00:00", "OPD", "Chest tightness on exertion"),
  v(4, "PAT-IN-1002", "HSP-01", "DOC-02", "2026-08-02T11:30:00", "OPD", "Diabetes review"),
  v(5, "PAT-IN-1002", "HSP-02", "DOC-04", "2026-08-20T14:45:00", "OPD", "Travel consult, requested HbA1c"),
  v(6, "PAT-IN-1002", "HSP-03", "DOC-06", "2026-04-09T08:15:00", "Emergency", "Acute breathlessness"),
  v(7, "PAT-IN-1003", "HSP-03", "DOC-06", "2026-05-22T13:00:00", "OPD", "Persistent dry cough"),
  v(8, "PAT-IN-1004", "HSP-01", "DOC-01", "2026-03-11T10:00:00", "Inpatient", "Unstable angina"),
  v(9, "PAT-IN-1004", "HSP-02", "DOC-03", "2026-06-19T22:40:00", "Emergency", "Palpitations after travel"),
  v(10, "PAT-IN-1005", "HSP-01", "DOC-01", "2025-09-04T09:30:00", "OPD", "Hypertension follow-up"),
  v(11, "PAT-IN-1005", "HSP-03", "DOC-05", "2026-01-16T12:00:00", "OPD", "Knee pain, difficulty climbing stairs"),
  v(12, "PAT-IN-1005", "HSP-02", "DOC-04", "2026-08-28T15:20:00", "OPD", "Annual labs and medication review"),
  v(13, "PAT-IN-1006", "HSP-02", "DOC-03", "2026-08-11T19:05:00", "Emergency", "Twisted ankle during cricket"),
  v(14, "PAT-IN-105001", "HSP-01", "DOC-01", "2026-09-08T11:00:00", "OPD", "Palpitations and mild chest discomfort"),
  v(15, "PAT-IN-105001", "HSP-02", "DOC-04", "2026-10-05T14:30:00", "OPD", "Metabolic health review and chronic fatigue"),
  v(16, "PAT-IN-105001", "HSP-03", "DOC-05", "2026-10-20T09:15:00", "Emergency", "Acute right knee twisting injury during football match"),
];

const dx = (diagnosis_id: number, visit_id: number, disease_code: string, description: string): Diagnosis => ({
  diagnosis_id,
  visit_id,
  disease_code,
  description,
  diagnosed_date: visits.find((x) => x.visit_id === visit_id)!.visit_date.slice(0, 10),
});

export const diagnoses: Diagnosis[] = [
  dx(1, 1, "E03.9", "Hypothyroidism, unspecified"),
  dx(2, 2, "E03.9", "Hypothyroidism, unspecified"),
  dx(3, 3, "I25.10", "Atherosclerotic heart disease"),
  dx(4, 4, "E11.9", "Type 2 diabetes mellitus without complications"),
  dx(5, 5, "E11.9", "Type 2 diabetes mellitus without complications"),
  dx(6, 6, "J18.9", "Pneumonia, unspecified organism"),
  dx(7, 6, "I50.9", "Congestive heart failure"),
  dx(8, 7, "R05.9", "Cough, unspecified"),
  dx(9, 8, "I20.0", "Unstable angina"),
  dx(10, 9, "R00.2", "Palpitations"),
  dx(11, 10, "I10", "Essential (primary) hypertension"),
  dx(12, 11, "M17.9", "Osteoarthritis of knee, unspecified"),
  dx(13, 12, "Z00.00", "General adult medical examination"),
  dx(14, 13, "S93.40", "Sprain of ankle, unspecified"),
  dx(15, 14, "I49.9", "Cardiac arrhythmia, unspecified"),
  dx(16, 15, "E11.9", "Type 2 diabetes mellitus without complications"),
  dx(17, 16, "S83.5", "Sprain and strain of anterior cruciate ligament of knee"),
];

const rx = (
  prescription_id: number,
  visit_id: number,
  medicine_name: string,
  dosage: string,
  frequency: string,
  duration: string,
): Prescription => ({ prescription_id, visit_id, medicine_name, dosage, frequency, duration });

export const prescriptions: Prescription[] = [
  rx(1, 1, "Levothyroxine", "50 mcg", "Once daily, empty stomach", "90 days"),
  rx(2, 2, "Levothyroxine", "50 mcg", "Once daily, empty stomach", "90 days"),
  rx(3, 3, "Atorvastatin", "40 mg", "Once daily at night", "90 days"),
  rx(4, 3, "Aspirin", "75 mg", "Once daily after food", "90 days"),
  rx(5, 4, "Metformin", "500 mg", "Twice daily with meals", "90 days"),
  rx(6, 5, "Metformin", "500 mg", "Twice daily with meals", "30 days"),
  rx(7, 6, "Furosemide", "40 mg", "Once daily in the morning", "14 days"),
  rx(8, 6, "Amoxicillin-Clavulanate", "625 mg", "Three times daily", "7 days"),
  rx(9, 7, "Montelukast", "10 mg", "Once daily at night", "30 days"),
  rx(10, 8, "Clopidogrel", "75 mg", "Once daily", "180 days"),
  rx(11, 8, "Metoprolol", "25 mg", "Twice daily", "180 days"),
  rx(12, 9, "Metoprolol", "25 mg", "Twice daily", "30 days"),
  rx(13, 10, "Amlodipine", "5 mg", "Once daily", "90 days"),
  rx(14, 11, "Paracetamol", "650 mg", "As needed, max 3 per day", "10 days"),
  rx(15, 11, "Glucosamine", "1500 mg", "Once daily", "60 days"),
  rx(16, 12, "Amlodipine", "5 mg", "Once daily", "90 days"),
  rx(17, 13, "Ibuprofen", "400 mg", "Three times daily after food", "5 days"),
  rx(18, 14, "Metoprolol", "25 mg", "Twice daily", "30 days"),
  rx(19, 15, "Metformin", "500 mg", "Twice daily with meals", "60 days"),
  rx(20, 16, "Aceclofenac + Paracetamol", "100mg/325mg", "Twice daily after meals", "7 days"),
  rx(21, 16, "Pantoprazole", "40 mg", "Once daily before breakfast", "7 days"),
];

const lab = (
  lab_test_id: number,
  visit_id: number,
  test_name: string,
  result: string,
  unit: string,
): LabTest => ({
  lab_test_id,
  visit_id,
  test_name,
  result,
  unit,
  test_date: visits.find((x) => x.visit_id === visit_id)!.visit_date.slice(0, 10),
});

export const labTests: LabTest[] = [
  lab(1, 1, "TSH", "8.4", "mIU/L"),
  lab(2, 1, "Free T4", "0.7", "ng/dL"),
  lab(3, 2, "TSH", "5.2", "mIU/L"),
  lab(4, 3, "LDL Cholesterol", "162", "mg/dL"),
  lab(5, 3, "Troponin I", "0.02", "ng/mL"),
  lab(6, 4, "HbA1c", "8.1", "%"),
  lab(7, 4, "Fasting Glucose", "164", "mg/dL"),
  lab(8, 5, "HbA1c", "7.9", "%"),
  lab(9, 6, "WBC Count", "15.2", "x10^3/uL"),
  lab(10, 6, "BNP", "740", "pg/mL"),
  lab(11, 7, "Total IgE", "180", "IU/mL"),
  lab(12, 8, "Troponin I", "0.45", "ng/mL"),
  lab(13, 8, "Serum Creatinine", "1.0", "mg/dL"),
  lab(14, 9, "Serum Potassium", "4.1", "mmol/L"),
  lab(15, 10, "Serum Creatinine", "0.9", "mg/dL"),
  lab(16, 11, "Uric Acid", "5.8", "mg/dL"),
  lab(17, 12, "HbA1c", "5.6", "%"),
  lab(18, 12, "TSH", "2.4", "mIU/L"),
  lab(19, 12, "LDL Cholesterol", "118", "mg/dL"),
  lab(20, 12, "Serum Creatinine", "0.9", "mg/dL"),
  lab(21, 14, "ECG", "Sinus tachycardia", ""),
  lab(22, 14, "TSH", "2.1", "mIU/L"),
  lab(23, 15, "HbA1c", "6.5", "%"),
  lab(24, 15, "Fasting Glucose", "126", "mg/dL"),
  lab(25, 16, "Serum Uric Acid", "4.8", "mg/dL"),
  lab(26, 16, "C-Reactive Protein (CRP)", "12.4", "mg/L"),
];

const c = (
  consent_id: number,
  patient_id: string,
  hospital_id: string | null,
  doctor_id: string | null,
  start_date: string,
  end_date: string | null,
  status: Consent["status"],
): Consent => ({ consent_id, patient_id, hospital_id, doctor_id, start_date, end_date, status });

export const consents: Consent[] = [
  c(1, "PAT-IN-1001", "HSP-01", null, "2025-11-10", null, "Active"),
  c(2, "PAT-IN-1001", "HSP-02", null, "2026-07-01", null, "Active"),
  c(3, "PAT-IN-1002", "HSP-01", null, "2026-02-15", null, "Active"),
  c(4, "PAT-IN-1002", "HSP-02", null, "2026-08-18", null, "Active"),
  c(5, "PAT-IN-1002", "HSP-03", null, "2026-04-09", null, "Active"),
  c(6, "PAT-IN-1003", "HSP-03", null, "2026-05-20", null, "Active"),
  c(7, "PAT-IN-1004", "HSP-01", null, "2026-03-10", null, "Active"),
  c(8, "PAT-IN-1004", null, "DOC-03", "2026-06-19", "2026-12-31", "Active"),
  c(9, "PAT-IN-1005", "HSP-01", null, "2025-08-30", null, "Active"),
  c(10, "PAT-IN-1005", "HSP-03", null, "2026-01-14", null, "Active"),
  c(11, "PAT-IN-1005", "HSP-02", null, "2026-08-25", null, "Active"),
  c(12, "PAT-IN-1006", "HSP-02", null, "2026-08-11", null, "Active"),
  c(13, "PAT-IN-1006", "HSP-03", null, "2026-03-01", "2026-06-30", "Revoked"),
  // Active demo consents for each patient's care team doctors and hospitals
  c(14, "PAT-IN-1001", null, "DOC-01", "2025-11-10", null, "Active"),
  c(15, "PAT-IN-1001", null, "DOC-02", "2025-11-10", null, "Active"),
  c(16, "PAT-IN-1001", null, "DOC-04", "2026-07-01", null, "Active"),
  c(17, "PAT-IN-1002", null, "DOC-01", "2026-02-15", null, "Active"),
  c(18, "PAT-IN-1002", null, "DOC-02", "2026-08-02", null, "Active"),
  c(19, "PAT-IN-1002", null, "DOC-04", "2026-08-18", null, "Active"),
  c(20, "PAT-IN-1002", null, "DOC-06", "2026-04-09", null, "Active"),
  c(21, "PAT-IN-1003", null, "DOC-06", "2026-05-20", null, "Active"),
  c(22, "PAT-IN-1004", null, "DOC-01", "2026-03-10", null, "Active"),
  c(23, "PAT-IN-1004", "HSP-02", null, "2026-06-19", null, "Active"),
  c(24, "PAT-IN-1005", null, "DOC-01", "2025-08-30", null, "Active"),
  c(25, "PAT-IN-1005", null, "DOC-04", "2026-08-25", null, "Active"),
  c(26, "PAT-IN-1005", null, "DOC-05", "2026-01-14", null, "Active"),
  c(27, "PAT-IN-1006", null, "DOC-03", "2026-08-11", null, "Active"),
  c(28, "PAT-IN-105001", "HSP-01", null, "2026-07-01", null, "Active"),
  c(29, "PAT-IN-105001", "HSP-02", null, "2026-08-01", null, "Active"),
  c(30, "PAT-IN-105001", "HSP-03", null, "2026-09-01", null, "Active"),
  c(31, "PAT-IN-105001", null, "DOC-01", "2026-07-01", null, "Active"),
  c(32, "PAT-IN-105001", null, "DOC-04", "2026-08-01", null, "Active"),
  c(33, "PAT-IN-105001", null, "DOC-05", "2026-09-01", null, "Active"),
];

const log = (
  log_id: number,
  patient_id: string,
  doctor_id: string | null,
  action: string,
  action_time: string,
  details: string,
): AuditLogEntry => ({ log_id, patient_id, doctor_id, action, action_time, details });

// 1-13: visit_audit trigger (one INSERT per visit); 14+: consent changes; then access events.
export const auditLog: AuditLogEntry[] = [
  ...visits.map((x) =>
    log(
      x.visit_id,
      x.patient_id,
      x.doctor_id,
      "INSERT",
      x.visit_date,
      `visit_id=${x.visit_id} type=${x.visit_type} hospital=${x.hospital_id}`,
    ),
  ),
  ...consents.map((x, i) =>
    log(
      14 + i,
      x.patient_id,
      x.doctor_id,
      "CONSENT_CHANGE",
      `${x.start_date}T09:00:00`,
      `consent_id=${x.consent_id} status=${x.status} hospital=${x.hospital_id ?? "—"} doctor=${x.doctor_id ?? "—"}`,
    ),
  ),
  log(14 + consents.length + 1, "PAT-IN-1002", "DOC-01", "READ", "2026-08-02T11:31:00", "Opened unified chart at Apollo"),
  log(14 + consents.length + 2, "PAT-IN-1002", "DOC-04", "READ", "2026-08-20T14:46:00", "Opened unified chart at Fortis"),
  log(14 + consents.length + 3, "PAT-IN-1001", "DOC-04", "READ", "2026-07-03T16:12:00", "Second-opinion chart"),
  log(14 + consents.length + 4, "PAT-IN-1004", "DOC-03", "EMERGENCY_READ", "2026-06-19T22:41:00", "Emergency override — palpitations"),
  log(14 + consents.length + 5, "PAT-IN-1006", "DOC-05", "DENIED", "2026-08-15T10:02:00", "No active consent for AIIMS orthopedics"),
];
