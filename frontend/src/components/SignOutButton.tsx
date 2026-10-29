"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { signOut as sbSignOut } from "@/lib/supabase";
import { signOut } from "@/lib/actions";

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      try {
        await sbSignOut();
      } catch (e) {
        console.warn("Supabase sign-out note:", e);
      }
      try {
        await fetch("/api/auth/session", { method: "DELETE" });
      } catch (e) {
        console.warn("Session delete note:", e);
      }
      try {
        await signOut();
      } catch (e) {
        console.warn("Server action sign out note:", e);
      }
      window.location.href = "/";
    });
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isPending}
      className="btn btn--secondary"
      style={{ width: "100%", justifyContent: "center" }}
    >
      <LogOut size={16} aria-hidden="true" />
      {isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}
