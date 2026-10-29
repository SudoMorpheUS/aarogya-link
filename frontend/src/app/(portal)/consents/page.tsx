import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { ConsentsView, type EnrichedConsent } from "@/components/ConsentsView";
import { GrantConsentForm } from "@/components/GrantConsentForm";
import { PageHeader, VisibilityNote } from "@/components/ui";
import { requireSession } from "@/lib/session";
import { api } from "@/lib/api";
import * as store from "@/lib/store";

export const metadata: Metadata = { title: "Consent" };

const CITY_STATE_MAP: Record<string, [string, string]> = {
  kolkata: ["Kolkata", "West Bengal"],
  mumbai: ["Mumbai", "Maharashtra"],
  bhopal: ["Bhopal", "Madhya Pradesh"],
  hyderabad: ["Hyderabad", "Telangana"],
  pune: ["Pune", "Maharashtra"],
  nagpur: ["Nagpur", "Maharashtra"],
  coimbatore: ["Coimbatore", "Tamil Nadu"],
  lucknow: ["Lucknow", "Uttar Pradesh"],
  jaipur: ["Jaipur", "Rajasthan"],
  ahmedabad: ["Ahmedabad", "Gujarat"],
  bangalore: ["Bengaluru", "Karnataka"],
  bengaluru: ["Bengaluru", "Karnataka"],
  bhubaneswar: ["Bhubaneswar", "Odisha"],
  patna: ["Patna", "Bihar"],
  visakhapatnam: ["Visakhapatnam", "Andhra Pradesh"],
  chennai: ["Chennai", "Tamil Nadu"],
  surat: ["Surat", "Gujarat"],
  kochi: ["Kochi", "Kerala"],
  delhi: ["Delhi", "Delhi"],
  "new delhi": ["Delhi", "Delhi"],
  indore: ["Indore", "Madhya Pradesh"],
};

function parseLocationState(address: string | null | undefined): { city: string; state: string; formatted: string } {
  if (!address) return { city: "—", state: "—", formatted: "—" };
  const lower = address.toLowerCase();
  for (const [key, [city, state]] of Object.entries(CITY_STATE_MAP)) {
    if (lower.includes(key)) {
      return { city, state, formatted: `${city}, ${state}` };
    }
  }
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  const city = parts[parts.length - 1] || "—";
  return { city, state: "India", formatted: `${city}, India` };
}

export default async function ConsentsPage() {
  const session = await requireSession(["patient"]);
  const today = store.today();
  let rows: any[] = [];
  let hospitalsList: any[] = [];
  let doctorsList: any[] = [];

  // Resolve each dataset independently: one failed endpoint must not replace
  // the full hospital/doctor directory with the tiny in-memory sample data.
  const [consentsResult, hospitalsResult, doctorsResult] = await Promise.allSettled([
    api.getConsents(session.id!, undefined, undefined, 5000),
    api.getHospitals(),
    api.getDoctors(undefined, 5000),
  ]);
  if (consentsResult.status === "fulfilled") {
    rows = consentsResult.value;
  } else {
    console.warn("Falling back to local store for consents:", consentsResult.reason);
    rows = store.consentsOf(session.id!);
  }
  if (hospitalsResult.status === "fulfilled") {
    hospitalsList = hospitalsResult.value;
  } else {
    console.warn("Hospital directory unavailable:", hospitalsResult.reason);
    hospitalsList = store.listHospitals() as any[];
  }
  if (doctorsResult.status === "fulfilled") {
    doctorsList = doctorsResult.value;
  } else {
    console.warn("Doctor directory unavailable:", doctorsResult.reason);
    doctorsList = store.listDoctors() as any[];
  }

  const active = rows.filter((c) => c.status === "Active" && c.start_date <= today && (!c.end_date || c.end_date >= today));

  const hospitalMap = new Map(hospitalsList.map((h) => [h.hospital_id, h]));
  const doctorMap = new Map(doctorsList.map((d) => [d.doctor_id, d]));

  const hospitals = hospitalsList.map((h) => {
    const loc = parseLocationState(h.address);
    return {
      value: `hospital:${h.hospital_id}`,
      label: h.hospital_name,
      subtitle: `${h.address} · Location: ${loc.formatted}`,
      type: "hospital" as const,
      badge: loc.formatted,
    };
  });

  const doctors = doctorsList.map((d) => {
    const hosp = hospitalMap.get(d.hospital_id);
    const loc = parseLocationState(hosp?.address);
    const formattedName = d.full_name.startsWith("Dr.") || d.full_name.startsWith("Dr ") ? d.full_name : `Dr. ${d.full_name}`;
    return {
      value: `doctor:${d.doctor_id}`,
      label: formattedName,
      subtitle: `${d.specialization || "General Medicine"} · ${hosp?.hospital_name || d.hospital_id} (${loc.formatted})`,
      type: "doctor" as const,
      badge: `${d.specialization || "Doctor"} · ${loc.city}`,
    };
  });

  const resolveConsent = (c: any) => {
    const isDoctor = Boolean(c.doctor_id);
    const doc = c.doctor_id ? doctorMap.get(c.doctor_id) : null;
    const hosp = isDoctor
      ? (doc?.hospital_id ? hospitalMap.get(doc.hospital_id) : null)
      : (c.hospital_id ? hospitalMap.get(c.hospital_id) : null);

    const name = c.doctor_name || doc?.full_name || c.hospital_name || hosp?.hospital_name || "Authorized Entity";
    const specialization = isDoctor
      ? c.doctor_specialization || doc?.specialization || "General Medicine"
      : "All Departments (Hospital-wide)";
    const hospitalName = isDoctor
      ? c.doctor_hospital_name || hosp?.hospital_name || "Hospital Network"
      : c.hospital_name || hosp?.hospital_name || "Hospital Network";
    const address = isDoctor
      ? c.doctor_hospital_address || hosp?.address || ""
      : c.hospital_address || hosp?.address || "";
    const loc = c.location && c.location !== "—" ? { formatted: c.location, city: c.city, state: c.state } : parseLocationState(address);

    return {
      consent_id: c.consent_id,
      patient_id: c.patient_id,
      hospital_id: c.hospital_id,
      doctor_id: c.doctor_id,
      start_date: c.start_date,
      end_date: c.end_date,
      status: c.status,
      isDoctor,
      name,
      specialization,
      hospitalName,
      location: loc.formatted,
      city: loc.city,
      state: loc.state,
    };
  };

  const enrichedConsents: EnrichedConsent[] = rows.map(resolveConsent);

  return (
    <div className="page">
      <PageHeader
        title="Consent"
        subtitle="Nobody can open your chart unless an active consent names their hospital or them personally."
      />
      <VisibilityNote>
        {active.length === 0
          ? "Right now nobody but you can see your record."
          : `${active.length} active consent${active.length === 1 ? "" : "s"} let doctors open your record.`}
      </VisibilityNote>

      <div className="workspace">
        <section className="card card-host pane stack-sm" aria-labelledby="grant-title" style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
          <div className="card-head">
            <h2 id="grant-title" className="flex">
              <ShieldCheck size={20} strokeWidth={1.75} aria-hidden="true" style={{ color: "var(--blue-600)" }} />
              Grant access
            </h2>
          </div>
          <GrantConsentForm key={rows.filter((c) => c.status === "Revoked").length} hospitals={hospitals} doctors={doctors} today={today} />
        </section>

        <ConsentsView consents={enrichedConsents} today={today} />
      </div>
    </div>
  );
}
