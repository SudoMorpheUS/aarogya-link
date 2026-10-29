import { createClient, type User } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://izgtbzxrruajihrbxzyx.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_K0QhQQfypHet-L8BQOV44Q_D_UvI51j";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function signInWithEmailAndPassword(
  email: string,
  password: string,
): Promise<{ user: User | null; session: any; error?: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) {
    throw new Error(getFriendlySupabaseErrorMessage(error));
  }
  return { user: data.user, session: data.session };
}

export async function createUserWithEmailAndPassword(
  email: string,
  password: string,
  metadata?: Record<string, any>,
): Promise<{ user: User | null; session: any; error?: string }> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: metadata || {},
    },
  });

  if (error) {
    throw new Error(getFriendlySupabaseErrorMessage(error));
  }
  return { user: data.user, session: data.session };
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.warn("Supabase signOut error:", error.message);
  }
}

export function getFriendlySupabaseErrorMessage(error: any): string {
  const msg = (error?.message || error?.code || "").toLowerCase();

  if (msg.includes("invalid login credentials") || msg.includes("invalid-credential")) {
    return "Incorrect email or password. Please verify your credentials or register a new account.";
  }
  if (msg.includes("already registered") || msg.includes("already in use") || msg.includes("user_already_exists")) {
    return "An account with this email address already exists. Please sign in instead.";
  }
  if (msg.includes("email not confirmed")) {
    return "Email not confirmed. Please check your inbox or disable email confirmation in Supabase Auth settings.";
  }
  if (msg.includes("rate limit") || msg.includes("over_email_send_rate_limit")) {
    return "Email rate limit exceeded. In Supabase Dashboard -> Auth -> Providers -> Email, disable 'Confirm email' for instant signups.";
  }
  if (msg.includes("password should be at least")) {
    return "Password must be at least 6 characters long.";
  }
  if (msg.includes("valid email")) {
    return "Please enter a valid email address.";
  }
  return error?.message || "Authentication failed. Please try again.";
}

export type { User };
