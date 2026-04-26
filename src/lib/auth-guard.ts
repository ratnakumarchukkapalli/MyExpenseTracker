import { createSupabaseServerClient } from "./supabase/server";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type AuthResult =
  | { user: User; supabase: SupabaseClient; error: null }
  | { user: null; supabase: null; error: NextResponse };

// Middleware already calls getUser() (network round-trip to Supabase Auth) for every
// request and redirects unauthenticated users before the route handler runs.
// Route handlers can safely use getSession() which reads the already-validated JWT
// from the cookie locally — no extra network call, ~1ms vs ~200-400ms.
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    return {
      user: null,
      supabase: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { user: session.user, supabase, error: null };
}

export async function requireAuthFast(): Promise<AuthResult> {
  return requireAuth();
}
