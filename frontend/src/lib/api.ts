/**
 * AarogyaLink — FastAPI Backend Client
 *
 * Server-side calls forward the signed al_session cookie. Registration calls
 * that run before the cookie exists pass the Supabase access token instead.
 * In Docker the server reaches the API at http://backend:8000.
 */

import { cookies } from "next/headers";

const getBackendUrl = (): string => {
  if (process.env.BACKEND_API_URL) return process.env.BACKEND_API_URL;
  if (typeof window === "undefined") {
    // Server-side
    return process.env.NODE_ENV === "production" ? "http://backend:8000" : "http://localhost:8000";
  }
  // Client-side (if called from browser)
  return "http://localhost:8000";
};

function headerRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

function bearer(accessToken?: string): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const base = getBackendUrl();
  const url = `${base}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  const headers = headerRecord(options.headers);
  if (!headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }
  const hasAuth = Boolean(
    headers.Authorization || headers.authorization || headers["X-Aarogya-Session"] || headers["x-aarogya-session"],
  );
  if (!hasAuth) {
    try {
      const raw = (await cookies()).get("al_session")?.value;
      if (raw) headers["X-Aarogya-Session"] = raw;
    } catch {
      // Outside a request there is no cookie to forward.
    }
  }

  const res = await fetch(url, {
    ...options,
    headers,
    cache: "no-store", // Always fetch fresh data from PostgreSQL
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(`FastAPI Error (${res.status}): ${errorText}`);
  }

  return res.json() as Promise<T>;
}

/** Readable message from an error thrown by apiRequest ("FastAPI Error (409): {"detail": ...}"). */
export function apiErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const brace = raw.indexOf("{");
  if (brace >= 0) {
    try {
      const detail = JSON.parse(raw.slice(brace)).detail;
      if (typeof detail === "string") return detail;
      if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d.msg).join("; ");
    } catch {}
  }
  return raw;
}

export function apiErrorStatus(err: unknown): number {
  const m = /FastAPI Error \((\d{3})\)/.exec(err instanceof Error ? err.message : "");
  return m ? Number(m[1]) : 500;
}

// ---------------------------------------------------------------------------
// Types matching FastAPI schemas
// ---------------------------------------------------------------------------

export interface ApiHospital {
  hospital_id: string;
  hospital_name: string;
  address: string;
  contact_number: string;
  registration_no: string;
  doctor_count?: number;
  visit_count?: number;
  active_patients?: number;
}

export interface ApiHospitalCaseload extends ApiHospital {
  doctor_count: number;
  visit_count: number;
  patient_count: number;
  opd_visits: number;
  emergency_visits: number;
  inpatient_visits: number;
}

export interface ApiDoctor {
  doctor_id: string;
  hospital_id: string;
  hospital_name?: string;
  full_name: string;
  specialization: string;
  license_number: string;
  email?: string | null;
  contact_number?: string | null;
}

export interface ApiPatient {
  patient_id: string;
  full_name: string;
  date_of_birth: string;
  gender: "M" | "F" | "O";
  blood_group: string | null;
  contact_number: string;
  email: string | null;
}

export interface ApiConsent {
  consent_id: number;
  patient_id: string;
  patient_name?: string;
  hospital_id: string | null;
  hospital_name?: string | null;
  hospital_address?: string | null;
  doctor_id: string | null;
  doctor_name?: string | null;
  doctor_specialization?: string | null;
  doctor_hospital_name?: string | null;
  doctor_hospital_address?: string | null;
  resolved_hospital_name?: string | null;
  city?: string;
  state?: string;
  location?: string;
  start_date: string;
  end_date: string | null;
  status: "Active" | "Revoked";
}

export interface ApiConsentDistribution {
  patient_id: string;
  full_name: string;
  contact_number: string;
  total_consents: number;
  active_consents: number;
  consented_hospitals: string[];
  consented_doctors: string[];
  latest_expiry: string | null;
}

export interface ApiHospitalPatient {
  patient_id: string;
  full_name: string;
  gender: string;
  blood_group: string | null;
  contact_number: string;
  visit_count: number;
  last_visit: string | null;
}

export interface ApiChart {
  patient: ApiPatient;
  timeline: ApiTimelineEntry[];
  labs: {
    lab_test_id: number;
    visit_id: number;
    test_name: string;
    result: string | null;
    unit: string | null;
    test_date: string;
    hospital_name: string;
    hospital_id: string;
  }[];
  prescriptions: {
    prescription_id: number;
    visit_id: number;
    medicine_name: string;
    dosage: string;
    frequency: string;
    duration: string;
    visit_date: string;
    doctor_name: string;
    hospital_name: string;
    days_left?: number | null;
  }[];
  consents: {
    consent_id: number;
    patient_id: string;
    hospital_id: string | null;
    hospital_name: string | null;
    doctor_id: string | null;
    doctor_name: string | null;
    start_date: string;
    end_date: string | null;
    status: "Active" | "Revoked" | string;
  }[];
  access_events: number;
  access: "self" | "admin" | "consent" | "emergency";
}

export interface ApiTimelineEntry {
  visit_id: number;
  visit_date: string;
  visit_type: "OPD" | "Emergency" | "Inpatient";
  chief_complaint: string | null;
  doctor: {
    doctor_id: string;
    full_name: string;
    specialization: string;
  };
  hospital: {
    hospital_id: string;
    hospital_name: string;
    address: string;
  };
  diagnoses: {
    diagnosis_id: number;
    disease_code: string;
    description: string;
    diagnosed_date: string;
  }[];
  prescriptions: {
    prescription_id: number;
    medicine_name: string;
    dosage: string;
    frequency: string;
    duration: string;
  }[];
  lab_tests: {
    lab_test_id: number;
    test_name: string;
    result: string | null;
    unit: string | null;
    test_date: string;
  }[];
}

export interface ApiDuplicateLab {
  initial_test_id: number;
  test_name: string;
  initial_date: string;
  patient_id: string;
  patient_name: string;
  initial_hospital_id: string;
  initial_hospital_name: string;
  duplicate_test_id: number;
  duplicate_date: string;
  duplicate_hospital_id: string;
  duplicate_hospital_name: string;
  days_between: number;
}

export interface ApiAuditEntry {
  log_id: number;
  patient_id: string;
  patient_name: string;
  doctor_id: string | null;
  doctor_name: string;
  action: string;
  action_time: string;
  details: string;
}

export interface ApiStats {
  patients: number;
  hospitals: number;
  doctors: number;
  visits: number;
  activeConsents: number;
  auditEntries: number;
  duplicateCount: number;
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

export const api = {
  // Stats
  getStats: () => apiRequest<ApiStats>("/api/stats"),

  // Hospitals
  getHospitals: () => apiRequest<ApiHospital[]>("/api/hospitals"),
  getHospitalCaseload: () => apiRequest<ApiHospitalCaseload[]>("/api/hospitals/caseload"),
  getHospital: (id: string) => apiRequest<ApiHospital>(`/api/hospitals/${id}`),
  getHospitalPatients: (hospitalId: string, limit = 50) =>
    apiRequest<ApiHospitalPatient[]>(`/api/hospitals/${hospitalId}/patients?limit=${limit}`),

  // Doctors
  getDoctors: (hospitalId?: string, limit = 1000, q?: string) => {
    const params = new URLSearchParams();
    if (hospitalId) params.set("hospital_id", hospitalId);
    if (limit) params.set("limit", String(limit));
    if (q) params.set("q", q);
    const qs = params.toString();
    return apiRequest<ApiDoctor[]>(`/api/doctors${qs ? `?${qs}` : ""}`);
  },
  getDoctor: (id: string) => apiRequest<ApiDoctor>(`/api/doctors/${id}`),
  getAccessiblePatients: (doctorId: string) =>
    apiRequest<string[]>(`/api/doctors/${doctorId}/accessible-patients`),
  createDoctor: (data: Partial<ApiDoctor>, accessToken?: string) =>
    apiRequest<ApiDoctor>("/api/doctors", { method: "POST", body: JSON.stringify(data), headers: bearer(accessToken) }),
  updateDoctor: (id: string, data: Partial<ApiDoctor>) =>
    apiRequest<ApiDoctor>(`/api/doctors/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteDoctor: (id: string) =>
    apiRequest<any>(`/api/doctors/${id}`, { method: "DELETE" }),

  // Patients
  getPatients: (query = "", limit = 500) =>
    apiRequest<ApiPatient[]>(`/api/patients?q=${encodeURIComponent(query)}&limit=${limit}`),
  getPatient: (id: string) => apiRequest<ApiPatient>(`/api/patients/${id}`),
  registerPatient: (data: Partial<ApiPatient>, accessToken?: string) =>
    apiRequest<ApiPatient>("/api/patients", { method: "POST", body: JSON.stringify(data), headers: bearer(accessToken) }),
  updatePatient: (id: string, data: Partial<ApiPatient>) =>
    apiRequest<ApiPatient>(`/api/patients/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePatient: (id: string) =>
    apiRequest<any>(`/api/patients/${id}`, { method: "DELETE" }),
  getChart: (patientId: string) => apiRequest<ApiChart>(`/api/patients/${patientId}/chart`),
  getTimeline: (patientId: string) =>
    apiRequest<ApiTimelineEntry[]>(`/api/patients/${patientId}/timeline`),
  getActivePrescriptions: (patientId: string) =>
    apiRequest<any[]>(`/api/patients/${patientId}/prescriptions/active`),
  getPatientLabs: (patientId: string) =>
    apiRequest<any[]>(`/api/patients/${patientId}/labs`),

  // Visits
  createVisit: (data: any) =>
    apiRequest<any>("/api/visits", { method: "POST", body: JSON.stringify(data) }),
  deleteVisit: (id: number) =>
    apiRequest<any>(`/api/visits/${id}`, { method: "DELETE" }),
  getVisits: (patientId?: string, doctorId?: string) => {
    const params = new URLSearchParams();
    if (patientId) params.append("patient_id", patientId);
    if (doctorId) params.append("doctor_id", doctorId);
    return apiRequest<any[]>(`/api/visits?${params.toString()}`);
  },

  // Consents
  deleteConsent: (id: number) =>
    apiRequest<any>(`/api/consents/${id}`, { method: "DELETE" }),
  getConsents: (patientId?: string, doctorId?: string, hospitalId?: string, limit = 100) => {
    const params = new URLSearchParams();
    if (patientId) params.append("patient_id", patientId);
    if (doctorId) params.append("doctor_id", doctorId);
    if (hospitalId) params.append("hospital_id", hospitalId);
    params.append("limit", String(limit));
    return apiRequest<ApiConsent[]>(`/api/consents?${params.toString()}`);
  },
  getConsentDistribution: (limit = 500) =>
    apiRequest<ApiConsentDistribution[]>(`/api/consents/distribution?limit=${limit}`),
  grantConsent: (data: {
    patient_id: string;
    hospital_id?: string | null;
    doctor_id?: string | null;
    start_date?: string;
    end_date?: string | null;
  }) => apiRequest<{ consent_id: number; status: string }>("/api/consents", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  revokeConsent: (consentId: number) =>
    apiRequest<any>(`/api/consents/${consentId}/revoke`, { method: "POST" }),
  checkConsent: (patientId: string, doctorId: string) =>
    apiRequest<{ patient_id: string; doctor_id: string; has_consent: boolean }>(
      `/api/consents/check?patient_id=${patientId}&doctor_id=${doctorId}`
    ),

  // Audit & Emergency
  getAuditLogs: (patientId?: string, doctorId?: string, limit = 100) => {
    const params = new URLSearchParams();
    if (patientId) params.append("patient_id", patientId);
    if (doctorId) params.append("doctor_id", doctorId);
    params.append("limit", String(limit));
    return apiRequest<ApiAuditEntry[]>(`/api/audit?${params.toString()}`);
  },
  createAuditEntry: (data: { patient_id?: string | null; doctor_id?: string | null; action: string; details?: string }) =>
    apiRequest<any>("/api/audit", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  recordBreakGlass: (patientId: string, doctorId: string, reason: string) =>
    apiRequest<any>("/api/audit/break-glass", {
      method: "POST",
      body: JSON.stringify({ patient_id: patientId, doctor_id: doctorId, reason }),
    }),
  checkEmergencyAccess: (patientId: string, doctorId: string) =>
    apiRequest<{ patient_id: string; doctor_id: string; has_emergency_access: boolean }>(
      `/api/audit/emergency-check?patient_id=${patientId}&doctor_id=${doctorId}`
    ),

  // Duplicates
  getDuplicates: (limit = 100) =>
    apiRequest<ApiDuplicateLab[]>(`/api/duplicates?limit=${limit}`),

  // Auth & Admin
  lookupUser: (email: string, accessToken?: string) =>
    apiRequest<{ role: "patient" | "doctor" | "admin" | null; id: string | null; name: string; email: string; found?: boolean }>(
      `/api/auth/lookup?email=${encodeURIComponent(email)}`,
      { headers: bearer(accessToken) },
    ),
  registerAdmin: (email: string, name: string, accessToken?: string) =>
    apiRequest<any>("/api/auth/register-admin", {
      method: "POST",
      body: JSON.stringify({ email, name }),
      headers: bearer(accessToken),
    }),
};
