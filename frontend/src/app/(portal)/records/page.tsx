import type { Metadata } from "next";
import Link from "next/link";
import { Timeline } from "@/components/Timeline";
import { Empty } from "@/components/ui";
import { api, apiErrorStatus } from "@/lib/api";
import { requireSession } from "@/lib/session";
import * as store from "@/lib/store";
import type { TimelineEntry } from "@/lib/types";

export const metadata: Metadata = { title: "All Health Records" };

function mapTimeline(
  id: string,
  rows: {
    visit_id: number;
    visit_date: string;
    visit_type: string;
    chief_complaint: string | null;
    doctor: { doctor_id: string; full_name: string };
    hospital: { hospital_id: string; hospital_name: string };
    diagnoses: unknown;
    prescriptions: unknown;
    lab_tests: unknown;
  }[],
): TimelineEntry[] {
  return rows.map((t) => ({
    visit_id: t.visit_id,
    patient_id: id,
    hospital_id: t.hospital.hospital_id,
    hospital_name: t.hospital.hospital_name,
    doctor_id: t.doctor.doctor_id,
    doctor_name: t.doctor.full_name,
    visit_date: t.visit_date,
    visit_type: t.visit_type as any,
    chief_complaint: t.chief_complaint,
    diagnoses: (t.diagnoses || []) as any,
    prescriptions: (t.prescriptions || []) as any,
    labs: (t.lab_tests || []) as any,
  }));
}

export default async function RecordsPage() {
  const session = await requireSession();
  const id = session.id;

  let entries: TimelineEntry[] = [];
  if (session.role === "patient" && id) {
    try {
      const chart = await api.getChart(id);
      entries = mapTimeline(id, chart.timeline || []);
    } catch (err) {
      const status = apiErrorStatus(err);
      if (status !== 401 && status !== 403) {
        entries = store.timeline(id);
      }
    }
  }

  return (
    <div className="page">
      <div className="card-head" style={{ marginBottom: "var(--sp-sm)" }}>
        <Link href="/dashboard" className="btn btn--secondary btn--sm">
          ← Back to dashboard
        </Link>
      </div>

      <header className="page-head" style={{ marginBottom: "var(--sp-md)" }}>
        <div>
          <p className="eyebrow">Unified Longitudinal Records</p>
          <h1>All records</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Full timeline of clinical encounters, diagnoses, prescriptions, and lab investigations across all participating hospitals.
          </p>
        </div>
      </header>

      <section aria-labelledby="records-list-title" className="stack-sm">
        {entries.length === 0 ? (
          <Empty>No records yet.</Empty>
        ) : (
          <Timeline entries={entries} clickable={true} />
        )}
      </section>
    </div>
  );
}
