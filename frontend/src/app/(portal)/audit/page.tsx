import type { Metadata } from "next";
import Link from "next/link";
import { MaskedId } from "@/components/MaskedId";
import { ActionChip, DataTable, Empty, PageHeader, Pager } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { api } from "@/lib/api";
import * as store from "@/lib/store";

export const metadata: Metadata = { title: "Audit log" };

const FILTERS: [string, string][] = [
  ["ALL", "All"],
  ["READ", "Reads"],
  ["DENIED", "Denied"],
  ["EMERGENCY_READ", "Emergency"],
  ["CONSENT_CHANGE", "Consent"],
  ["INSERT", "Visits"],
];
const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string; patient_id?: string }>;
}) {
  const session = await requireSession();
  const { action = "ALL", page: pageParam, patient_id } = await searchParams;

  const targetPatientId =
    session.role === "patient" ? session.id! : patient_id ? patient_id : undefined;
  const targetDoctorId = session.role === "doctor" ? session.id! : undefined;

  let all: any[] = [];
  try {
    all = await api.getAuditLogs(targetPatientId, targetDoctorId, 500);
  } catch (err) {
    console.warn("Falling back to local store for audit logs:", err);
    all =
      targetPatientId
        ? store.auditForPatient(targetPatientId)
        : targetDoctorId
          ? store.auditForDoctor(targetDoctorId)
          : store.allAudit();
  }

  let patientInfo: { full_name?: string; patient_id?: string } | null = null;
  if (targetPatientId) {
    try {
      const p = await api.getPatient(targetPatientId);
      if (p) patientInfo = p;
    } catch {
      const p = store.getPatient(targetPatientId);
      if (p) patientInfo = p;
    }
    if (!patientInfo && all.length > 0) {
      patientInfo = {
        patient_id: all[0].patient_id,
        full_name: all[0].patient_name,
      };
    }
  }

  const filtered =
    action === "ALL"
      ? all
      : all.filter((r) => {
          if (action === "EMERGENCY_READ") return r.action === "EMERGENCY_READ" || r.action === "EMERGENCY_OVERRIDE";
          return r.action === action;
        });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageParam) || 1), pages);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const title =
    patient_id && session.role !== "patient"
      ? `Audit trail: ${patientInfo?.full_name || patient_id}`
      : session.role === "patient"
        ? "Access history"
        : session.role === "doctor"
          ? "My access log"
          : "Audit log";

  const subtitle =
    patient_id && session.role !== "patient"
      ? `Complete immutable access logs for patient ${patientInfo?.full_name || patient_id} (ID: ${patient_id}).`
      : session.role === "patient"
        ? "Everyone who opened, was blocked from, or changed access to your record."
        : session.role === "doctor"
          ? "Every chart you opened, were blocked from, or wrote to."
          : "Every access attempt, consent change and data modification on the platform.";

  const hrefFor = (p: number, a = action) =>
    `/audit?${new URLSearchParams({
      ...(patient_id ? { patient_id } : {}),
      ...(a !== "ALL" ? { action: a } : {}),
      ...(p > 1 ? { page: String(p) } : {}),
    })}`.replace(/\?$/, "");

  // Audit Access Intelligence
  const accessedBySet = new Set<string>();
  all.forEach((r) => {
    if (r.doctor_name) accessedBySet.add(r.doctor_name);
    else if (r.action) accessedBySet.add("Platform / Admin");
  });
  const accessedBy = Array.from(accessedBySet);
  const mostRecent = all[0];

  const columns = [
    { header: "#", cell: (r: (typeof rows)[number]) => r.log_id },
    { header: "Time", cell: (r: (typeof rows)[number]) => formatDateTime(r.action_time), nowrap: true },
    ...(session.role !== "patient"
      ? [
          {
            header: "Patient",
            cell: (r: (typeof rows)[number]) => (
              <span className="stack-sm" style={{ gap: 0 }}>
                <span>{r.patient_name}</span>
                <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>
                  <MaskedId id={r.patient_id} />
                </span>
              </span>
            ),
          },
        ]
      : []),
    { header: "Doctor", cell: (r: (typeof rows)[number]) => r.doctor_name ?? "—" },
    { header: "Action", cell: (r: (typeof rows)[number]) => <ActionChip action={r.action} /> },
    { header: "Details", cell: (r: (typeof rows)[number]) => r.details ?? "" },
  ];

  const countFor = (val: string) => {
    if (val === "ALL") return all.length;
    if (val === "EMERGENCY_READ") return all.filter((r) => r.action === "EMERGENCY_READ" || r.action === "EMERGENCY_OVERRIDE").length;
    return all.filter((r) => r.action === val).length;
  };

  return (
    <div className="page">
      <PageHeader title={title} subtitle={subtitle} />

      {targetPatientId && (
        <section
          className="card card-host stack-md"
          style={{
            borderLeft: "4px solid var(--blue-500)",
            marginBottom: "16px",
            background: "var(--bg-surface)",
          }}
          aria-labelledby="patient-audit-insights"
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h2 id="patient-audit-insights" style={{ margin: 0, fontSize: "var(--fs-lg)" }}>
                  Patient Access Intelligence
                </h2>
              </div>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: "var(--fs-xs)" }}>
                Patient: <strong>{patientInfo?.full_name || targetPatientId}</strong> · ID:{" "}
                <MaskedId id={targetPatientId} />
              </p>
            </div>
            {session.role === "admin" && patient_id && (
              <Link href="/audit" className="btn btn--secondary btn--sm">
                ← View all audit logs
              </Link>
            )}
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
              gap: "12px",
            }}
          >
            <div className="card" style={{ padding: "12px", background: "var(--bg-subtle)" }}>
              <div
                className="muted"
                style={{
                  fontSize: "var(--fs-xs)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Who accessed the patient's records?
              </div>
              <div style={{ marginTop: "6px", fontWeight: 600, fontSize: "var(--fs-sm)" }}>
                {accessedBy.length > 0 ? accessedBy.join(", ") : "No recorded access"}
              </div>
              <div className="muted" style={{ fontSize: "var(--fs-xs)", marginTop: "4px" }}>
                {accessedBy.length} distinct clinician(s) / actors
              </div>
            </div>

            <div className="card" style={{ padding: "12px", background: "var(--bg-subtle)" }}>
              <div
                className="muted"
                style={{
                  fontSize: "var(--fs-xs)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                When did they access them?
              </div>
              <div style={{ marginTop: "6px", fontWeight: 600, fontSize: "var(--fs-sm)" }}>
                {mostRecent ? formatDateTime(mostRecent.action_time) : "—"}
              </div>
              <div className="muted" style={{ fontSize: "var(--fs-xs)", marginTop: "4px" }}>
                {all.length > 1
                  ? `Spanning ${all.length} events (oldest: ${formatDateTime(all[all.length - 1].action_time)})`
                  : all.length === 1
                    ? "1 logged event"
                    : "No events"}
              </div>
            </div>

            <div className="card" style={{ padding: "12px", background: "var(--bg-subtle)" }}>
              <div
                className="muted"
                style={{
                  fontSize: "var(--fs-xs)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                What happened most recently?
              </div>
              {mostRecent ? (
                <>
                  <div
                    style={{
                      marginTop: "6px",
                      fontWeight: 600,
                      fontSize: "var(--fs-sm)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <ActionChip action={mostRecent.action} />
                    <span className="truncate">{mostRecent.details || "Record accessed"}</span>
                  </div>
                  <div className="muted" style={{ fontSize: "var(--fs-xs)", marginTop: "4px" }}>
                    By {mostRecent.doctor_name || "Platform"} on {formatDateTime(mostRecent.action_time)}
                  </div>
                </>
              ) : (
                <div className="muted" style={{ marginTop: "6px", fontSize: "var(--fs-sm)" }}>
                  No activity recorded
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <nav className="actions" aria-label="Filter by action" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "8px 0 16px" }}>
        {FILTERS.map(([value, label]) => {
          const cnt = countFor(value);
          return (
            <Link
              key={value}
              className={value === action ? "btn btn--sm" : "btn btn--secondary btn--sm"}
              href={hrefFor(1, value)}
              aria-current={value === action ? "true" : undefined}
            >
              {label} ({cnt})
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <Empty>No matching entries.</Empty>
      ) : (
        <>
          <DataTable
            caption={title}
            rows={rows}
            rowKey={(r) => r.log_id}
            rowClass={(r) => (r.action === "EMERGENCY_READ" ? "row-critical" : undefined)}
            columns={columns}
          />
          <Pager page={page} pages={pages} total={filtered.length} pageSize={PAGE_SIZE} hrefFor={(p) => hrefFor(p)} />
        </>
      )}
    </div>
  );
}
