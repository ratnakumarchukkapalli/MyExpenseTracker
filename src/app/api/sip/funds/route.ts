import { requireAuthFast } from "@/lib/auth-guard";

// GET /api/sip/funds
export async function GET() {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { data, error: dbError } = await supabase
    .from("sip_funds")
    .select("*")
    .eq("user_id", user.id)
    .order("fund_type", { ascending: true })
    .order("fund_name", { ascending: true });

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json(data ?? []);
}
