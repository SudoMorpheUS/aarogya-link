const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-08-02" or "2026-08-02T11:30:00" -> "02 Aug 2026" (string-based, no timezone shifts). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

export function formatDateTime(value: string): string {
  return value.length > 10 ? `${formatDate(value)}, ${value.slice(11, 16)}` : formatDate(value);
}

export function ageOn(dob: string, onDate: string): number {
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = onDate.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

export const GENDER_LABEL = { M: "Male", F: "Female", O: "Other" } as const;

export function initials(name: string): string {
  return name
    .replace(/^Dr\.\s*/, "")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const DAY_MS = 86_400_000;

/** Whole days from date `a` to date `b` (both YYYY-MM-DD or ISO date-times). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / DAY_MS);
}

export function addDays(date: string, days: number): string {
  const d = new Date(Date.parse(date.slice(0, 10)) + days * DAY_MS);
  return d.toISOString().slice(0, 10);
}

/** "90 days" / "2 weeks" / "3 months" -> number of days, or null when it can't be read. */
export function durationDays(duration: string): number | null {
  const m = /(\d+)\s*(day|week|month)/i.exec(duration);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2].toLowerCase() === "day" ? n : m[2].toLowerCase() === "week" ? n * 7 : n * 30;
}

/** Days remaining on a course that started on visitDate, or null if the duration cannot be read. */
export function courseDaysLeft(visitDate: string | null | undefined, duration: string | null | undefined): number | null {
  if (!visitDate || !duration) return null;
  const days = durationDays(duration);
  if (days === null) return null;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return daysBetween(today, addDays(visitDate, days));
}

/** "PAT-IN-1002" -> "ID ••••1002". Patient identifiers are masked until the user reveals them. */
export function maskId(id: string): string {
  return `ID ••••${id.slice(-4)}`;
}

export function maskPhone(phone: string): string {
  return `••••••${phone.slice(-4)}`;
}
