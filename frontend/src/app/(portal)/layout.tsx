import { Bell, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { IdleGuard } from "@/components/IdleGuard";
import { NavLinks, type NavItem } from "@/components/NavLinks";
import { Shortcuts } from "@/components/Shortcuts";
import { CubeMark } from "@/components/TowerLoader";
import { ActionChip, Avatar } from "@/components/ui";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { attentionFor, type AttentionItem } from "@/lib/attention";
import { formatDate, formatDateTime, maskId } from "@/lib/format";
import { requireSession } from "@/lib/session";
import { api } from "@/lib/api";
import * as store from "@/lib/store";
import type { Session } from "@/lib/types";

const countKind = (items: AttentionItem[], kind: AttentionItem["kind"]) => items.filter((i) => i.kind === kind).length;

function navFor(session: Session, items: AttentionItem[]): NavItem[] {
  if (session.role === "patient")
    return [
      { href: "/dashboard", label: "My records", icon: "dashboard", count: countKind(items, "lab") },
      { href: "/consents", label: "Consent", icon: "consent", count: countKind(items, "consent") },
      { href: "/audit", label: "Access history", icon: "audit", count: countKind(items, "access") },
    ];
  if (session.role === "doctor")
    return [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/patients", label: "Patients", icon: "patients", count: countKind(items, "lab") },
      { href: "/duplicates", label: "Duplicate tests", icon: "labs" },
      { href: "/audit", label: "My access log", icon: "audit" },
    ];
  return [
    { href: "/dashboard", label: "Overview", icon: "dashboard" },
    { href: "/hospitals", label: "Hospitals & doctors", icon: "hospitals" },
    { href: "/patients", label: "Patient registry", icon: "patients" },
    { href: "/audit", label: "Audit log", icon: "audit", count: countKind(items, "access") },
  ];
}

async function Aside({ session }: { session: Session }) {
  if (session.role === "patient") {
    const today = store.today();
    let active: { consent_id: number; target_name: string; end_date: string | null }[] = [];
    try {
      const apiConsents = await api.getConsents(session.id!);
      if (apiConsents) {
        active = apiConsents
          .filter((c) => c.status === "Active" && c.start_date <= today && (!c.end_date || c.end_date >= today))
          .map((c) => {
            const docName = c.doctor_name || (c.doctor_id ? store.getDoctor(c.doctor_id)?.full_name : null);
            const hospName = c.hospital_name || c.resolved_hospital_name || (c.hospital_id ? store.getHospital(c.hospital_id)?.hospital_name : null);
            return {
              consent_id: c.consent_id,
              target_name: docName || hospName || "Authorized entity",
              end_date: c.end_date,
            };
          });
      }
    } catch {
      active = store
        .consentsOf(session.id!)
        .filter((c) => c.status === "Active" && c.start_date <= today && (!c.end_date || c.end_date >= today))
        .map((c) => ({
          consent_id: c.consent_id,
          target_name: c.doctor_id
            ? (store.getDoctor(c.doctor_id)?.full_name ?? c.doctor_id)
            : (store.getHospital(c.hospital_id!)?.hospital_name ?? c.hospital_id!),
          end_date: c.end_date,
        }));
    }

    let events: { log_id: number; doctor_name: string | null; action: string; action_time: string }[] = [];
    try {
      const apiLogs = await api.getAuditLogs(session.id!, undefined, 20);
      if (apiLogs) {
        events = apiLogs
          .filter((e) => ["READ", "DENIED", "EMERGENCY_READ"].includes(e.action))
          .slice(0, 5)
          .map((e) => ({
            log_id: e.log_id,
            doctor_name: e.doctor_name,
            action: e.action,
            action_time: e.action_time,
          }));
      }
    } catch {
      events = store
        .auditForPatient(session.id!)
        .filter((e) => ["READ", "DENIED", "EMERGENCY_READ"].includes(e.action))
        .slice(0, 5)
        .map((e) => ({
          log_id: e.log_id,
          doctor_name: e.doctor_name,
          action: e.action,
          action_time: e.action_time,
        }));
    }

    return (
      <div className="stack">
        <section aria-labelledby="aside-who">
          <h2 id="aside-who" className="card-head" style={{ fontSize: "var(--fs-md)" }}>
            Who can see my data
          </h2>
          {active.length === 0 ? (
            <p className="muted">Nobody. Your record is private.</p>
          ) : (
            <ul className="list">
              {active.slice(0, 6).map((c) => (
                <li key={c.consent_id}>
                  <span className="truncate" title={c.target_name}>
                    {c.target_name}
                  </span>
                  <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>
                    {c.end_date ? `Until ${formatDate(c.end_date)}` : "No end date"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="aside-recent">
          <h2 id="aside-recent" className="card-head" style={{ fontSize: "var(--fs-md)" }}>
            Recent access
          </h2>
          {events.length === 0 ? (
            <p className="muted">No one has opened your record yet.</p>
          ) : (
            <ul className="list">
              {events.map((e) => (
                <li key={e.log_id}>
                  <span className="list-row">
                    <span className="truncate">{e.doctor_name ?? "Unknown"}</span>
                    <ActionChip action={e.action} />
                  </span>
                  <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>
                    {formatDateTime(e.action_time)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  let rows: { log_id: number; patient_name: string; patient_id: string; action: string; action_time: string }[] = [];
  try {
    if (session.role === "doctor") {
      const apiLogs = await api.getAuditLogs(undefined, session.id!, 20);
      rows = (apiLogs || []).slice(0, 6).map((e) => ({
        log_id: e.log_id,
        patient_name: e.patient_name || e.patient_id,
        patient_id: e.patient_id,
        action: e.action,
        action_time: e.action_time,
      }));
    } else {
      const apiLogs = await api.getAuditLogs(undefined, undefined, 50);
      rows = (apiLogs || [])
        .filter((e) => e.action === "DENIED" || e.action === "EMERGENCY_READ")
        .slice(0, 6)
        .map((e) => ({
          log_id: e.log_id,
          patient_name: e.patient_name || e.patient_id,
          patient_id: e.patient_id,
          action: e.action,
          action_time: e.action_time,
        }));
    }
  } catch {
    rows = (session.role === "doctor"
      ? store.auditForDoctor(session.id!).slice(0, 6)
      : store.allAudit().filter((e) => e.action === "DENIED" || e.action === "EMERGENCY_READ").slice(0, 6)
    ).map((e) => ({
      log_id: e.log_id,
      patient_name: e.patient_name,
      patient_id: e.patient_id,
      action: e.action,
      action_time: e.action_time,
    }));
  }

  return (
    <section aria-labelledby="aside-activity">
      <h2 id="aside-activity" className="card-head" style={{ fontSize: "var(--fs-md)" }}>
        {session.role === "doctor" ? "Recent activity" : "Live alerts"}
      </h2>
      {rows.length === 0 ? (
        <p className="muted">Nothing to show yet.</p>
      ) : (
        <ul className="list">
          {rows.map((e) => (
            <li key={e.log_id}>
              <span className="list-row">
                <span className="truncate" title={e.patient_name}>
                  {e.patient_name}
                </span>
                <ActionChip action={e.action} />
              </span>
              <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>
                {formatDateTime(e.action_time)} · {maskId(e.patient_id)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  let doctor: any = null;
  let patient: any = null;
  if (session.role === "doctor" && session.id) {
    try {
      doctor = await api.getDoctor(session.id);
    } catch {
      doctor = store.getDoctor(session.id);
    }
  }
  if (session.role === "patient" && session.id) {
    try {
      patient = await api.getPatient(session.id);
    } catch {
      patient = store.getPatient(session.id);
    }
  }
  const name = doctor?.full_name ?? patient?.full_name ?? "Administrator";
  const where = doctor ? (doctor.hospital_name ?? store.getHospital(doctor.hospital_id)?.hospital_name ?? "") : patient ? maskId(patient.patient_id) : "All hospitals";

  const attention = attentionFor(session);
  const queue = session.role === "doctor" ? store.patientsWithAccess(session.id!).map((p) => p.patient_id) : [];

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="top">
        <Link href="/dashboard" className="brand" aria-label="AarogyaLink home">
          <CubeMark size={30} />
          <span className="brand-text">
            AarogyaLink
            <small>Health data exchange</small>
          </span>
        </Link>

        {session.role !== "patient" ? (
          <form action="/patients" role="search" className="top-search">
            <Search size={18} strokeWidth={1.75} aria-hidden="true" />
            <input id="global-search" name="q" type="search" placeholder="Search patients" aria-label="Search patients" autoComplete="off" />
          </form>
        ) : null}

        <div className="top-actions">
          <ThemeToggle />
          {session.role !== "patient" ? (
            <Link className="icon-btn top-search-icon" href="/patients" aria-label="Search patients">
              <Search size={20} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          ) : null}
          <Link
            className="icon-btn"
            href="/dashboard#attention"
            aria-label={attention.length > 0 ? `Notifications, ${attention.length} need attention` : "Notifications, nothing needs attention"}
          >
            <Bell size={20} strokeWidth={1.75} aria-hidden="true" />
            {attention.length > 0 ? <span className="dot" aria-hidden="true" /> : null}
          </Link>
          <details className="profile">
            <summary aria-label="Account menu">
              <Avatar name={name} />
              <span className="profile-name">{name}</span>
            </summary>
            <div className="menu">
              <dl>
                <dt>Signed in as</dt>
                <dd>{name}</dd>
                <dt>Role</dt>
                <dd style={{ textTransform: "capitalize" }}>{session.role}</dd>
                <dt>{session.role === "doctor" ? "Hospital" : session.role === "patient" ? "Patient" : "Scope"}</dt>
                <dd>{where}</dd>
              </dl>
              {session.role === "doctor" ? (
                <p className="muted" style={{ fontSize: "var(--fs-xs)" }}>
                  Shortcuts: <kbd>/</kbd> search, <kbd>]</kbd> next patient, <kbd>[</kbd> previous
                </p>
              ) : null}
              <SignOutButton />
            </div>
          </details>
        </div>
      </header>

      <nav className="nav" aria-label="Main">
        <NavLinks items={navFor(session, attention)} />
      </nav>

      <main id="main" className="main" tabIndex={-1}>
        {children}
      </main>

      <aside className="aside" aria-label={session.role === "patient" ? "Privacy and access" : "Activity"}>
        <Aside session={session} />
      </aside>

      {session.role === "doctor" ? <Shortcuts patientIds={queue} /> : null}
      {session.role !== "patient" ? <IdleGuard /> : null}
    </div>
  );
}
