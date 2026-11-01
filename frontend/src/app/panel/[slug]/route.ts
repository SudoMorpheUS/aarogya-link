import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";

const getBackendUrl = (): string => {
  if (process.env.BACKEND_API_URL) return process.env.BACKEND_API_URL;
  return process.env.NODE_ENV === "production" ? "http://backend:8000" : "http://localhost:8000";
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!["results", "medicines", "care-team"].includes(slug)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // 1. Direct browser check: require X-Requested-With: XMLHttpRequest
  const xhr = request.headers.get("x-requested-with") || "";
  if (xhr.toLowerCase() !== "xmlhttprequest") {
    // Return 404 for direct browser visits as specified
    return new NextResponse("Not Found", { status: 404 });
  }

  // 2. Authentication check: return 401 if unauthenticated
  const session = await getSession();
  if (!session) {
    return new NextResponse("Authentication required", { status: 401 });
  }

  // 3. Forward to backend
  const base = getBackendUrl();
  const sessionCookie = (await cookies()).get("al_session")?.value || "";
  try {
    const backendRes = await fetch(`${base}/panel/${slug}`, {
      headers: {
        "X-Requested-With": "XMLHttpRequest",
        "X-Aarogya-Session": sessionCookie,
        ...(request.headers.get("authorization")
          ? { Authorization: request.headers.get("authorization")! }
          : {}),
      },
      cache: "no-store",
    });

    if (!backendRes.ok) {
      return new NextResponse(backendRes.statusText, { status: backendRes.status });
    }

    const html = await backendRes.text();
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: any) {
    return new NextResponse("Internal server error: " + (err?.message || "backend error"), { status: 500 });
  }
}
