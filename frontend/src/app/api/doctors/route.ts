import { api } from "@/lib/api";
import { listDoctors } from "@/lib/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hospital = url.searchParams.get("hospital_id") || undefined;
  const q = url.searchParams.get("q") || undefined;
  try {
    const doctors = await api.getDoctors(hospital, 5000, q);
    return Response.json({ doctors, source: "PostgreSQL 17 (via FastAPI)" });
  } catch {
    let rows = listDoctors().filter((d) => !hospital || d.hospital_id === hospital);
    if (q) {
      const term = q.toLowerCase();
      rows = rows.filter((d) => d.full_name.toLowerCase().includes(term) || d.specialization.toLowerCase().includes(term));
    }
    return Response.json({ doctors: rows, source: "In-memory cache" });
  }
}
