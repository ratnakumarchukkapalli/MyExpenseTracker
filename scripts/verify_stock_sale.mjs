/**
 * Verifies the realized-gain invariant after a stock sale.
 *
 *   node scripts/verify_stock_sale.mjs            # snapshot the current state
 *   node scripts/verify_stock_sale.mjs --before   # write a baseline, then sell
 *   node scripts/verify_stock_sale.mjs --check    # compare against the baseline
 *
 * The point of --before/--check: net worth after a sale must move by
 * (sell_price - last_price) * qty - charges, NOT by realized_pnl. Those two
 * numbers differ by the entire unrealized gain, so eyeballing the dashboard
 * cannot tell you whether the invariant held. This does.
 */
import fs from "fs";

const BASELINE = "/tmp/met-stock-sale-baseline.json";
const NET_WORTH_KEYS = [
  "remaining_amount",
  "savings_fd",
  "savings_sip",
  "savings_shares",
  "savings_nps",
  "savings_pf",
];

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const q = async (path) => {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
};

const uid = env.ADMIN_USER_ID;
const rupees = (n) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function snapshot() {
  const [active] = await q(
    `monthly_summary?user_id=eq.${uid}&salary=gt.0&select=month,year&order=year.desc,month.desc&limit=1`
  );
  const [row] = await q(
    `monthly_summary?user_id=eq.${uid}&month=eq.${active.month}&year=eq.${active.year}&select=*`
  );
  const banks = await q(`bank_accounts?user_id=eq.${uid}&select=id,name,current_balance&order=id`);
  return {
    month: active.month,
    year: active.year,
    netWorth: NET_WORTH_KEYS.reduce((s, k) => s + Number(row[k] || 0), 0),
    fields: Object.fromEntries(NET_WORTH_KEYS.map((k) => [k, Number(row[k] || 0)])),
    banks: Object.fromEntries(banks.map((b) => [b.name, Number(b.current_balance)])),
  };
}

const mode = process.argv[2] ?? "--print";
const now = await snapshot();

if (mode === "--before") {
  fs.writeFileSync(BASELINE, JSON.stringify(now, null, 2));
  console.log(`Baseline written for ${now.month}/${now.year}: net worth ${rupees(now.netWorth)}`);
  console.log("Now make the sale, then run: node scripts/verify_stock_sale.mjs --check");
} else if (mode === "--check") {
  const before = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  const [sale] = await q(
    `stock_sales?user_id=eq.${uid}&reverted_at=is.null&select=*&order=id.desc&limit=1`
  );
  if (!sale) throw new Error("No non-reverted sale found");

  const qty = Number(sale.shares_sold);
  const expectedDelta =
    sale.last_price != null
      ? (Number(sale.sell_price) - Number(sale.last_price)) * qty - Number(sale.charges)
      : null;
  const actualDelta = now.netWorth - before.netWorth;

  console.log(`Sale: ${qty} ${sale.ticker} @ ${rupees(sale.sell_price)} (last ${rupees(sale.last_price)}), charges ${rupees(sale.charges)}`);
  console.log(`  gross ${rupees(sale.gross_proceeds)} · net ${rupees(sale.net_proceeds)} · realized P&L ${rupees(sale.realized_pnl)}`);
  console.log(`\nNet worth  before ${rupees(before.netWorth)}  →  after ${rupees(now.netWorth)}`);
  console.log(`  actual delta   ${rupees(actualDelta)}`);
  if (expectedDelta != null) console.log(`  expected delta ${rupees(expectedDelta)}   [(sell − last) × qty − charges]`);
  console.log(`  realized P&L   ${rupees(sale.realized_pnl)}   ← must NOT equal the delta`);

  for (const k of NET_WORTH_KEYS) {
    const d = now.fields[k] - before.fields[k];
    if (Math.abs(d) > 0.005) console.log(`  ${k.padEnd(17)} ${rupees(d)}`);
  }
  for (const [name, bal] of Object.entries(now.banks)) {
    const d = bal - (before.banks[name] ?? 0);
    if (Math.abs(d) > 0.005) console.log(`  bank:${name.padEnd(12)} ${rupees(d)}`);
  }

  const ok = expectedDelta != null && Math.abs(actualDelta - expectedDelta) < 1;
  const doubleCounted = Math.abs(actualDelta - Number(sale.realized_pnl)) < 1;
  console.log(
    doubleCounted
      ? "\n❌ FAIL — net worth moved by the realized gain. Invariant 1 is broken."
      : ok
        ? "\n✅ PASS — net worth moved by the real price delta, not the realized gain."
        : `\n⚠ Delta is off by ${rupees(actualDelta - (expectedDelta ?? 0))}. Check whether the cascade finished, or whether prices refreshed between snapshots.`
  );
} else {
  console.log(`Active budget month ${now.month}/${now.year}`);
  console.log(`Net worth ${rupees(now.netWorth)}`);
  for (const [k, v] of Object.entries(now.fields)) console.log(`  ${k.padEnd(17)} ${rupees(v)}`);
  for (const [name, bal] of Object.entries(now.banks)) console.log(`  bank:${name.padEnd(12)} ${rupees(bal)}`);
}
