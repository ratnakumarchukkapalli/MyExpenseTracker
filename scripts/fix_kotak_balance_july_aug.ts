/**
 * One-time: sets Kotak to the balance confirmed against the real account after
 * the Laurus Labs sale credit, then re-derives July's per-account snapshot.
 *
 * July's tile cannot be hand-written. bank_account_balances stores an
 * end-of-month figure, but bank_accounts holds a single running "as of now"
 * value, so July's number has to be rolled back out of today's balance:
 * snapshotBankBalancesForMonth adds back bank expenses dated after July and
 * subtracts salary already synced for a later month. Writing 493904.16 into
 * July directly would drop the ~38.9k of August expenses that have since
 * debited the account.
 *
 * Runs strictly sequentially — snapshot then cascade — for the same reason the
 * sell route does: both walk the same monthly_summary rows.
 *
 * Usage: npx tsx scripts/fix_kotak_balance_july_aug.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { snapshotBankBalancesForMonth, resyncCurrentMonthCascade } from "../src/lib/bank-accounts";

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
const NEW_BALANCE = 493904.16; // confirmed against the real account
const SNAPSHOT_MONTH = 7;
const SNAPSHOT_YEAR = 2026;

async function run() {
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const userId = env.ADMIN_USER_ID;

  const { data: bank } = await supabase
    .from("bank_accounts")
    .select("id, name, current_balance")
    .eq("user_id", userId)
    .eq("name", BANK_NAME)
    .maybeSingle();

  if (!bank) throw new Error(`Bank account "${BANK_NAME}" not found`);

  console.log(`${bank.name}: ${bank.current_balance} -> ${NEW_BALANCE}`);

  const { error } = await supabase
    .from("bank_accounts")
    .update({ current_balance: NEW_BALANCE, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", bank.id);

  if (error) throw new Error(error.message);

  await snapshotBankBalancesForMonth(supabase, userId, SNAPSHOT_MONTH, SNAPSHOT_YEAR);
  console.log(`Re-derived ${SNAPSHOT_MONTH}/${SNAPSHOT_YEAR} per-account snapshot.`);

  await resyncCurrentMonthCascade(supabase, userId);
  console.log("Active-month cascade re-run.");

  const { data: snaps } = await supabase
    .from("bank_account_balances")
    .select("bank_account_id, balance")
    .eq("user_id", userId)
    .eq("month", SNAPSHOT_MONTH)
    .eq("year", SNAPSHOT_YEAR);

  const { data: accounts } = await supabase
    .from("bank_accounts")
    .select("id, name, current_balance")
    .eq("user_id", userId);

  const nameOf = Object.fromEntries((accounts ?? []).map((a) => [a.id, a.name]));
  console.log(`\n${SNAPSHOT_MONTH}/${SNAPSHOT_YEAR} snapshot:`);
  for (const s of snaps ?? []) console.log(`  ${nameOf[s.bank_account_id]}: ${s.balance}`);
  console.log("\nLive balances:");
  for (const a of accounts ?? []) console.log(`  ${a.name}: ${a.current_balance}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
