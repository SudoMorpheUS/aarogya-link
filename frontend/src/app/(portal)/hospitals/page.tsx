import type { Metadata } from "next";
import Link from "next/link";
import { Chip, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { api, type ApiHospitalCaseload, type ApiDoctor } from "@/lib/api";
import * as store from "@/lib/store";

export const metadata: Metadata = { title: "Hospitals & doctors" };

export default async function HospitalsPage() {
  await requireSession(["admin"]);
  let hospitals: ApiHospitalCaseload[] = [];
  let doctors: ApiDoctor[] = [];

  const [hospitalsResult, doctorsResult] = await Promise.allSettled([
    api.getHospitalCaseload(),
    api.getDoctors(undefined, 5000),
  ]);
  if (hospitalsResult.status === "fulfilled") {
    hospitals = hospitalsResult.value;
  } else {
    console.warn("Falling back to local store for hospitals:", hospitalsResult.reason);
    hospitals = store.caseload() as any;
  }
  if (doctorsResult.status === "fulfilled") {
    doctors = doctorsResult.value;
  } else {
    console.warn("Doctor roster unavailable:", doctorsResult.reason);
    doctors = store.listDoctors() as any;
  }

  return (
    <div className="page">
      <PageHeader
        title="Hospitals & facilities"
        subtitle="Registered healthcare facilities, caseload statistics and clinical rosters."
      />
      <div className="grid grid--wide" style={{ alignItems: "stretch" }}>
        {hospitals.map((h) => {
          const docsAtHospital = doctors.filter((d) => d.hospital_id === h.hospital_id);
          return (
            <section
              className="card card-host stack-md"
              key={h.hospital_id}
              aria-labelledby={`h-${h.hospital_id}`}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                height: "100%",
                padding: "20px",
              }}
            >
              <div className="stack-sm">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <h2 id={`h-${h.hospital_id}`} style={{ margin: 0, fontSize: "var(--fs-lg)" }}>
                      {h.hospital_name}
                    </h2>
                    <p className="muted" style={{ margin: "4px 0 0", fontSize: "var(--fs-sm)" }}>
                      {h.address}
                    </p>
                  </div>
                  <span
                    className="muted"
                    style={{
                      fontSize: "var(--fs-xs)",
                      fontFamily: "var(--font-mono)",
                      background: "var(--bg-subtle)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      border: "1px solid var(--border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h.hospital_id}
                  </span>
                </div>

                <div className="muted" style={{ fontSize: "var(--fs-xs)" }}>
                  Registration: <strong>{h.registration_no}</strong> · Tel: <strong>{h.contact_number}</strong>
                </div>

                <div className="flex" style={{ flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                  <Chip tone="neutral" icon={false}>{h.visit_count} visits</Chip>
                  <Chip tone="neutral" icon={false}>{h.patient_count ?? h.active_patients ?? 0} patients</Chip>
                  <Chip tone="neutral" icon={false}>{h.opd_visits || 0} outpatient</Chip>
                  <Chip tone="neutral" icon={false}>{h.inpatient_visits || 0} inpatient</Chip>
                  <Chip tone="neutral" icon={false}>{h.emergency_visits || 0} emergency</Chip>
                  <Chip tone="neutral" icon={false}>{docsAtHospital.length} clinicians</Chip>
                </div>
              </div>

              <div
                className="flex"
                style={{
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: "10px",
                  paddingTop: "16px",
                  borderTop: "1px solid var(--border)",
                  marginTop: "16px",
                }}
              >
                <Link
                  className="btn btn--primary btn--sm"
                  href={`/hospitals/${h.hospital_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open doctors at ${h.hospital_name} in a new tab`}
                >
                  View doctors ({docsAtHospital.length}) ↗
                </Link>
                <Link
                  className="btn btn--secondary btn--sm"
                  href={`/dashboard?hospital=${h.hospital_id}#hospital-patients`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`View synced patients for ${h.hospital_name} in a new tab`}
                >
                  Synced patients ↗
                </Link>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
