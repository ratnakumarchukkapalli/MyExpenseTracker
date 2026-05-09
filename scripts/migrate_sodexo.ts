/**
 * One-time migration: tag May 2026 Swiggy expenses as sodexo, set sodexo_balance=4400.
 * Run AFTER the SQL migration (scripts/003_sodexo.sql) has been applied.
 *
 * Usage: npx tsx scripts/migrate_sodexo.ts
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const USER_ID = process.env.ADMIN_USER_ID!;

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function run() {
  // 1. Find all May 2026 Swiggy expenses
  const findUrl =
    `${SUPABASE_URL}/rest/v1/expenses` +
    `?user_id=eq.${USER_ID}` +
    `&date=gte.2026-05-01&date=lt.2026-06-01` +
    `&description=ilike.*swiggy*` +
    `&select=id,date,description,amount`;

  const findRes = await fetch(findUrl, { headers });
  const expenses: Array<{ id: number; date: string; description: string; amount: number }> =
    await findRes.json();

  if (!findRes.ok) {
    console.error("Failed to fetch expenses:", expenses);
    process.exit(1);
  }

  console.log(`Found ${expenses.length} Swiggy expense(s) in May 2026:`);
  for (const e of expenses) {
    console.log(`  [${e.id}] ${e.date} — ${e.description} — ₹${e.amount}`);
  }

  if (expenses.length === 0) {
    console.log("Nothing to update.");
  } else {
    // 2. Tag them all as sodexo
    const ids = expenses.map((e) => e.id);
    const patchUrl =
      `${SUPABASE_URL}/rest/v1/expenses` +
      `?user_id=eq.${USER_ID}` +
      `&id=in.(${ids.join(",")})`;

    const patchRes = await fetch(patchUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ payment_source: "sodexo" }),
    });

    if (!patchRes.ok) {
      const err = await patchRes.text();
      console.error("Failed to patch expenses:", err);
      process.exit(1);
    }
    console.log(`Marked ${ids.length} expense(s) as payment_source=sodexo`);
  }

  // 3. Set sodexo_balance=4400 on the May 2026 monthly_summary
  const summaryUrl =
    `${SUPABASE_URL}/rest/v1/monthly_summary` +
    `?user_id=eq.${USER_ID}&month=eq.5&year=eq.2026`;

  const summaryRes = await fetch(
    `${SUPABASE_URL}/rest/v1/monthly_summary?user_id=eq.${USER_ID}&month=eq.5&year=eq.2026&select=*`,
    { headers }
  );
  const rows: any[] = await summaryRes.json();
  const summary = rows[0];

  if (!summary) {
    console.error("No monthly_summary row found for May 2026");
    process.exit(1);
  }

  const sodexo_spent = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const sodexo_balance = 4400;
  // Fix remaining_amount: sodexo expenses were never in the bank
  const bank_expenses = Number(summary.total_expenses) - sodexo_spent;
  const remaining_amount =
    Number(summary.previous_month_remaining) +
    Number(summary.salary) +
    Number(summary.interest_income) -
    bank_expenses;

  const patchSummary = await fetch(summaryUrl, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      sodexo_balance,
      sodexo_spent,
      remaining_amount,
    }),
  });

  if (!patchSummary.ok) {
    const err = await patchSummary.text();
    console.error("Failed to patch monthly_summary:", err);
    process.exit(1);
  }

  console.log(`Updated May 2026 monthly_summary:`);
  console.log(`  sodexo_balance = ₹${sodexo_balance}`);
  console.log(`  sodexo_spent   = ₹${sodexo_spent}`);
  console.log(`  remaining_amount fixed: ₹${summary.remaining_amount} → ₹${remaining_amount}`);
  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
