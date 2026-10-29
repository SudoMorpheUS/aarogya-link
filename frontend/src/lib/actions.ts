"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearSession, requireSession, setSession } from "./session";
import * as store from "./store";
import { api, apiErrorMessage } from "./api";

export interface FormState {
  error?: string;
  ok?: string;
}

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const list = (fd: FormData, key: string) => fd.getAll(key).map((v) => String(v).trim());

// ---------- session ----------

export async function signIn(formData: FormData): Promise<void> {
  const role = text(formData, "role");
  const id = text(formData, "id");
  if (role === "admin") await setSession({ role: "admin", id: null });
  else if (role === "doctor" && store.getDoctor(id)) await setSession({ role: "doctor", id });
  else if (role === "patient" && store.getPatient(id)) await setSession({ role: "patient", id });
  else redirect("/?error=1");
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  await clearSession();
  redirect("/");
}

// ---------- consent (patient) ----------

export async function grantConsentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(["patient"]);
  const target = text(formData, "target"); // "hospital:HSP1001" or "doctor:DOC10001"
  const [kind, targetId] = target.split(":");
  const start = text(formData, "start_date") || store.today();
  const end = text(formData, "end_date") || null;
  try {
    // 1. Post to FastAPI backend -> runs sp_grant_consent in PostgreSQL and writes to audit_log
    await api.grantConsent({
      patient_id: session.id!,
      hospital_id: kind === "hospital" ? targetId : null,
      doctor_id: kind === "doctor" ? targetId : null,
      start_date: start,
      end_date: end,
    });

    // 2. Synchronize local store (non-fatal fallback)
    try {
      store.grantConsent({
        patient_id: session.id!,
        hospital_id: kind === "hospital" ? targetId : null,
        doctor_id: kind === "doctor" ? targetId : null,
        start_date: start,
        end_date: end,
      });
    } catch {}
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/", "layout");
  revalidatePath("/consents");
  revalidatePath("/audit");
  revalidatePath("/dashboard");
  return { ok: "Consent granted." };
}

export async function revokeConsentAction(formData: FormData): Promise<void> {
  const session = await requireSession(["patient"]);
  const consentId = Number(text(formData, "consent_id"));
  try {
    await api.revokeConsent(consentId);
  } catch (err) {
    console.warn("FastAPI revokeConsent error:", err);
  }
  try {
    store.revokeConsent(consentId, session.id!);
  } catch {}
  revalidatePath("/", "layout");
  revalidatePath("/consents");
  revalidatePath("/audit");
  revalidatePath("/dashboard");
}

// ---------- doctor ----------

export async function breakGlassAction(formData: FormData): Promise<void> {
  const session = await requireSession(["doctor"]);
  const patientId = text(formData, "patient_id");
  const reason = text(formData, "reason");
  try {
    await api.recordBreakGlass(patientId, session.id!, reason);
  } catch (err) {
    console.warn("FastAPI breakGlass error:", err);
  }
  try {
    store.breakGlass(patientId, session.id!, reason);
  } catch (e) {
    redirect(`/patients/${patientId}?error=${encodeURIComponent((e as Error).message)}`);
  }
  redirect(`/patients/${patientId}`);
}

