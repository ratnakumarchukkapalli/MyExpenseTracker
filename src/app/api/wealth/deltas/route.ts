import { requireAuthFast } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

export const revalidate = 0;

// GET /api/wealth/deltas?month=&year= — SIP/stocks snapshot values for the
// prior month and the same month a year ago, so callers can derive MoM/YoY
// % change against their own already-known current-month value.
export async function GET(req: NextRequest) {
  const { user, supabase, error } = await requireAuthFast();
  if (error) return error;

  const month = Number(req.nextUrl.searchParams.get("month"));
  const year = Number(req.nextUrl.searchParams.get("year"));
  if (!month || !year || month < 1 || month > 12) {
    return Response.json({ error: "Invalid month/year" }, { status: 400 });
  }

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevMonthYear = month === 1 ? year - 1 : year;
  const prevYear = year - 1;

  const [prevMonthRes, prevYearRes] = await Promise.all([
    supabase
      .from("monthly_summary")
      .select("savings_sip, savings_shares")
      .eq("user_id", user.id)
      .eq("month", prevMonth)
      .eq("year", prevMonthYear)
      .maybeSingle(),
    supabase
      .from("monthly_summary")
      .select("savings_sip, savings_shares")
      .eq("user_id", user.id)
      .eq("month", month)
      .eq("year", prevYear)
      .maybeSingle(),
  ]);

  return Response.json({
    sip: {
      prevMonth: prevMonthRes.data?.savings_sip ?? null,
      prevYear: prevYearRes.data?.savings_sip ?? null,
    },
    stocks: {
      prevMonth: prevMonthRes.data?.savings_shares ?? null,
      prevYear: prevYearRes.data?.savings_shares ?? null,
    },
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
