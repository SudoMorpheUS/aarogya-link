import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TimelineCardContent } from "@/components/Timeline";
import { formatDateTime } from "@/lib/format";
import { api, apiErrorStatus, type ApiTimelineEntry } from "@/lib/api";
import { requireSession } from "@/lib/session";
import * as store from "@/lib/store";
import type { TimelineEntry } from "@/lib/types";

export const metadata: Metadata = { title: "Visit Details" };

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const visitId = parseInt(id, 10);
  if (isNaN(visitId)) notFound();

  let visit: ApiTimelineEntry | null = null;
  try {
    visit = await api.getVisit(visitId);
  } catch (err) {
    const status = apiErrorStatus(err);
    if (status === 404 || status === 403) {
      notFound();
    }
    const fallback = store.getVisit(visitId);
    if (fallback) {
      if (session.role === "patient" && fallback.patient_id !== session.id) {
        notFound();
      }
      visit = {
        visit_id: fallback.visit_id,
        visit_date: fallback.visit_date,
        visit_type: fallback.visit_type as any,
        chief_complaint: fallback.chief_complaint,
        doctor: {
          doctor_id: fallback.doctor_id,
          full_name: fallback.doctor_name,
          specialization: store.getDoctor(fallback.doctor_id)?.specialization || "Physician",
        },
        hospital: {
          hospital_id: fallback.hospital_id,
          hospital_name: fallback.hospital_name,
          address: store.getHospital(fallback.hospital_id)?.address || "",
        },
        diagnoses: fallback.diagnoses,
        prescriptions: fallback.prescriptions,
        lab_tests: fallback.labs as any,
      };
    } else {
      notFound();
    }
  }

  if (!visit) notFound();

  if (session.role === "patient" && (visit as any).patient_id && (visit as any).patient_id !== session.id) {
    notFound();
  }

  const entry: TimelineEntry = {
    visit_id: visit.visit_id,
    patient_id: session.role === "patient" ? session.id! : (visit as any).patient_id || "",
    hospital_id: visit.hospital.hospital_id,
    hospital_name: visit.hospital.hospital_name,
    doctor_id: visit.doctor.doctor_id,
    doctor_name: visit.doctor.full_name,
    visit_date: visit.visit_date,
    visit_type: visit.visit_type,
    chief_complaint: visit.chief_complaint,
    diagnoses: (visit.diagnoses || []) as any,
    prescriptions: (visit.prescriptions || []) as any,
    labs: (visit.lab_tests || []) as any,
  };

  return (
    <div className="page">
      <div className="card-head" style={{ marginBottom: "var(--sp-sm)" }}>
        <Link href="/records" className="btn btn--secondary btn--sm">
          ← Back to all records
        </Link>
        <Link href="/dashboard" className="btn btn--secondary btn--sm">
          Dashboard
        </Link>
      </div>

      <header className="page-head" style={{ marginBottom: "var(--sp-md)" }}>
        <div>
          <p className="eyebrow">Visit #{visit.visit_id} · {visit.visit_type}</p>
          <h1>{visit.chief_complaint || "Clinical Encounter"}</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {formatDateTime(visit.visit_date)} · {visit.hospital.hospital_name} · {visit.doctor.full_name} ({visit.doctor.specialization})
          </p>
        </div>
      </header>

      <section aria-labelledby="visit-detail-title">
        <TimelineCardContent entry={entry} />
      </section>
    </div>
  );
}
