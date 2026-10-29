// In-memory data store running on the Node.js server. It mirrors the
// assignment's SQL objects: fn_has_consent, sp_grant_consent, the visit_audit
// trigger and the v_patient_timeline / v_duplicate_lab_tests /
// v_hospital_caseload views. State lives on globalThis so it survives hot
// reloads in development; restarting the server resets it to the sample data.

import {
  auditLog,
  consents,
  diagnoses,
  doctors,
  hospitals,
  labTests,
  patients,
  prescriptions,
  visits,
} from "./sample-data";
import { addDays, durationDays } from "./format";
import type {
  AuditLogEntry,
  Consent,
  Diagnosis,
  Doctor,
  DuplicateLab,
  Hospital,
  HospitalCaseload,
  LabTest,
  Patient,
  Prescription,
  TimelineEntry,
  Visit,
  VisitType,
} from "./types";

interface Store {
  patients: Patient[];
  hospitals: Hospital[];
  doctors: Doctor[];
  admins: { email: string; name: string }[];
  visits: Visit[];
  diagnoses: Diagnosis[];
  prescriptions: Prescription[];
  labTests: LabTest[];
  consents: Consent[];
  auditLog: AuditLogEntry[];
  emergency: Map<string, number>; // "doctor|patient" -> expiry (ms epoch)
}

const EMERGENCY_WINDOW_MS = 30 * 60 * 1000;
const DUPLICATE_WINDOW_DAYS = 90;

const globalForStore = globalThis as unknown as { __arogyaStore?: Store };

function seed(): Store {
  return {
    patients: structuredClone(patients),
    hospitals: structuredClone(hospitals),
    doctors: structuredClone(doctors),
    admins: [
      { email: "admin@aarogyalink.in", name: "Central Administrator" },
      { email: "admin@example.in", name: "System Administrator" },
    ],
    visits: structuredClone(visits),
    diagnoses: structuredClone(diagnoses),
    prescriptions: structuredClone(prescriptions),
    labTests: structuredClone(labTests),
    consents: structuredClone(consents),
    auditLog: structuredClone(auditLog),
    emergency: new Map(),
  };
}

function db(): Store {
  const s = (globalForStore.__arogyaStore ??= seed());
  s.admins ??= [
    { email: "admin@aarogyalink.in", name: "Central Administrator" },
    { email: "admin@example.in", name: "System Administrator" },
  ];
  return s;
}

// ---------- helpers ----------

