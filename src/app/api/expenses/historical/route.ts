import { requireAuth } from "@/lib/auth-guard";
import { NextRequest } from "next/server";

const VALID_CATEGORIES = [
  "Personal", "HOME Purpose", "LOANS/CC", "Savings", "MonthlyBills",
];

// GET /api/expenses/historical?months=6&excludeMonth=4&excludeYear=2026
// Returns category-wise monthly aggregates for ML / year-end projection
export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuth();
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const months       = Number(searchParams.get("months") ?? "6");
  const excludeMonth = Number(searchParams.get("excludeMonth") ?? "0");
  const excludeYear  = Number(searchParams.get("excludeYear") ?? "0");

  let endDate = new Date();
  if (excludeMonth && excludeYear) {
    endDate = new Date(excludeYear, excludeMonth - 1, 0); // last day of prev month
  }
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - months);

  const startStr = startDate.toISOString().split("T")[0];
  const endStr   = endDate.toISOString().split("T")[0];

  const { data, error: dbError } = await supabase
    .from("expenses")
    .select("category, date, amount")
    .eq("user_id", user.id)
    .gte("date", startStr)
    .lte("date", endStr);

  if (dbError) return Response.json({ error: dbError.message }, { status: 500 });

  // Aggregate by category + month (mirrors SQLite GROUP BY in main.js)
  const categoryData: Record<string, { month: number; year: number; amount: number; transactionCount: number }[]> = {};
  VALID_CATEGORIES.forEach((cat) => { categoryData[cat] = []; });

  const buckets: Record<string, { amount: number; count: number }> = {};
  for (const row of data ?? []) {
    const d = new Date(row.date);
    const key = `${row.category}|${d.getFullYear()}-${d.getMonth() + 1}`;
    if (!buckets[key]) buckets[key] = { amount: 0, count: 0 };
    buckets[key].amount += Number(row.amount);
    buckets[key].count  += 1;
  }

  for (const [key, val] of Object.entries(buckets)) {
    const [cat, ym] = key.split("|");
    const [y, m] = ym.split("-").map(Number);
    if (categoryData[cat]) {
      categoryData[cat].push({ month: m, year: y, amount: val.amount, transactionCount: val.count });
    }
  }

  for (const cat of Object.keys(categoryData)) {
    categoryData[cat].sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  }

  return Response.json(categoryData, {
    headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
  });
}
