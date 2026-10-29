import type { Metadata } from "next";
import Link from "next/link";
import { Chip, DataTable, Empty, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { api, type ApiDoctor, type ApiHospitalCaseload } from "@/lib/api";
import * as store from "@/lib/store";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Hospital ${id} Clinicians` };
}

export default async function HospitalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession(["admin"]);
  const { id } = await params;

  let hospital: ApiHospitalCaseload | null = null;
  let doctors: ApiDoctor[] = [];

  const [caseloadResult, doctorsResult] = await Promise.allSettled([
    api.getHospitalCaseload(),
    api.getDoctors(id, 5000),
  ]);
  if (caseloadResult.status === "fulfilled") {
    hospital = caseloadResult.value.find((h) => h.hospital_id === id) || null;
  } else {
    console.warn("Falling back to local store for hospital details:", caseloadResult.reason);
    hospital = (store.caseload().find((h: any) => h.hospital_id === id) as any) || null;
  }
  if (doctorsResult.status === "fulfilled") {
    doctors = doctorsResult.value.filter((d) => d.hospital_id === id);
  } else {
    console.warn("Doctor roster unavailable:", doctorsResult.reason);
    doctors = (store.listDoctors().filter((d: any) => d.hospital_id === id) as any) || [];
  }
  if (!hospital) {
    try {
      const hDirect = await api.getHospital(id);
      if (hDirect) {
        hospital = {
          ...hDirect,
          doctor_count: doctors.length,
          visit_count: 0,
          patient_count: 0,
          opd_visits: 0,
          emergency_visits: 0,
          inpatient_visits: 0,
        };
      }
    } catch {}
  }

  if (!hospital) {
    return (
      <div className="page">
        <PageHeader title="Hospital not found" subtitle={`No hospital found with ID ${id}`} />
        <Link href="/hospitals" className="btn btn--secondary">
          ← Back to hospitals
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <Link href="/hospitals" className="btn btn--secondary btn--sm">
          ← Back to all hospitals
        </Link>
        <span className="badge" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", fontSize: "var(--fs-xs)", padding: "2px 8px" }}>
          Hospital Roster Tab
        </span>
      </div>

      <PageHeader
        title={hospital.hospital_name}
        subtitle={`${hospital.address} · Registered facility: ${hospital.registration_no} (${hospital.hospital_id})`}
      />

      <section className="card card-host stack-md" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div className="muted" style={{ fontSize: "var(--fs-xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Facility Metrics & Caseload
            </div>
            <div className="flex" style={{ flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
              <Chip tone="neutral" icon={false}>{hospital.visit_count} visits</Chip>
              <Chip tone="neutral" icon={false}>{hospital.patient_count ?? hospital.active_patients ?? 0} patients</Chip>
              <Chip tone="neutral" icon={false}>{hospital.opd_visits || 0} outpatient</Chip>
              <Chip tone="neutral" icon={false}>{hospital.inpatient_visits || 0} inpatient</Chip>
              <Chip tone="neutral" icon={false}>{hospital.emergency_visits || 0} emergency</Chip>
              <Chip tone="neutral" icon={false}>{doctors.length} affiliated clinicians</Chip>
            </div>
          </div>
          <div className="flex" style={{ gap: "8px" }}>
            <Link
              className="btn btn--secondary btn--sm"
              href={`/dashboard?hospital=${hospital.hospital_id}#hospital-patients`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Synced patients ↗
            </Link>
          </div>
        </div>
      </section>

      <section className="stack-sm">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontSize: "var(--fs-lg)", margin: 0 }}>
            Affiliated Doctors ({doctors.length})
          </h2>
          <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>
            Full clinical staff assigned to {hospital.hospital_name}
          </span>
        </div>

        {doctors.length === 0 ? (
          <Empty>No doctors currently registered under this hospital.</Empty>
        ) : (
          <DataTable
            caption={`Doctors at ${hospital.hospital_name}`}
            rows={doctors}
            rowKey={(d) => d.doctor_id}
            columns={[
              {
                header: "Doctor",
                cell: (d) => (
                  <span style={{ fontWeight: 600 }}>{d.full_name}</span>
                ),
              },
              {
                header: "Doctor ID",
                cell: (d) => (
                  <code style={{ fontSize: "var(--fs-xs)", background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: "4px" }}>
                    {d.doctor_id}
                  </code>
                ),
                nowrap: true,
              },
              {
                header: "Specialty",
                cell: (d) => <Chip tone="neutral" icon={false}>{d.specialization}</Chip>,
              },
              {
                header: "License number",
                cell: (d) => d.license_number,
                nowrap: true,
              },
              {
                header: "Contact",
                cell: (d) => d.contact_number || "—",
                nowrap: true,
              },
              {
                header: "Email",
                cell: (d) => (
                  <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>
                    {d.email || "—"}
                  </span>
                ),
              },
            ]}
          />
        )}
      </section>
    </div>
  );
}
