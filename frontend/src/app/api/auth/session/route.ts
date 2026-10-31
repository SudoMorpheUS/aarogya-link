import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { api, apiErrorMessage, apiErrorStatus } from "@/lib/api";
import { SESSION_COOKIE, encodeSession } from "@/lib/session";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["admin", "doctor", "patient"];
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://izgtbzxrruajihrbxzyx.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_K0QhQQfypHet-L8BQOV44Q_D_UvI51j";

type Lookup = { role: Role | null; id: string | null; name: string; email?: string; found?: boolean };

async function emailFromSupabase(accessToken: string): Promise<string | null> {
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_KEY },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = await response.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  return email || null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accessToken = String(body.accessToken || "").trim();
    const verifiedEmail = accessToken ? await emailFromSupabase(accessToken) : null;
    if (!verifiedEmail) {
      return NextResponse.json(
        { success: false, error: "A verified Supabase session is required." },
        { status: 401 },
      );
    }

    const isRegistration = Boolean(body.isRegistration);
    const requestedRole = (body.role as Role) || undefined;

    let lookup: Lookup | null = null;
    try {
      lookup = await api.lookupUser(verifiedEmail, accessToken);
    } catch (err) {
      const status = apiErrorStatus(err);
      if (status === 401 || status === 403) {
        return NextResponse.json({ success: false, error: apiErrorMessage(err) }, { status });
      }
      return NextResponse.json(
        { success: false, error: "Backend is unavailable. Please try again." },
        { status: 503 },
      );
    }
    const accountEmail = String(lookup.email || verifiedEmail).trim().toLowerCase();
    const existing = lookup.found ? lookup : null;

    if (body.checkOnly) {
      return NextResponse.json({ success: true, exists: Boolean(existing), role: existing?.role ?? null });
    }

    let role: Role;
    let id: string | null = null;
    let name: string = body.displayName || existing?.name || accountEmail.split("@")[0];

    if (isRegistration) {
      if (!requestedRole || !ROLES.includes(requestedRole)) {
        return NextResponse.json(
          { success: false, error: "A valid account role is required" },
          { status: 400 },
        );
      }
      if (existing && existing.role !== requestedRole) {
        return NextResponse.json(
          {
            success: false,
            error: `This email is already registered under the ${existing.role} role. Use a different email for the ${requestedRole} role.`,
          },
          { status: 409 },
        );
      }

      role = requestedRole;
      try {
        if (role === "admin") {
          await api.registerAdmin(accountEmail, name, accessToken);
        } else if (role === "doctor") {
          const doc = await api.createDoctor(
            {
              hospital_id: body.hospitalId || "HSP1001",
              full_name: name,
              specialization: body.specialization || "General Medicine",
              license_number: body.licenseNumber || undefined,
              email: accountEmail,
              contact_number: body.contactNumber || undefined,
            },
            accessToken,
          );
          id = doc.doctor_id;
          name = doc.full_name;
        } else {
          const pat = await api.registerPatient(
            {
              full_name: name,
              date_of_birth: body.dateOfBirth || "1995-01-01",
              gender: body.gender || "M",
              blood_group: body.bloodGroup || "O+",
              contact_number: body.contactNumber || "9800000000",
              email: accountEmail,
            },
            accessToken,
          );
          id = pat.patient_id;
          name = pat.full_name;
        }
      } catch (err) {
        return NextResponse.json(
          { success: false, error: apiErrorMessage(err) },
          { status: apiErrorStatus(err) },
        );
      }
      if (!id && role !== "admin") {
        const again = await api.lookupUser(accountEmail, accessToken);
        id = again.id;
        name = again.name || name;
      }
    } else {
      if (!existing || !existing.role) {
        return NextResponse.json(
          { success: false, error: "No account found for this email. Please create an account first." },
          { status: 404 },
        );
      }
      role = existing.role;
      id = existing.id;
      name = existing.name || name;
    }

    const sessionData = { role, id, email: accountEmail, displayName: name };

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, encodeSession(sessionData), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return NextResponse.json({ success: true, session: sessionData });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to establish session" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
    return NextResponse.json({ success: true, message: "Logged out" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Failed to log out" }, { status: 500 });
  }
}
