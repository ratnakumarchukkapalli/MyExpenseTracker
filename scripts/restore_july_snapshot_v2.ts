/**
 * Restores July 2026's frozen portfolio snapshot after a second clobber.
 *
 * On 2026-08-01T11:00:28Z July's savings_sip/savings_shares were overwritten with
 * today's live totals again — one of the three routes that still passed a
 * client-supplied month straight into syncMonthlyWealthSnapshot (stocks
 * POST/PUT/DELETE, sip transactions) fired while the Stocks tab was open on July.
 * The guard added to syncMonthlyWealthSnapshot now makes that a no-op, so this
 * restore should hold.
 *
 * Values restored are the ones July carried before the clobber:
 *   savings_shares 378,553.80 = 3 surviving holdings + Laurus Labs @ 1784 x 100
 *   savings_sip    762,682.65
 *
 * Does NOT cascade: cascadeUpdateFutureMonths propagates savings_sip/savings_shares
 * unconditionally, so cascading from July would push the frozen figures into
 * August and re-add a position that is sold. August's own live values are correct
 * and must stay untouched.
 *
 * Usage: npx tsx scripts/restore_july_snapshot_v2.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const MONTH = 7;
const YEAR = 2026;
const SAVINGS_SHARES = 378553.80;
const SAVINGS_SIP = 762682.65;

async function run() {
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const userId = env.ADMIN_USER_ID;

  const { data: row } = await supabase
    .from("monthly_summary")
    .select("id, remaining_amount, savings_fd, savings_sip, savings_shares, savings_nps, savings_pf")
    .eq("user_id", userId)
    .eq("month", MONTH)
    .eq("year", YEAR)
    .single();

  if (!row) throw new Error(`No monthly_summary row for ${MONTH}/${YEAR}`);

  console.log(`savings_shares ${row.savings_shares} -> ${SAVINGS_SHARES}`);
  console.log(`savings_sip    ${row.savings_sip} -> ${SAVINGS_SIP}`);

  const cash_equivalents =
    Number(row.remaining_amount) + Number(row.savings_fd) + SAVINGS_SIP + SAVINGS_SHARES;

  const { error } = await supabase
    .from("monthly_summary")
    .update({
      savings_shares: SAVINGS_SHARES,
      savings_sip: SAVINGS_SIP,
      cash_equivalents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (error) throw new Error(error.message);

  const KEYS = ["remaining_amount", "savings_fd", "savings_sip", "savings_shares", "savings_nps", "savings_pf"];
  const { data: months } = await supabase
    .from("monthly_summary")
    .select("*")
    .eq("user_id", userId)
    .eq("year", YEAR)
    .in("month", [6, 7, 8])
    .order("month");

  console.log("\nmonth   sip           shares        net worth      MoM");
  let prev: number | null = null;
  for (const r of months ?? []) {
    const nw = KEYS.reduce((s, k) => s + Number(r[k] || 0), 0);
    console.log(
      `${YEAR}-${String(r.month).padStart(2, "0")}  ${Number(r.savings_sip).toFixed(2).padStart(12)}  ` +
        `${Number(r.savings_shares).toFixed(2).padStart(12)}  ${nw.toFixed(2).padStart(12)}  ` +
        `${prev === null ? "" : (nw - prev).toFixed(2).padStart(12)}`
    );
    prev = nw;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
