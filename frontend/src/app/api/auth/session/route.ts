import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import * as store from "@/lib/store";
import { api, apiErrorMessage, apiErrorStatus } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/session";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["admin", "doctor", "patient"];

type Lookup = { role: Role | null; id: string | null; name: string; found?: boolean };

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawEmail = String(body.email || "").trim().toLowerCase();
    if (!rawEmail) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
    }

    // The FastAPI/PostgreSQL lookup is the source of truth. The in-memory store is
    // only a sign-in fallback when the backend cannot be reached at all.
    let lookup: Lookup | null = null;
    let backendDown = false;
    try {
      lookup = await api.lookupUser(rawEmail);
    } catch {
      backendDown = true;
    }
    const existing = lookup?.found ? lookup : null;

    // Used by the sign-up form before it creates the Firebase account.
    if (body.checkOnly) {
      if (backendDown) {
        return NextResponse.json({ success: false, error: "Backend is unavailable. Please try again." }, { status: 503 });
      }
      return NextResponse.json({ success: true, exists: Boolean(existing), role: existing?.role ?? null });
    }

    const isRegistration = Boolean(body.isRegistration);
    const requestedRole = (body.role as Role) || undefined;

    let role: Role;
    let id: string | null = null;
    let name: string = body.displayName || existing?.name || rawEmail.split("@")[0];

    if (isRegistration) {
      if (!requestedRole || !ROLES.includes(requestedRole)) {
        return NextResponse.json({ success: false, error: "A valid account role is required" }, { status: 400 });
      }
      if (backendDown) {
        return NextResponse.json(
          { success: false, error: "Backend is unavailable, so the account was not created. Please try again." },
          { status: 503 },
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
      // Each branch creates exactly one record, in that role's own table.
      try {
        if (role === "admin") {
          await api.registerAdmin(rawEmail, name);
        } else if (role === "doctor") {
          const doc = await api.createDoctor({
            hospital_id: body.hospitalId || "HSP1001",
            full_name: name,
            specialization: body.specialization || "General Medicine",
            license_number: body.licenseNumber || undefined,
            email: rawEmail,
            contact_number: body.contactNumber || undefined,
          });
          id = doc.doctor_id;
          name = doc.full_name;
        } else {
          const pat = await api.registerPatient({
            full_name: name,
            date_of_birth: body.dateOfBirth || "1995-01-01",
            gender: body.gender || "M",
            blood_group: body.bloodGroup || "O+",
            contact_number: body.contactNumber || "9800000000",
            email: rawEmail,
          });
          id = pat.patient_id;
          name = pat.full_name;
        }
      } catch (err) {
        return NextResponse.json({ success: false, error: apiErrorMessage(err) }, { status: apiErrorStatus(err) });
      }
    } else {
      // Sign-in: the email must already belong to an account; nothing is created here.
      const found = existing ?? (backendDown ? store.findUserByEmail(rawEmail) : null);
      if (!found || !found.role) {
        return NextResponse.json(
          { success: false, error: "No account found for this email. Please create an account first." },
          { status: 404 },
        );
      }
      role = found.role;
      id = found.id;
      name = found.name || name;
    }

    const sessionData = { role, id, email: rawEmail, displayName: name };

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, JSON.stringify(sessionData), {
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
