import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDoctor, getPatient } from "./store";
import type { Role, Session } from "./types";

export const SESSION_COOKIE = "al_session";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const SESSION_SECRET =
  process.env.SESSION_SECRET || "arogya-link-dev-session-secret-change-me";

type SessionPayload = Session & { exp?: number };

function sign(body: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
}

function signaturesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Serialise + sign a session for the httpOnly cookie. */
export function encodeSession(session: Session): string {
  const payload: SessionPayload = { ...session, exp: Date.now() + SESSION_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(raw: string): SessionPayload | null {
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature || !signaturesMatch(signature, sign(body))) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (typeof parsed.exp === "number" && Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const parsed = decodeSession(raw);
  if (!parsed) return null;

  const role = parsed.role;
  const id = parsed.id ?? null;
  const email = parsed.email ?? null;
  const displayName = parsed.displayName ?? null;

  if (role === "admin") {
    return {
      role: "admin",
      id: null,
      email: email || "admin@arogyalink.in",
      displayName: displayName || "Central Administrator",
    };
  }

  if (role === "doctor" && id) {
    const doc = getDoctor(id);
    return {
      role: "doctor",
      id,
      email: email || doc?.email || null,
      displayName: displayName || doc?.full_name || id,
    };
  }

  if (role === "patient" && id) {
    const pat = getPatient(id);
    return {
      role: "patient",
      id,
      email: email || pat?.email || null,
      displayName: displayName || pat?.full_name || id,
    };
  }

  return null;
}

export async function requireSession(allowed?: Role[]): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/");
  if (allowed && !allowed.includes(session.role)) redirect("/dashboard");
  return session;
}

export async function setSession(session: Session): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
