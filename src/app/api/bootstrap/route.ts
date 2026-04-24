import { requireAuthFast } from "@/lib/auth-guard";
import { autoAdvanceSubscriptions } from "@/lib/subscriptions";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const month = Number(searchParams.get("month"));
  const year = Number(searchParams.get("year"));

  if (!month || !year) {
    return Response.json({ error: "Missing month/year" }, { status: 400 });
  }

  const m = String(month).padStart(2, "0");
  
  // Parallel fetch everything in ONE network round-trip from the server
  const [expensesRes, subscriptionsRes, summaryRes] = await Promise.all([
    supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", `${year}-${m}-01`)
      .lt("date", month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`)
      .order("date", { ascending: false }),
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id),
    // For summary, we use a fetch that might auto-carry forward (logic from summary route)
    // Actually, it's easier to just call the summary logic or duplicate it here.
    // For simplicity, let's just fetch the row. The client will handle the rest if missing.
    supabase
      .from("monthly_summary")
      .select("*")
      .eq("user_id", user.id)
      .eq("month", month)
      .eq("year", year)
      .maybeSingle()
  ]);

  const subscriptions = await autoAdvanceSubscriptions(supabase, user.id, subscriptionsRes.data ?? []);

  return Response.json({
    expenses: expensesRes.data ?? [],
    subscriptions: subscriptions,
    summary: summaryRes.data ?? null,
    user: {
      email: user.email ?? null,
      name: (user.user_metadata?.full_name as string | undefined) ?? null,
    },
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" }
  });
}
