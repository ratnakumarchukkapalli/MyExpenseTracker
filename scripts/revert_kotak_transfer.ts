/**
 * One-time reversal: user mistakenly transferred ₹78,000 from ICICI (id 3) to
 * Kotak (id 2) in the app, but the real-world transfer only happens on the
 * 5th of the month (standing instruction) — so it hadn't actually moved yet.
 * Reverses using the same functions bank-accounts/transfer/route.ts uses.
 *
 * Usage: npx tsx scripts/revert_kotak_transfer.ts
 */
import { createClient } from "@supabase/supabase-js";
import { adjustBankAccountBalance, resyncCurrentMonthCascade } from "../src/lib/bank-accounts";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const USER_ID = process.env.ADMIN_USER_ID!;
const ICICI_ID = 3;
const KOTAK_ID = 2;
const AMOUNT = 78000;

async function run() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: before } = await supabase
    .from("bank_accounts")
    .select("id, name, current_balance")
    .eq("user_id", USER_ID)
    .in("id", [ICICI_ID, KOTAK_ID]);
  console.log("Before:", before);

  await adjustBankAccountBalance(supabase, USER_ID, KOTAK_ID, -AMOUNT);
  await adjustBankAccountBalance(supabase, USER_ID, ICICI_ID, AMOUNT);
  await resyncCurrentMonthCascade(supabase, USER_ID);

  const { data: after } = await supabase
    .from("bank_accounts")
    .select("id, name, current_balance")
    .eq("user_id", USER_ID)
    .in("id", [ICICI_ID, KOTAK_ID]);
  console.log("After:", after);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
