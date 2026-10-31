import { getSession } from "@/lib/session";
import { api, apiErrorStatus } from "@/lib/api";
import { openChart, timeline } from "@/lib/store";

// Consent-gated unified history. The chart endpoint writes READ or DENIED.
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in required" }, { status: 401 });

  if (session.role === "patient" && session.id !== id) {
    return Response.json({ error: "You can only view your own history" }, { status: 403 });
  }
  if (session.role !== "patient" && session.role !== "doctor") {
    return Response.json({ error: "This history is available to the patient and their doctor" }, { status: 403 });
  }

  try {
    const chart = await api.getChart(id);
    return Response.json({
      patient_id: id,
      access: chart.access,
      visits: chart.timeline,
      recent_labs: chart.labs,
      source: "PostgreSQL 17 (via FastAPI)",
    });
  } catch (err) {
    const status = apiErrorStatus(err);
    if (status === 401 || status === 403) {
      return Response.json({ error: "No active consent or emergency override for this patient" }, { status: 403 });
    }
    if (session.role === "patient") {
      return Response.json({ patient_id: id, visits: timeline(id), source: "In-memory cache" });
    }
    const chart = openChart(id, session.id!);
    if (!chart.ok) return Response.json({ error: "Access denied" }, { status: 403 });
    return Response.json({
      patient_id: id,
      access: chart.level,
      visits: chart.timeline,
      recent_labs: chart.recentLabs,
      source: "In-memory cache",
    });
  }
}
