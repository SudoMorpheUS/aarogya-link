import { UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MaskedId } from "@/components/MaskedId";
import { RegisterPatientForm } from "@/components/RegisterPatientForm";
import { Chip, DataTable, Empty, PageHeader } from "@/components/ui";
import { ageOn, maskPhone } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { api, type ApiPatient } from "@/lib/api";
import * as store from "@/lib/store";

export const metadata: Metadata = { title: "Patients" };

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; register?: string; action?: string; view?: string }>;
}) {
  const session = await requireSession(["doctor", "admin"]);
  const { q = "", register, action, view } = await searchParams;
  let rows: (ApiPatient | import("@/lib/types").Patient)[] = [];
  let consentDist: any[] = [];
  let totalPatientCount: number | null = null;
  // Resolve each dataset independently: a failure in the consent distribution
  // (or stats) must not replace the live patient list with sample data.
  const [patientsResult, distResult, statsResult] = await Promise.allSettled([
    api.getPatients(q, 5000),
    session.role === "admin" ? api.getConsentDistribution(5000) : Promise.resolve([]),
    api.getStats(),
  ]);
  if (patientsResult.status === "fulfilled") {
    rows = patientsResult.value;
  } else {
    console.warn("Falling back to local store for patients:", patientsResult.reason);
    rows = store.listPatients(q);
  }
  if (distResult.status === "fulfilled") {
    consentDist = distResult.value;
  } else {
    console.warn("Consent distribution unavailable:", distResult.reason);
  }
  if (statsResult.status === "fulfilled" && typeof statsResult.value?.patients === "number") {
    totalPatientCount = statsResult.value.patients;
  }
  const consentMap = new Map(consentDist.map((d) => [d.patient_id, d]));
  const today = store.today();
  const isDoctor = session.role === "doctor";
  const isRegistering = Boolean(register || action === "register");

  let accessiblePatients = new Set<string>();
  if (isDoctor && session.id) {
    try {
      const ids = await api.getAccessiblePatients(session.id);
      accessiblePatients = new Set(ids);
    } catch {
      accessiblePatients = new Set(
        rows.filter((p) => store.accessLevel(p.patient_id, session.id!) !== "none").map((p) => p.patient_id)
      );
    }
  }

  const currentView = view || (isDoctor ? "allowed" : "all");
  const allowedRows = isDoctor
    ? rows.filter((p) => accessiblePatients.has(p.patient_id) || store.accessLevel(p.patient_id, session.id!) !== "none")
    : rows;
  const displayedRows = currentView === "allowed" && isDoctor ? allowedRows : rows;

  return (
    <div className="page">
      <PageHeader
        title={isDoctor ? "Patients" : "Patient registry"}
        subtitle={
          isDoctor
            ? "Showing patients with active consent granted to you or your hospital network."
            : "Registered patients and their global IDs. Administrators do not see clinical records."
        }
        actions={
          <a className="btn" href="#register">
            <UserPlus size={18} strokeWidth={1.75} aria-hidden="true" />
            Register patient
          </a>
        }
      />

      <form className="search-form" role="search">
        <input key={q} name="q" defaultValue={q} placeholder="Name, patient ID or blood group" aria-label="Search patients" type="search" />
        <button className="btn">Search</button>
        {q ? (
          <Link className="btn btn--secondary" href={`/patients${isDoctor ? `?view=${currentView}` : ""}`}>
            Clear
          </Link>
        ) : null}
      </form>

      {isDoctor && (
        <div className="flex" style={{ gap: 8, margin: "4px 0 14px", alignItems: "center" }}>
          <span className="muted" style={{ fontSize: "var(--fs-sm)", fontWeight: 500 }}>Filter:</span>
          <Link
            href={`/patients?${new URLSearchParams({ ...(q ? { q } : {}), view: "allowed" }).toString()}`}
            className={`btn btn--sm ${currentView === "allowed" ? "" : "btn--secondary"}`}
          >
            Allowed Consent ({!q.trim() && accessiblePatients.size > 0 ? accessiblePatients.size : allowedRows.length})
          </Link>
          <Link
            href={`/patients?${new URLSearchParams({ ...(q ? { q } : {}), view: "all" }).toString()}`}
            className={`btn btn--sm ${currentView === "all" ? "" : "btn--secondary"}`}
          >
            All Patients ({!q.trim() && totalPatientCount ? totalPatientCount.toLocaleString() : rows.length})
          </Link>
        </div>
      )}

      {displayedRows.length === 0 ? (
        <Empty>
          {isDoctor && currentView === "allowed" ? (
            <>
              No patients with active consent found matching that search.{" "}
              <Link href={`/patients?view=all${q ? `&q=${encodeURIComponent(q)}` : ""}`} style={{ textDecoration: "underline", marginLeft: 4 }}>
                Search all registered patients (for Emergency / Break-Glass)
              </Link>
            </>
          ) : (
            "No patient matches that search."
          )}
        </Empty>
      ) : (
        <DataTable
          caption="Patients"
          rows={displayedRows}
          rowKey={(p) => p.patient_id}
          columns={[
            {
              header: "Patient",
              cell: (p) =>
                !isDoctor ? (
                  <Link
                    href={`/audit?patient_id=${p.patient_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      maxWidth: "24ch",
                      textDecoration: "underline",
                      fontWeight: 600,
                    }}
                    title={`Open audit trail for ${p.full_name} in a new tab`}
                  >
                    <span>{p.full_name}</span>
                    <span style={{ fontSize: "var(--fs-xs)" }}>↗</span>
                  </Link>
                ) : (
                  <span className="truncate" style={{ display: "block", maxWidth: "24ch" }} title={p.full_name}>
                    {p.full_name}
                  </span>
                ),
            },
            { header: "ID", cell: (p) => <MaskedId id={p.patient_id} /> },
            { header: "Age / sex", cell: (p) => `${ageOn(p.date_of_birth, today)} / ${p.gender}`, nowrap: true },
            { header: "Blood", cell: (p) => p.blood_group ?? "—" },
            { header: "Contact", cell: (p) => maskPhone(p.contact_number), nowrap: true },
            ...(isDoctor
              ? [
                  {
                    header: "Access",
                    cell: (p: (typeof rows)[number]) => {
                      const hasDbConsent = accessiblePatients.has(p.patient_id);
                      const storeLevel = store.accessLevel(p.patient_id, session.id!);
                      const isAllowed = hasDbConsent || storeLevel === "consent";
                      const isEmergency = !isAllowed && storeLevel === "emergency";
                      return (
                        <span className="flex">
                          {isAllowed ? (
                            <Chip>Allowed</Chip>
                          ) : isEmergency ? (
                            <Chip tone="attention">Emergency</Chip>
                          ) : (
                            <Chip tone="attention">No consent</Chip>
                          )}
                          <Link className="btn btn--secondary btn--sm" href={`/patients/${p.patient_id}`}>
                            Open chart
                          </Link>
                        </span>
                      );
                    },
                  },
                ]
              : [
                  {
                    header: "Consented hospitals",
                    cell: (p: (typeof rows)[number]) => {
                      const dist = consentMap.get(p.patient_id);
                      if (!dist || !dist.consented_hospitals || dist.consented_hospitals.length === 0) {
                        return <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>None</span>;
                      }
                      return (
                        <div className="flex" style={{ flexWrap: "wrap", gap: 4 }}>
                          {dist.consented_hospitals.slice(0, 2).map((h: string) => (
                            <Chip key={h} tone="neutral" icon={false}>
                              {h}
                            </Chip>
                          ))}
                          {dist.consented_hospitals.length > 2 ? (
                            <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>
                              +{dist.consented_hospitals.length - 2} more
                            </span>
                          ) : null}
                        </div>
                      );
                    },
                  },
                  {
                    header: "Audit trail",
                    cell: (p: (typeof rows)[number]) => (
                      <Link
                        className="btn btn--secondary btn--sm"
                        href={`/audit?patient_id=${p.patient_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Audit logs ↗
                      </Link>
                    ),
                  },
                ]),
          ]}
        />
      )}

      <details className="card" id="register" open={isRegistering || undefined}>
        <summary>
          <UserPlus size={18} strokeWidth={1.75} aria-hidden="true" style={{ color: "var(--blue-600)" }} />
          Register a new patient
        </summary>
        <RegisterPatientForm />
      </details>
    </div>
  );
}
