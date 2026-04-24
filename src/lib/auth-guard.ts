import { createSupabaseServerClient } from "./supabase/server";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type AuthResult =
  | { user: User; supabase: SupabaseClient; error: null }
  | { user: null; supabase: null; error: NextResponse };

export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      supabase: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { user, supabase, error: null };
}

// requireAuthFast — previously used getSession() but that's insecure on the server
// (cookie value is not verified against Supabase Auth servers).
// Now delegates to requireAuth which uses getUser() for proper server-side validation.
export async function requireAuthFast(): Promise<AuthResult> {
  return requireAuth();
}
