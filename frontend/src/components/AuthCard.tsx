"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, LogIn, UserPlus, Shield, Stethoscope, UserCheck, Sparkles, CheckCircle2 } from "lucide-react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "@/lib/supabase";
import type { Hospital, Role } from "@/lib/types";

interface AuthCardProps {
  hospitals: Hospital[];
}

const DEMO_PASSWORD = "AarogyaLink@123";

const DEMO_PERSONAS = [
  {
    label: "Mudit Jha",
    roleLabel: "Patient",
    email: "mudit@gmail.com",
    role: "patient" as Role,
  },
  {
    label: "Karthik Iyer",
    roleLabel: "Patient",
    email: "karthik.iyer@example.in",
    role: "patient" as Role,
  },
  {
    label: "Devansh Gupta",
    roleLabel: "Patient",
    email: "devansh.gupta@example.in",
    role: "patient" as Role,
  },
  {
    label: "Meera Nair",
    roleLabel: "Patient",
    email: "meera.nair@example.in",
    role: "patient" as Role,
  },
  {
    label: "Dr. Rohan Mehta",
    roleLabel: "Doctor",
    email: "rohan.mehta@example.in",
    role: "doctor" as Role,
  },
  {
    label: "Dr. Nisha Kapoor",
    roleLabel: "Doctor",
    email: "nisha.kapoor@example.in",
    role: "doctor" as Role,
  },
  {
    label: "Dr. Vikram Sharma",
    roleLabel: "Doctor",
    email: "vikram.sharma@example.in",
    role: "doctor" as Role,
  },
  {
    label: "Central Admin",
    roleLabel: "Administrator",
    email: "admin@arogyalink.in",
    role: "admin" as Role,
  },
];

