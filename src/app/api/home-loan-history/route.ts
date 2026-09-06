import { requireAuthFast } from "@/lib/auth-guard";

// GET /api/home-loan-history — read-only. Reconstructed from bank statements;
// does not touch expenses / monthly totals.
export async function GET() {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { data, error: dbError } = await supabase
    .from("home_loan_history")
    .select("id, month, lender, main_emi, service_charge, extra_debit, refund_credit, note")
    .eq("user_id", user.id)
    .order("month")
    .order("lender");

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  return Response.json(data ?? [], {
    headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
  });
}
