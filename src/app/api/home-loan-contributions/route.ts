import { requireAuthFast } from "@/lib/auth-guard";

// GET /api/home-loan-contributions — read-only. Reconstructed from bank
// statements; does not touch expenses / monthly totals.
export async function GET() {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { data, error: dbError } = await supabase
    .from("home_loan_contributions")
    .select("id, contributed_date, source, amount, note")
    .eq("user_id", user.id)
    .order("contributed_date");

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  return Response.json(data ?? [], {
    headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
  });
}