export async function recordVisitAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(["doctor"]);
  const patient_id = text(formData, "patient_id");

  const codes = list(formData, "dx_code");
  const descs = list(formData, "dx_desc");
  const meds = list(formData, "rx_name");
  const doses = list(formData, "rx_dose");
  const freqs = list(formData, "rx_freq");
  const durs = list(formData, "rx_dur");
  const tests = list(formData, "lab_name");
  const results = list(formData, "lab_result");
  const units = list(formData, "lab_unit");

  const diagnoses = codes
    .map((disease_code, i) => ({ disease_code, description: descs[i] ?? "" }))
    .filter((d) => d.disease_code || d.description);
  const prescriptions = meds
    .map((medicine_name, i) => ({
      medicine_name,
      dosage: doses[i] ?? "",
      frequency: freqs[i] ?? "",
      duration: durs[i] ?? "",
    }))
    .filter((p) => p.medicine_name || p.dosage || p.frequency || p.duration);
  const labTests = tests
    .map((test_name, i) => ({ test_name, result: results[i] ?? "", unit: units[i] ?? "" }))
    .filter((l) => l.test_name || l.result);

  if (diagnoses.some((d) => !d.disease_code || !d.description))
    return { error: "Each diagnosis needs both an ICD code and a description." };
  if (prescriptions.some((p) => !p.medicine_name || !p.dosage || !p.frequency || !p.duration))
    return { error: "Each prescription needs medicine, dosage, frequency and duration." };
  if (labTests.some((l) => !l.test_name)) return { error: "Each lab result needs a test name." };

  try {
    let apiSuccess = false;
    // 1. Post to FastAPI backend -> PostgreSQL inserts and fires tr_visit_audit trigger
    try {
      await api.createVisit({
        patient_id,
        doctor_id: session.id!,
        visit_type: text(formData, "visit_type"),
        chief_complaint: text(formData, "chief_complaint"),
        diagnoses,
        prescriptions,
        lab_tests: labTests,
      });
      apiSuccess = true;
    } catch (apiErr) {
      console.warn("FastAPI createVisit error:", apiErr);
    }

    // 2. Synchronize local store (non-fatal if API succeeded)
    try {
      store.recordVisit({
        patient_id,
        doctor_id: session.id!,
        visit_type: text(formData, "visit_type"),
        chief_complaint: text(formData, "chief_complaint"),
        diagnoses,
        prescriptions,
        labTests,
      });
    } catch (storeErr) {
      if (!apiSuccess) {
        throw storeErr;
      }
    }
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/", "layout");
  redirect(`/patients/${patient_id}?saved=1`);
}

export async function registerPatientAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession(["doctor", "admin"]);
  try {
    const emailVal = text(formData, "email");
    let id: string;
    
    // Post to FastAPI backend -> inserts into the PostgreSQL patient table only.
    // No in-memory fallback: a patient that is not in the database must not appear to exist.
    const res = await api.registerPatient({
      full_name: text(formData, "full_name"),
      date_of_birth: text(formData, "date_of_birth"),
      gender: text(formData, "gender") as any,
      blood_group: text(formData, "blood_group"),
      contact_number: text(formData, "contact_number"),
      email: emailVal,
    });
    id = res.patient_id;

    // If registered by a doctor at a hospital/clinic, automatically create initial intake consent
    let initialConsentMsg = "";
    if (session.role === "doctor" && session.id) {
      try {
        let hospId = "HSP1001";
        let hospName = "your hospital";
        const doc = await api.getDoctor(session.id);
        if (doc) {
          hospId = doc.hospital_id || hospId;
          hospName = doc.hospital_name || hospName;
        }
        await api.grantConsent({
          patient_id: id,
          hospital_id: hospId,
          doctor_id: session.id,
          start_date: new Date().toISOString().split("T")[0],
        });
        initialConsentMsg = ` Initial intake consent active for ${hospName}. You can now open their chart.`;
      } catch (cErr) {
        console.warn("FastAPI grantConsent on register error:", cErr);
      }
    }

    revalidatePath("/patients");
    revalidatePath("/dashboard");
    revalidatePath("/hospitals");

    const loginDetails = emailVal
      ? ` Login email: ${emailVal} (Temporary password: ArogyaLink@2026, or patient can set a custom password via Create Account).`
      : "";
    const consentPrompt = initialConsentMsg
      ? initialConsentMsg
      : " Ask the patient to grant consent before opening their chart.";

    return { ok: `Registered ${id}.${loginDetails}${consentPrompt}` };
  } catch (e) {
    return { error: apiErrorMessage(e) };
  }
}