export function AuthCard({ hospitals }: AuthCardProps) {
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [loading, setLoading] = useState(false);
  const [activePersonaEmail, setActivePersonaEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Common fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Registration fields
  const [role, setRole] = useState<Role>("patient");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("1995-06-15");
  const [gender, setGender] = useState<"M" | "F" | "O">("M");
  const [bloodGroup, setBloodGroup] = useState("B+");
  const [contactNumber, setContactNumber] = useState("9876543210");
  const [hospitalId, setHospitalId] = useState(hospitals[0]?.hospital_id ?? "HSP-01");
  const [specialization, setSpecialization] = useState("General Medicine");
  const [licenseNumber, setLicenseNumber] = useState("MCI-REG-5001");

  const quickLoginPersona = async (persona: (typeof DEMO_PERSONAS)[0]) => {
    setEmail(persona.email);
    setPassword(DEMO_PASSWORD);
    setActivePersonaEmail(persona.email);
    setError(null);
    setLoading(true);
    setSuccess(`Signing in as ${persona.label}...`);

    try {
      let accessToken: string | null = null;
      try {
        const signed = await signInWithEmailAndPassword(persona.email, DEMO_PASSWORD);
        accessToken = signed.session?.access_token ?? null;
      } catch {
        try {
          const created = await createUserWithEmailAndPassword(persona.email, DEMO_PASSWORD, {
            full_name: persona.label,
            role: persona.role,
          });
          accessToken = created.session?.access_token ?? null;
        } catch {}
      }
      if (!accessToken) {
        throw new Error("Supabase did not return a session for this account.");
      }

      const resp = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          role: persona.role,
          displayName: persona.label,
        }),
      });

      const data = await resp.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to establish session");
      }

      setSuccess(`Signed in as ${persona.label}! Loading dashboard...`);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Sign in failed");
      setLoading(false);
      setActivePersonaEmail(null);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      let userEmail = email.trim().toLowerCase();
      let displayName: string | null = null;
      let accessToken: string | null = null;

      try {
        const signed = await signInWithEmailAndPassword(userEmail, password);
        userEmail = signed.user?.email || userEmail;
        displayName = signed.user?.user_metadata?.full_name || null;
        accessToken = signed.session?.access_token ?? null;
      } catch (authErr: any) {
        const isDefaultPassword = password === DEMO_PASSWORD || password === "ArogyaLink@2026";
        if (isDefaultPassword) {
          try {
            const created = await createUserWithEmailAndPassword(userEmail, password, {
              full_name: userEmail.split("@")[0],
            });
            userEmail = created.user?.email || userEmail;
            displayName = created.user?.user_metadata?.full_name || null;
            accessToken = created.session?.access_token ?? null;
          } catch {}
        } else {
          throw authErr;
        }
      }
      if (!accessToken) {
        throw new Error("Supabase did not return a session. Check the email and password, then try again.");
      }

      let savedRole: string | null = null;
      try {
        savedRole =
          localStorage.getItem(`arogya_role_${userEmail}`) ||
          localStorage.getItem("arogya_last_role");
      } catch {}

      const resp = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          displayName,
          preferredRole: savedRole || undefined,
        }),
      });

      const res = await resp.json();
      if (!res.success) {
        throw new Error(res.error || "Failed to establish session");
      }

      try {
        if (res.session?.role) {
          localStorage.setItem(`arogya_role_${userEmail}`, res.session.role);
          localStorage.setItem("arogya_last_role", res.session.role);
        }
      } catch {}

      setSuccess("Authenticated successfully. Redirecting to dashboard...");
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Sign in failed");
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      let accessToken: string | null = null;

      try {
        const created = await createUserWithEmailAndPassword(cleanEmail, password, {
          full_name: fullName.trim(),
          role,
          date_of_birth: role === "patient" ? dateOfBirth : undefined,
          gender: role === "patient" ? gender : undefined,
          bloodGroup: role === "patient" ? bloodGroup : undefined,
          contactNumber: role === "patient" ? contactNumber : undefined,
          hospitalId: role === "doctor" ? hospitalId : undefined,
          specialization: role === "doctor" ? specialization : undefined,
          licenseNumber: role === "doctor" ? licenseNumber : undefined,
        });
        accessToken = created.session?.access_token ?? null;
      } catch (createErr: any) {
        if (!createErr.message?.includes("already exists") && !createErr.message?.includes("already registered")) {
          throw createErr;
        }
        try {
          const signed = await signInWithEmailAndPassword(cleanEmail, password);
          accessToken = signed.session?.access_token ?? null;
        } catch {
          throw createErr;
        }
      }
      if (!accessToken) {
        throw new Error("Supabase did not return a session, so the account profile was not created.");
      }

      try {
        localStorage.setItem(`arogya_role_${cleanEmail}`, role);
        localStorage.setItem("arogya_last_role", role);
      } catch {}

      const resp = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          displayName: fullName.trim(),
          role,
          isRegistration: true,
          dateOfBirth: role === "patient" ? dateOfBirth : undefined,
          gender: role === "patient" ? gender : undefined,
          bloodGroup: role === "patient" ? bloodGroup : undefined,
          contactNumber: role === "patient" ? contactNumber : undefined,
          hospitalId: role === "doctor" ? hospitalId : undefined,
          specialization: role === "doctor" ? specialization : undefined,
          licenseNumber: role === "doctor" ? licenseNumber : undefined,
        }),
      });

      const res = await resp.json();
      if (!res.success) {
        throw new Error(res.error || "Failed to create account profile");
      }

      setSuccess("Account created successfully! Redirecting...");
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Registration failed");
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-tabs" role="tablist" aria-label="Authentication Options">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          className={`auth-tab ${mode === "signin" ? "auth-tab--active" : ""}`}
          onClick={() => {
            setMode("signin");
            setError(null);
            setSuccess(null);
          }}
        >
          <LogIn size={18} aria-hidden="true" />
          <span>Sign In</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          className={`auth-tab ${mode === "register" ? "auth-tab--active" : ""}`}
          onClick={() => {
            setMode("register");
            setError(null);
            setSuccess(null);
          }}
        >
          <UserPlus size={18} aria-hidden="true" />
          <span>Create Account</span>
        </button>
      </div>

      <div className="card stack-sm">
        {error ? (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="notice" role="status" style={{ borderColor: "var(--blue-600)", background: "var(--blue-50)" }}>
            <CheckCircle2 size={16} aria-hidden="true" style={{ color: "var(--blue-700)", marginRight: 6 }} />
            {success}
          </p>
        ) : null}

        {mode === "signin" ? (
          <form onSubmit={handleSignIn} className="stack-sm">
            <div>
              <h2 style={{ fontSize: "var(--fs-lg)", marginBottom: 4 }}>Sign in with Email</h2>
              <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>
                Access unified health records, consents, and hospital portals with Supabase.
              </p>
            </div>

            <div className="input__container" data-label="EMAIL">
              <div className="shadow__input" />
              <input
                type="email"
                required
                autoComplete="email"
                className="input__search"
                placeholder="ENTER EMAIL ADDRESS"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="input__container" data-label="PASSWORD">
              <div className="shadow__input" />
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                className="input__search"
                placeholder="ENTER PASSWORD"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className="input__button__shadow"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "See password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                <span>{showPassword ? "HIDE" : "SHOW"}</span>
              </button>
            </div>

            <button type="submit" className="btn" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
              {loading && !activePersonaEmail ? "Authenticating with Supabase..." : "Sign in to AarogyaLink"}
            </button>

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "var(--fs-xs)", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-primary)" }}>
                    Demo Logins
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      padding: "1px 6px",
                      borderRadius: "4px",
                      background: "rgba(59, 130, 246, 0.15)",
                      color: "var(--blue-400)",
                      border: "1px solid rgba(59, 130, 246, 0.3)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    1-Click
                  </span>
                </div>
                <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>
                  Password: <code>{DEMO_PASSWORD}</code>
                </span>
              </div>
              <div className="persona-pills" role="group" aria-label="Demo login shortcuts">
                {DEMO_PERSONAS.map((p) => {
                  const isCurrent = activePersonaEmail === p.email;
                  return (
                    <button
                      key={p.email}
                      type="button"
                      disabled={loading}
                      className="persona-pill"
                      onClick={() => quickLoginPersona(p)}
                      title={`Click to immediately sign in as ${p.label} (${p.roleLabel})`}
                      style={{
                        background: isCurrent ? "rgba(59, 130, 246, 0.18)" : undefined,
                        borderColor: isCurrent ? "var(--blue-500)" : undefined,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                        <Sparkles size={12} aria-hidden="true" style={{ color: "var(--blue-500)", flexShrink: 0 }} />
                        <span className="truncate" style={{ fontWeight: 600 }}>
                          {p.label}
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          background: isCurrent ? "rgba(59, 130, 246, 0.3)" : "var(--bg-subtle, rgba(255, 255, 255, 0.05))",
                          color: isCurrent ? "var(--blue-300)" : "var(--text-muted, #888)",
                          border: isCurrent ? "1px solid var(--blue-400)" : "1px solid var(--border, #333)",
                          flexShrink: 0,
                          fontWeight: 500,
                        }}
                      >
                        {isCurrent ? "Signing in..." : p.roleLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="stack-sm">
            <div>
              <h2 style={{ fontSize: "var(--fs-lg)", marginBottom: 4 }}>Create AarogyaLink Account</h2>
              <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>
                Register with email and password, powered by Supabase Authentication.
              </p>
            </div>

            <fieldset className="field">
              <legend style={{ fontSize: "var(--fs-sm)", fontWeight: 600, marginBottom: 6 }}>Select Account Role</legend>
              <div className="role-selector">
                <button
                  type="button"
                  className={`role-btn ${role === "patient" ? "role-btn--active" : ""}`}
                  onClick={() => setRole("patient")}
                >
                  <UserCheck size={18} style={{ margin: "0 auto 4px" }} />
                  <div>Patient</div>
                </button>
                <button
                  type="button"
                  className={`role-btn ${role === "doctor" ? "role-btn--active" : ""}`}
                  onClick={() => setRole("doctor")}
                >
                  <Stethoscope size={18} style={{ margin: "0 auto 4px" }} />
                  <div>Doctor</div>
                </button>
                <button
                  type="button"
                  className={`role-btn ${role === "admin" ? "role-btn--active" : ""}`}
                  onClick={() => setRole("admin")}
                >
                  <Shield size={18} style={{ margin: "0 auto 4px" }} />
                  <div>Admin</div>
                </button>
              </div>
            </fieldset>

            <div className="input__container" data-label="FULL NAME">
              <div className="shadow__input" />
              <input
                type="text"
                required
                className="input__search"
                placeholder={role === "doctor" ? "DR. PRIYA KRISHNAN" : "ANANYA SHARMA"}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="input__container" data-label="EMAIL">
              <div className="shadow__input" />
              <input
                type="email"
                required
                autoComplete="email"
                className="input__search"
                placeholder="YOU@DOMAIN.IN"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="input__container" data-label="PASSWORD (MIN 6 CHARS)">
              <div className="shadow__input" />
              <input
                type={showPassword ? "text" : "password"}
                required
                className="input__search"
                placeholder="ENTER PASSWORD"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className="input__button__shadow"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "See password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                <span>{showPassword ? "HIDE" : "SHOW"}</span>
              </button>
            </div>

            <div className="input__container" data-label="CONFIRM PASSWORD">
              <div className="shadow__input" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                className="input__search"
                placeholder="REPEAT PASSWORD"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className="input__button__shadow"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                title={showConfirmPassword ? "Hide password" : "See password"}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                <span>{showConfirmPassword ? "HIDE" : "SHOW"}</span>
              </button>
            </div>

            {role === "patient" ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label className="field">
                    <span>Date of Birth</span>
                    <input
                      type="date"
                      required
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      disabled={loading}
                    />
                  </label>
                  <label className="field">
                    <span>Gender</span>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as "M" | "F" | "O")}
                      disabled={loading}
                    >
                      <option value="M">Male (M)</option>
                      <option value="F">Female (F)</option>
                      <option value="O">Other (O)</option>
                    </select>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label className="field">
                    <span>Blood Group</span>
                    <select
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      disabled={loading}
                    >
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Contact Number</span>
                    <input
                      type="tel"
                      required
                      placeholder="10-digit mobile"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      disabled={loading}
                    />
                  </label>
                </div>
              </>
            ) : null}

            {role === "doctor" ? (
              <>
                <label className="field">
                  <span>Affiliated Hospital</span>
                  <select
                    value={hospitalId}
                    onChange={(e) => setHospitalId(e.target.value)}
                    disabled={loading}
                  >
                    {hospitals.map((h) => (
                      <option key={h.hospital_id} value={h.hospital_id}>
                        {h.hospital_name} ({h.hospital_id})
                      </option>
                    ))}
                  </select>
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label className="field">
                    <span>Specialization</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Cardiology"
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      disabled={loading}
                    />
                  </label>
                  <label className="field">
                    <span>Medical License No.</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. MCI-DL-12345"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      disabled={loading}
                    />
                  </label>
                </div>
              </>
            ) : null}

            <button type="submit" className="btn" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
              {loading ? "Creating Supabase account..." : "Register & Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
