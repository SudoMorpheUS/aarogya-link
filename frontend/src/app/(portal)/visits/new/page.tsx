import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { VisitForm } from "@/components/VisitForm";
import { requireSession } from "@/lib/session";
import { api, apiErrorStatus } from "@/lib/api";
import * as store from "@/lib/store";

export const metadata: Metadata = { title: "Record visit" };

export default async function NewVisitPage({ searchParams }: { searchParams: Promise<{ patient?: string }> }) {
  const session = await requireSession(["doctor"]);
  const { patient: patientId } = await searchParams;
  let patient: any = null;
  if (patientId) {
    try {
      const p = await api.getPatient(patientId);
      if (p) {
        patient = {
          patient_id: p.patient_id,
          full_name: p.full_name,
          date_of_birth: p.date_of_birth,
          gender: p.gender as any,
          blood_group: p.blood_group as any,
          contact_number: p.contact_number,
          email: p.email,
        };
      }
    } catch (err) {
      if (apiErrorStatus(err) !== 401 && apiErrorStatus(err) !== 403) {
        patient = store.getPatient(patientId);
      }
    }
  }
  if (!patient) notFound();

  let hasConsent = false;
  try {
    const res = await api.checkConsent(patient.patient_id, session.id!);
    hasConsent = Boolean(res?.has_consent);
  } catch {
    hasConsent = store.accessLevel(patient.patient_id, session.id!) !== "none";
  }

  let hasEmergency = false;
  try {
    const emRes = await api.checkEmergencyAccess(patient.patient_id, session.id!);
    hasEmergency = Boolean(emRes?.has_emergency_access);
  } catch {
    hasEmergency = store.hasEmergencyAccess(patient.patient_id, session.id!);
  }

  if (!hasConsent && !hasEmergency) {
    redirect(`/patients/${patient.patient_id}`);
  }

  let doctor: any = null;
  let hospitalName = "";
  if (session.id) {
    try {
      doctor = await api.getDoctor(session.id);
      hospitalName = doctor?.hospital_name || "";
    } catch {
      doctor = store.getDoctor(session.id);
    }
  }
  if (!doctor) {
    doctor = {
      doctor_id: session.id!,
      hospital_id: "HSP1001",
      full_name: session.displayName || session.id!,
      specialization: "General Medicine",
      license_number: "MCI-GEN-00000",
      email: session.email || "",
    };
  }
  if (!hospitalName) {
    hospitalName = store.getHospital(doctor.hospital_id)?.hospital_name || "General Hospital";
  }

  let recent: any[] = store.recentLabs(patient.patient_id).map((l) => ({
    test_name: l.test_name,
    result: l.result,
    unit: l.unit,
    test_date: l.test_date,
    hospital_name: l.hospital_name,
    days_ago: l.days_ago,
  }));
  try {
    const apiLabs = await api.getPatientLabs(patient.patient_id);
    if (apiLabs && apiLabs.length > 0) {
      const now = new Date();
      recent = apiLabs.map((l) => {
        const testD = l.test_date ? new Date(l.test_date) : now;
        const diffDays = Math.max(0, Math.floor((now.getTime() - testD.getTime()) / (1000 * 60 * 60 * 24)));
        return {
          test_name: l.test_name,
          result: l.result,
          unit: l.unit,
          test_date: l.test_date,
          hospital_name: l.hospital_name || hospitalName,
          days_ago: diffDays,
        };
      });
    }
  } catch (err) {
    if (apiErrorStatus(err) === 401 || apiErrorStatus(err) === 403) {
      recent = [];
    }
  }

  return (
    <div className="page" style={{ ["--page-max" as string]: "960px" }}>
      <PageHeader
        title="Record visit"
        subtitle={`${patient.full_name} at ${hospitalName} with ${doctor.full_name}`}
        actions={
          <Link className="btn btn--secondary" href={`/patients/${patient.patient_id}`}>
            Back to chart
          </Link>
        }
      />
      <VisitForm patientId={patient.patient_id} recentLabs={recent} />
    </div>
  );
}
