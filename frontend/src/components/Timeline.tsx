import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/format";
import { assessLab } from "@/lib/lab-ranges";
import type { TimelineEntry } from "@/lib/types";
import { Chip, DataTable, Empty, LabChip, visitTone } from "./ui";

/** Reusable timeline visit card content (reused across Dashboard, /records and /records/[id]). */
export function TimelineCardContent({ entry }: { entry: TimelineEntry }) {
  const critical = entry.labs.some((l) => assessLab(l.test_name, l.result).flag === "critical");

  return (
    <article className="card card-host">
      <div className="card-head">
        <h3 className="wrap">{entry.chief_complaint ?? "Visit"}</h3>
        <span className="flex">
          {critical ? <Chip tone="critical">Critical result</Chip> : null}
          <Chip tone={visitTone(entry.visit_type)} icon={false}>
            {entry.visit_type}
          </Chip>
        </span>
      </div>
      <div className="visit-meta">
        <span>{formatDateTime(entry.visit_date)}</span>
        <span>{entry.hospital_name}</span>
        <span>{entry.doctor_name}</span>
        <span>Visit #{entry.visit_id}</span>
      </div>

      <div className="visit-body">
        {entry.diagnoses.length > 0 && (
          <section>
            <h4>Diagnosis</h4>
            <ul className="dx-list">
              {entry.diagnoses.map((d) => (
                <li key={d.diagnosis_id} className="wrap">
                  <strong>{d.disease_code}</strong> · {d.description}
                </li>
              ))}
            </ul>
          </section>
        )}

        {entry.prescriptions.length > 0 && (
          <section>
            <h4>Prescriptions</h4>
            <DataTable
              caption="Prescriptions for this visit"
              rows={entry.prescriptions}
              rowKey={(p) => p.prescription_id}
              columns={[
                { header: "Medicine", cell: (p) => p.medicine_name },
                { header: "Dosage", cell: (p) => p.dosage },
                { header: "Frequency", cell: (p) => p.frequency },
                { header: "Duration", cell: (p) => p.duration },
              ]}
            />
          </section>
        )}

        {entry.labs.length > 0 && (
          <section>
            <h4>Lab results</h4>
            <DataTable
              caption="Lab results for this visit"
              rows={entry.labs}
              rowKey={(l) => l.lab_test_id}
              rowClass={(l) => (assessLab(l.test_name, l.result).flag === "critical" ? "row-critical" : undefined)}
              columns={[
                { header: "Test", cell: (l) => l.test_name },
                { header: "Result", cell: (l) => `${l.result ?? "—"} ${l.unit ?? ""}`.trim(), nowrap: true },
                {
                  header: "Range",
                  cell: (l) => {
                    const a = assessLab(l.test_name, l.result);
                    return <LabChip flag={a.flag} direction={a.direction} />;
                  },
                },
                { header: "Date", cell: (l) => formatDate(l.test_date), nowrap: true },
              ]}
            />
          </section>
        )}
      </div>
    </article>
  );
}

/** A patient's unified visit history across hospitals (the v_patient_timeline view). */
export function Timeline({
  entries,
  clickable = true,
}: {
  entries: TimelineEntry[];
  clickable?: boolean;
}) {
  if (entries.length === 0) return <Empty>No visits recorded yet.</Empty>;

  return (
    <ol className="timeline">
      {entries.map((e) => {
        const critical = e.labs.some((l) => assessLab(l.test_name, l.result).flag === "critical");
        return (
          <li key={e.visit_id} className={critical ? "attention" : undefined}>
            {clickable ? (
              <Link
                href={`/records/${e.visit_id}`}
                style={{ color: "inherit", textDecoration: "none", display: "block" }}
              >
                <TimelineCardContent entry={e} />
              </Link>
            ) : (
              <TimelineCardContent entry={e} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