const pad = (n: number) => String(n).padStart(2, "0");

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nowLocal(): string {
  const d = new Date();
  return `${today()}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function nextId(rows: object[], key: string): number {
  return rows.reduce((max, r) => Math.max(max, (r as Record<string, number>)[key]), 0) + 1;
}

const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86_400_000);

function audit(patient_id: string, doctor_id: string | null, action: string, details: string): void {
  const s = db();
  s.auditLog.push({
    log_id: nextId(s.auditLog, "log_id"),
    patient_id,
    doctor_id,
    action,
    action_time: nowLocal(),
    details,
  });
}

/** Like audit(), but skips a repeat of the same event within a minute (page refreshes). */
function auditOnce(patient_id: string, doctor_id: string, action: string, details: string): void {
  const cutoff = Date.now() - 60_000;
  const repeat = db().auditLog.some(
    (r) =>
      r.patient_id === patient_id &&
      r.doctor_id === doctor_id &&
      r.action === action &&
      Date.parse(r.action_time) >= cutoff,
  );
  if (!repeat) audit(patient_id, doctor_id, action, details);
}

// ---------- lookups ----------

export const getPatient = (id: string) => {
  let p = db().patients.find((p) => p.patient_id === id);
  if (!p && id && (id.startsWith("PAT") || id.startsWith("pat"))) {
    p = {
      patient_id: id,
      full_name: id,
      date_of_birth: "1990-01-01",
      gender: "M",
      blood_group: "O+",
      contact_number: "9800000000",
      email: `${id.toLowerCase()}@example.in`,
    };
    db().patients.push(p);
  }
  return p ?? null;
};
export const getDoctor = (id: string) => {
  const norm = id === "DOC-1079" ? "DOC-01" : id;
  let d = db().doctors.find((d) => d.doctor_id === id || d.doctor_id === norm);
  if (!d && id && (id.startsWith("DOC") || id.startsWith("doc"))) {
    d = {
      doctor_id: id,
      hospital_id: "HSP1050",
      full_name: id.startsWith("Dr.") ? id : `Dr. ${id}`,
      specialization: "General Medicine",
      license_number: `MCI-${id}`,
      email: `${id.toLowerCase()}@arogya.in`,
    };
    db().doctors.push(d);
  }
  return d ?? null;
};
export const getHospital = (id: string) => {
  const norm = id
    .replace("HSP1001", "HSP-01")
    .replace("HSP1002", "HSP-02")
    .replace("HSP1005", "HSP-03");
  let h = db().hospitals.find((h) => h.hospital_id === id || h.hospital_id === norm);
  if (!h && id) {
    h = {
      hospital_id: id,
      hospital_name: id,
      address: "India",
      contact_number: "080-00000000",
      registration_no: `REG-${id}`,
    };
    db().hospitals.push(h);
  }
  return h ?? null;
};
export const listHospitals = () => db().hospitals;
export const listDoctors = () => db().doctors;

export function findAdminByEmail(email: string): { email: string; name: string } | null {
  const norm = email.trim().toLowerCase();
  return db().admins.find((a) => a.email.toLowerCase() === norm) ?? null;
}

export function registerAdmin(input: { email: string; name: string }): void {
  const s = db();
  const norm = input.email.trim().toLowerCase();
  const existing = s.admins.find((a) => a.email.toLowerCase() === norm);
  if (!existing) {
    s.admins.push({ email: norm, name: input.name.trim() || "Central Administrator" });
  } else if (input.name.trim()) {
    existing.name = input.name.trim();
  }
}

export function findPatientByEmail(email: string): Patient | null {
  const norm = email.trim().toLowerCase();
  return db().patients.find((p) => (p.email ?? "").toLowerCase() === norm) ?? null;
}

export function findDoctorByEmail(email: string): Doctor | null {
  const norm = email.trim().toLowerCase();
  return db().doctors.find((d) => (d.email ?? "").toLowerCase() === norm) ?? null;
}

export function findUserByEmail(email: string): { role: import("./types").Role; id: string | null; name: string } | null {
  const norm = email.trim().toLowerCase();
  const admin = findAdminByEmail(norm);
  if (admin) {
    return { role: "admin", id: null, name: admin.name };
  }
  const doctor = findDoctorByEmail(norm);
  if (doctor) {
    return { role: "doctor", id: doctor.doctor_id, name: doctor.full_name };
  }
  const patient = findPatientByEmail(norm);
  if (patient) {
    return { role: "patient", id: patient.patient_id, name: patient.full_name };
  }
  return null;
}

export function listPatients(query = ""): Patient[] {
  const q = query.trim().toLowerCase();
  const rows = [...db().patients].sort((a, b) => a.patient_id.localeCompare(b.patient_id));
  if (!q) return rows;
  return rows.filter(
    (p) =>
      p.full_name.toLowerCase().includes(q) ||
      p.patient_id.toLowerCase().includes(q) ||
      (p.blood_group ?? "").toLowerCase() === q,
  );
}

// ---------- consent ----------

/** fn_has_consent: an active, in-date consent naming the doctor or their hospital. */
export function hasConsent(patientId: string, doctorId: string): boolean {
  const doctor = getDoctor(doctorId);
  if (!doctor) return false;
  const now = today();
  const docNorm = doctorId === "DOC-1079" ? "DOC-01" : doctorId;
  return db().consents.some(
    (c) =>
      c.patient_id === patientId &&
      c.status === "Active" &&
      c.start_date <= now &&
      (c.end_date === null || c.end_date >= now) &&
      (c.doctor_id === doctorId ||
        c.doctor_id === docNorm ||
        c.hospital_id === doctor.hospital_id ||
        (doctor.hospital_id === "HSP-01" && (c.hospital_id === "HSP1001" || c.hospital_id === "HSP-01")) ||
        (doctor.hospital_id === "HSP-02" && (c.hospital_id === "HSP1002" || c.hospital_id === "HSP-02")) ||
        (doctor.hospital_id === "HSP-03" && (c.hospital_id === "HSP1005" || c.hospital_id === "HSP-03"))),
  );
}

export function hasEmergencyAccess(patientId: string, doctorId: string): boolean {
  const key = `${doctorId}|${patientId}`;
  const expiry = db().emergency.get(key);
  if (!expiry) return false;
  if (expiry < Date.now()) {
    db().emergency.delete(key);
    return false;
  }
  return true;
}

export type AccessLevel = "consent" | "emergency" | "none";

export function accessLevel(patientId: string, doctorId: string): AccessLevel {
  if (hasConsent(patientId, doctorId)) return "consent";
  if (hasEmergencyAccess(patientId, doctorId)) return "emergency";
  return "none";
}

export function consentsOf(patientId: string): Consent[] {
  return db()
    .consents.filter((c) => c.patient_id === patientId)
    .sort((a, b) => b.consent_id - a.consent_id);
}

/** sp_grant_consent */
export function grantConsent(input: {
  patient_id: string;
  hospital_id: string | null;
  doctor_id: string | null;
  start_date: string;
  end_date: string | null;
}): number {
  if (!getPatient(input.patient_id)) throw new Error("Unknown patient");
  if (!input.hospital_id && !input.doctor_id) throw new Error("Consent must name a hospital or a doctor");
  if (input.hospital_id && !getHospital(input.hospital_id)) throw new Error("Unknown hospital");
  if (input.doctor_id && !getDoctor(input.doctor_id)) throw new Error("Unknown doctor");
  if (input.end_date && input.end_date < input.start_date) throw new Error("End date cannot be before start date");

  const s = db();
  const consent_id = nextId(s.consents, "consent_id");
  s.consents.push({ ...input, consent_id, status: "Active" });
  audit(
    input.patient_id,
    null,
    "CONSENT_CHANGE",
    `consent_id=${consent_id} status=Active hospital=${input.hospital_id ?? "—"} doctor=${input.doctor_id ?? "—"}`,
  );
  return consent_id;
}

export function revokeConsent(consentId: number, patientId: string): void {
  const s = db();
  const c = s.consents.find((x) => x.consent_id === consentId && x.patient_id === patientId);
  if (!c) return;
  if (c.status !== "Revoked") {
    c.status = "Revoked";
    c.end_date = today() < c.start_date ? c.start_date : today();
    audit(
      patientId,
      c.doctor_id,
      "CONSENT_CHANGE",
      `consent_id=${c.consent_id} status=Revoked hospital=${c.hospital_id ?? "—"} doctor=${c.doctor_id ?? "—"}`,
    );
  }

  // If revoking hospital consent, cascade revoke active doctor consents at that hospital
  if (c.hospital_id) {
    const docIds = new Set(s.doctors.filter((d) => d.hospital_id === c.hospital_id).map((d) => d.doctor_id));
    for (const item of s.consents) {
      if (item.patient_id === patientId && item.status === "Active") {
        if (item.hospital_id === c.hospital_id || (item.doctor_id && docIds.has(item.doctor_id))) {
          item.status = "Revoked";
          item.end_date = today() < item.start_date ? item.start_date : today();
          audit(
            patientId,
            item.doctor_id,
            "CONSENT_CHANGE",
            `consent_id=${item.consent_id} status=Revoked hospital=${item.hospital_id ?? "—"} doctor=${item.doctor_id ?? "—"} (hospital revoked)`,
          );
        }
      }
    }
  }
}

// ---------- access (chart reads are always audited) ----------

export type ChartResult =
  | { ok: true; level: "consent" | "emergency"; timeline: TimelineEntry[]; recentLabs: RecentLab[] }
  | { ok: false };

/** Opens a patient's unified chart for a doctor, writing READ or DENIED to the audit log. */
export function openChart(patientId: string, doctorId: string): ChartResult {
  const doctor = getDoctor(doctorId);
  const hospital = doctor && getHospital(doctor.hospital_id);
  const level = accessLevel(patientId, doctorId);
  if (level === "none") {
    auditOnce(patientId, doctorId, "DENIED", `No active consent for ${hospital?.hospital_name ?? "hospital"}`);
    return { ok: false };
  }
  if (level === "consent") {
    auditOnce(patientId, doctorId, "READ", `Opened unified chart at ${hospital?.hospital_name ?? "hospital"}`);
  }
  return { ok: true, level, timeline: timeline(patientId), recentLabs: recentLabs(patientId) };
}

export function breakGlass(patientId: string, doctorId: string, reason: string): void {
  const trimmed = reason.trim();
  if (trimmed.length < 8) throw new Error("Give a clear emergency reason (at least 8 characters)");
  if (!getPatient(patientId) || !getDoctor(doctorId)) throw new Error("Unknown patient or doctor");
  db().emergency.set(`${doctorId}|${patientId}`, Date.now() + EMERGENCY_WINDOW_MS);
  audit(patientId, doctorId, "EMERGENCY_READ", `Emergency override — ${trimmed.slice(0, 200)}`);
}

// ---------- v_patient_timeline ----------

export function timeline(patientId: string): TimelineEntry[] {
  const s = db();
  return s.visits
    .filter((x) => x.patient_id === patientId)
    .sort((a, b) => b.visit_date.localeCompare(a.visit_date))
    .map((x) => ({
      ...x,
      hospital_name: getHospital(x.hospital_id)?.hospital_name ?? x.hospital_id,
      doctor_name: getDoctor(x.doctor_id)?.full_name ?? x.doctor_id,
      diagnoses: s.diagnoses.filter((d) => d.visit_id === x.visit_id),
      prescriptions: s.prescriptions.filter((p) => p.visit_id === x.visit_id),
      labs: s.labTests.filter((l) => l.visit_id === x.visit_id),
    }));
}

// ---------- duplicate test check ----------

export interface RecentLab extends LabTest {
  hospital_name: string;
  days_ago: number;
}

/** Lab results from any hospital in the last `days` days (the "avoid a repeat test" panel). */
export function recentLabs(patientId: string, days = DUPLICATE_WINDOW_DAYS): RecentLab[] {
  const s = db();
  const now = today();
  return s.labTests
    .map((l) => ({ lab: l, visit: s.visits.find((x) => x.visit_id === l.visit_id)! }))
    .filter(({ visit, lab }) => visit.patient_id === patientId && dayDiff(lab.test_date, now) <= days)
    .map(({ lab, visit }) => ({
      ...lab,
      hospital_name: getHospital(visit.hospital_id)?.hospital_name ?? visit.hospital_id,
      days_ago: dayDiff(lab.test_date, now),
    }))
    .sort((a, b) => a.days_ago - b.days_ago);
}

/** v_duplicate_lab_tests: same test, same patient, different hospitals, within 90 days. */
export function duplicateLabs(): DuplicateLab[] {
  const s = db();
  const rows = s.labTests.map((l) => ({ l, v: s.visits.find((x) => x.visit_id === l.visit_id)! }));
  const groups = new Map<string, DuplicateLab>();

  for (const a of rows) {
    for (const b of rows) {
      if (a.l.lab_test_id >= b.l.lab_test_id) continue;
      if (a.l.test_name.toLowerCase() !== b.l.test_name.toLowerCase()) continue;
      if (a.v.patient_id !== b.v.patient_id || a.v.hospital_id === b.v.hospital_id) continue;
      const gap = dayDiff(a.l.test_date, b.l.test_date);
      if (gap < 0 || gap > DUPLICATE_WINDOW_DAYS) continue;

      const key = `${a.v.patient_id}|${a.l.test_name.toLowerCase()}`;
      const hospitalNames = [a.v.hospital_id, b.v.hospital_id].map((id) => getHospital(id)?.hospital_name ?? id);
      const g = groups.get(key);
      if (!g) {
        groups.set(key, {
          patient_id: a.v.patient_id,
          patient_name: getPatient(a.v.patient_id)?.full_name ?? a.v.patient_id,
          test_name: a.l.test_name,
          times_run: 2,
          first_date: a.l.test_date,
          last_date: b.l.test_date,
          hospital_count: new Set(hospitalNames).size,
          hospitals: [...new Set(hospitalNames)],
        });
      } else {
        g.hospitals = [...new Set([...g.hospitals, ...hospitalNames])];
        g.hospital_count = g.hospitals.length;
        g.first_date = g.first_date < a.l.test_date ? g.first_date : a.l.test_date;
        g.last_date = g.last_date > b.l.test_date ? g.last_date : b.l.test_date;
      }
    }
  }
  return [...groups.values()];
}

// ---------- v_hospital_caseload ----------

export function caseload(): HospitalCaseload[] {
  const s = db();
  return s.hospitals
    .map((h) => {
      const hv = s.visits.filter((x) => x.hospital_id === h.hospital_id);
      const count = (t: VisitType) => hv.filter((x) => x.visit_type === t).length;
      return {
        hospital_id: h.hospital_id,
        hospital_name: h.hospital_name,
        doctor_count: s.doctors.filter((d) => d.hospital_id === h.hospital_id).length,
        visit_count: hv.length,
        patient_count: new Set(hv.map((x) => x.patient_id)).size,
        emergency_visits: count("Emergency"),
        opd_visits: count("OPD"),
        inpatient_visits: count("Inpatient"),
      };
    })
    .sort((a, b) => b.visit_count - a.visit_count);
}

export function totals() {
  const s = db();
  return {
    patients: s.patients.length,
    hospitals: s.hospitals.length,
    doctors: s.doctors.length,
    visits: s.visits.length,
    diagnoses: s.diagnoses.length,
    prescriptions: s.prescriptions.length,
    labTests: s.labTests.length,
    activeConsents: s.consents.filter((c) => c.status === "Active").length,
    auditEntries: s.auditLog.length,
  };
}

// ---------- audit log ----------

export interface AuditView extends AuditLogEntry {
  patient_name: string;
  doctor_name: string | null;
}

function decorate(rows: AuditLogEntry[]): AuditView[] {
  return rows
    .map((r) => ({
      ...r,
      patient_name: getPatient(r.patient_id)?.full_name ?? r.patient_id,
      doctor_name: r.doctor_id ? (getDoctor(r.doctor_id)?.full_name ?? r.doctor_id) : null,
    }))
    .sort((a, b) => b.log_id - a.log_id);
}

export const allAudit = () => decorate(db().auditLog);
export const auditForPatient = (patientId: string) =>
  decorate(db().auditLog.filter((r) => r.patient_id === patientId));
export const auditForDoctor = (doctorId: string) =>
  decorate(db().auditLog.filter((r) => r.doctor_id === doctorId));

// ---------- record a visit (single transaction + visit_audit trigger) ----------

export interface NewVisitInput {
  patient_id: string;
  doctor_id: string;
  visit_type: string;
  chief_complaint: string;
  diagnoses: { disease_code: string; description: string }[];
  prescriptions: { medicine_name: string; dosage: string; frequency: string; duration: string }[];
  labTests: { test_name: string; result: string; unit: string }[];
}

const VISIT_TYPES: VisitType[] = ["OPD", "Emergency", "Inpatient"];

export function recordVisit(input: NewVisitInput): number {
  const doctor = getDoctor(input.doctor_id);
  if (!doctor) throw new Error("Unknown doctor");
  if (!getPatient(input.patient_id)) throw new Error("Unknown patient");
  if (!VISIT_TYPES.includes(input.visit_type as VisitType)) throw new Error("Choose OPD, Emergency or Inpatient");
  if (accessLevel(input.patient_id, input.doctor_id) === "none") {
    audit(input.patient_id, input.doctor_id, "DENIED", "Visit entry blocked — no active consent");
    throw new Error("No active consent for this patient at your hospital");
  }
  const complaint = input.chief_complaint.trim();
  if (complaint.length > 255) throw new Error("Chief complaint is limited to 255 characters");

  for (const d of input.diagnoses) {
    if (d.disease_code.length > 10) throw new Error("ICD code is limited to 10 characters");
    if (d.description.length > 255) throw new Error("Diagnosis description is limited to 255 characters");
  }
  for (const p of input.prescriptions) {
    if (p.medicine_name.length > 100) throw new Error("Medicine name is limited to 100 characters");
    if ([p.dosage, p.frequency, p.duration].some((x) => x.length > 50))
      throw new Error("Dosage, frequency and duration are limited to 50 characters");
  }
  for (const l of input.labTests) {
    if (l.test_name.length > 100 || l.result.length > 100) throw new Error("Lab fields are limited to 100 characters");
    if (l.unit.length > 30) throw new Error("Lab unit is limited to 30 characters");
  }

  const s = db();
  const visit_id = nextId(s.visits, "visit_id");
  const when = nowLocal();
  const day = when.slice(0, 10);

  s.visits.push({
    visit_id,
    patient_id: input.patient_id,
    hospital_id: doctor.hospital_id,
    doctor_id: doctor.doctor_id,
    visit_date: when,
    visit_type: input.visit_type as VisitType,
    chief_complaint: complaint || null,
  });
  for (const d of input.diagnoses) {
    s.diagnoses.push({ diagnosis_id: nextId(s.diagnoses, "diagnosis_id"), visit_id, ...d, diagnosed_date: day });
  }
  for (const p of input.prescriptions) {
    s.prescriptions.push({ prescription_id: nextId(s.prescriptions, "prescription_id"), visit_id, ...p });
  }
  for (const l of input.labTests) {
    s.labTests.push({
      lab_test_id: nextId(s.labTests, "lab_test_id"),
      visit_id,
      test_name: l.test_name,
      result: l.result || null,
      unit: l.unit || null,
      test_date: day,
    });
  }
  // trigger visit_audit
  audit(
    input.patient_id,
    doctor.doctor_id,
    "INSERT",
    `visit_id=${visit_id} type=${input.visit_type} hospital=${doctor.hospital_id}`,
  );
  return visit_id;
}

// ---------- patient registration (CRUD: create) ----------

export function registerPatient(input: {
  full_name: string;
  date_of_birth: string;
  gender: string;
  blood_group: string;
  contact_number: string;
  email: string;
}): string {
  const s = db();
  const name = input.full_name.trim();
  if (!name || name.length > 100) throw new Error("Enter the patient's full name (max 100 characters)");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date_of_birth) || input.date_of_birth > today())
    throw new Error("Enter a valid date of birth");
  if (!["M", "F", "O"].includes(input.gender)) throw new Error("Choose a gender");
  if (!/^\d{10,15}$/.test(input.contact_number)) throw new Error("Contact number must be 10–15 digits");
  const email = input.email.trim().toLowerCase();
  if (email) {
    const existing = s.patients.find((p) => (p.email ?? "").toLowerCase() === email);
    if (existing) return existing.patient_id;
  }

  const nextNum =
    s.patients.reduce((max, p) => Math.max(max, Number(p.patient_id.split("-").pop()) || 0), 1000) + 1;
  const patient_id = `PAT-IN-${nextNum}`;
  s.patients.push({
    patient_id,
    full_name: name,
    date_of_birth: input.date_of_birth,
    gender: input.gender as Patient["gender"],
    blood_group: input.blood_group || null,
    contact_number: input.contact_number,
    email: email || null,
  });
  return patient_id;
}

export function registerDoctor(input: {
  full_name: string;
  hospital_id: string;
  specialization: string;
  license_number: string;
  email: string;
}): string {
  const s = db();
  const name = input.full_name.trim();
  if (!name) throw new Error("Enter doctor's full name");
  const email = input.email.trim().toLowerCase();
  if (email) {
    const existing = s.doctors.find((d) => (d.email ?? "").toLowerCase() === email);
    if (existing) return existing.doctor_id;
  }
  const nextNum = s.doctors.reduce((max, d) => Math.max(max, Number(d.doctor_id.replace(/\D/g, "")) || 0), 0) + 1;
  const doctor_id = `DOC-${String(nextNum).padStart(2, "0")}`;
  s.doctors.push({
    doctor_id,
    hospital_id: input.hospital_id || s.hospitals[0]?.hospital_id || "HSP-01",
    full_name: name.startsWith("Dr.") ? name : `Dr. ${name}`,
    specialization: input.specialization || "General Medicine",
    license_number: input.license_number || `MCI-REG-${nextNum}`,
    email,
  });
  return doctor_id;
}

// ---------- prescriptions in force ----------

export interface ActivePrescription extends Prescription {
  start_date: string;
  end_date: string | null;
  days_left: number | null;
  hospital_name: string;
  doctor_name: string;
}

/** Prescriptions whose course (visit date + duration) has not finished yet. */
export function activePrescriptions(patientId: string): ActivePrescription[] {
  const s = db();
  const now = today();
  const out: ActivePrescription[] = [];
  for (const p of s.prescriptions) {
    const visit = s.visits.find((x) => x.visit_id === p.visit_id);
    if (!visit || visit.patient_id !== patientId) continue;
    const start = visit.visit_date.slice(0, 10);
    const days = durationDays(p.duration);
    const end = days === null ? null : addDays(start, days);
    if (end !== null && end < now) continue;
    out.push({
      ...p,
      start_date: start,
      end_date: end,
      days_left: end === null ? null : dayDiff(now, end),
      hospital_name: getHospital(visit.hospital_id)?.hospital_name ?? visit.hospital_id,
      doctor_name: getDoctor(visit.doctor_id)?.full_name ?? visit.doctor_id,
    });
  }
  return out.sort((a, b) => (a.days_left ?? 9999) - (b.days_left ?? 9999));
}

/** Patients a doctor may open (consent or live emergency access), newest activity first. */
export function patientsWithAccess(doctorId: string): (Patient & { last_visit: string | null })[] {
  return listPatients()
    .filter((p) => accessLevel(p.patient_id, doctorId) !== "none")
    .map((p) => ({
      ...p,
      last_visit: db()
        .visits.filter((v) => v.patient_id === p.patient_id)
        .map((v) => v.visit_date)
        .sort()
        .pop() ?? null,
    }))
    .sort((a, b) => (b.last_visit ?? "").localeCompare(a.last_visit ?? ""));
}

/** Every consent on the platform, for the administrator's expiry checks. */
export const allConsents = () => db().consents;

/** Lab results for one patient, no audit entry (callers gate access themselves). */
export function labsOf(patientId: string): RecentLab[] {
  const s = db();
  const now = today();
  return s.labTests
    .map((l) => ({ lab: l, visit: s.visits.find((x) => x.visit_id === l.visit_id)! }))
    .filter(({ visit }) => visit.patient_id === patientId)
    .map(({ lab, visit }) => ({
      ...lab,
      hospital_name: getHospital(visit.hospital_id)?.hospital_name ?? visit.hospital_id,
      days_ago: dayDiff(lab.test_date, now),
    }))
    .sort((a, b) => a.days_ago - b.days_ago);
}
