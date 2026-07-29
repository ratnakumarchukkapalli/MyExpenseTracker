/**
 * Restores July 2026's Kotak snapshot to 356554.53, undoing an incorrect
 * re-derivation.
 *
 * The mistake: scripts/fix_kotak_balance_july_aug.ts re-ran
 * snapshotBankBalancesForMonth for July after the Laurus sale credit had been
 * applied to the live balance. That function rolls today's balance backward by
 * adding back later expenses and subtracting later salary — but it cannot roll
 * back CREDITS (the blind spot documented at src/lib/bank-accounts.ts:50-53).
 * So the 175480.48 that landed on Jul 28 got baked into July, and the tile
 * jumped to 532829.76 — more than the account holds today, for a month that
 * had already closed.
 *
 * July's budget period closed on Jul 24 (August's salary is what closes it, per
 * getActiveBudgetMonth), so everything after that date belongs to August:
 *
 *   493904.16  today
 *  -175480.48  Laurus sale credit      (Jul 28, after close)
 *  -   794.75  other credits           (after close)
 *  + 38925.60  CC payment + LIC        (dated Aug 01, after close)
 *   ---------
 *   356554.53  = the value July held before the bad re-derivation
 *
 * Do NOT re-run snapshotBankBalancesForMonth for July while this sale sits in
 * the live balance — it will reintroduce the same error. The value is written
 * directly for that reason. bank_account_balances is display-only for closed
 * months and feeds no cascade, so no recalculation is needed.
 *
 * Usage: npx tsx scripts/restore_july_kotak_snapshot.ts
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

const BANK_NAME = "Kotak";
const CORRECT_BALANCE = 356554.53;
const MONTH = 7;
const YEAR = 2026;

async function run() {
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const userId = env.ADMIN_USER_ID;

  const { data: bank } = await supabase
    .from("bank_accounts")
    .select("id, name")
    .eq("user_id", userId)
    .eq("name", BANK_NAME)
    .maybeSingle();

  if (!bank) throw new Error(`Bank account "${BANK_NAME}" not found`);

  const { error } = await supabase
    .from("bank_account_balances")
    .update({ balance: CORRECT_BALANCE, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("bank_account_id", bank.id)
    .eq("month", MONTH)
    .eq("year", YEAR);

  if (error) throw new Error(error.message);

  const [{ data: snaps }, { data: accounts }] = await Promise.all([
    supabase
      .from("bank_account_balances")
      .select("bank_account_id, balance")
      .eq("user_id", userId)
      .eq("month", MONTH)
      .eq("year", YEAR),
    supabase.from("bank_accounts").select("id, name, current_balance").eq("user_id", userId),
  ]);

  const nameOf = Object.fromEntries((accounts ?? []).map((a) => [a.id, a.name]));
  console.log(`July ${YEAR} tiles (closed month, as at Jul 24 close):`);
  for (const s of snaps ?? []) console.log(`  ${nameOf[s.bank_account_id].padEnd(6)} ${s.balance}`);
  console.log("\nAugust tiles (active month, live):");
  for (const a of accounts ?? []) console.log(`  ${a.name.padEnd(6)} ${a.current_balance}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
