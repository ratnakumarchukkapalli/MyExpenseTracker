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

/**
 * requireAuthFast — uses getSession() (local JWT decode, NO network call).
 * Safe for READ-ONLY (GET) routes. Saves ~192ms per request.
 * The JWT is still verified by Supabase RLS on every DB query.
 */
export async function requireAuthFast(): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    // Fallback to getUser() if session is not available in this context
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        user: null,
        supabase: null,
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    return { user, supabase, error: null };
  }

  return { user: session.user, supabase, error: null };
}
