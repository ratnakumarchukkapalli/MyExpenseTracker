import { requireAuth } from "@/lib/auth-guard";

export async function GET() {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const today = new Date().toISOString().split("T")[0];

  const { data, error: dbError } = await supabase
    .from("loans")
    .select("name, amount, end_date")
    .eq("user_id", user.id)
    .eq("status", "active")
    .not("end_date", "is", null)
    .gte("end_date", today)
    .order("end_date");

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });
  return Response.json(data ?? [], {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
  });
}
