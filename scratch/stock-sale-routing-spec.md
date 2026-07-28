# Feature: Sell a stock holding and route the proceeds (bank + multiple SIPs)

Implement this in MyExpenseTracker (Next.js + Supabase). Read `openspec/specs/04-business-rules.md`
and `openspec/specs/01-database-schema.md` first.

## Problem

`stock_holdings` stores only `shares` + `buy_price` (average cost). There is no sell path and no
transaction history — `/api/stocks/[id]` offers PUT and DELETE only. When I sell shares today the
only option is to edit shares down and manually patch a bank balance, which loses the realized gain
entirely and leaves no record for tax.

I want: sell N shares of a holding at a given price, have the tracker compute realized P&L, and
route the net proceeds to any mix of destinations — one or more bank accounts and/or one or more
SIP funds — in a single operation.

## Correctness invariants (get these right or net worth breaks)

1. **Realized P&L is reporting-only. Never add it to net worth.** The gain was already carried in
   net worth as unrealized (`savings_shares` = live `shares × current_price`). Crediting it again
   double-counts.
2. **Bank leg:** `savings_shares` falls by `qty × current_price`; `remaining_amount` rises by the
   net proceeds via the bank balance. Net worth moves by exactly
   `(sell_price − last_fetched_price) × qty − charges`. That is the correct real delta.
3. **SIP leg:** `savings_shares` falls, `savings_sip` rises by the same rupee amount. Net worth is
   flat. Correct — it's a reallocation.
4. **Never route proceeds through `salary` or `interest_income`.** It corrupts income analytics, and
   `remaining_amount` would count the proceeds twice once the wealth snapshot drops. The bank
   balance is the right lever: `resolveOpeningBalance` already derives `remaining_amount` from
   `bank_accounts.current_balance` for the active budget month.
5. Allocations must sum exactly to net proceeds. Enforce in Zod and in the UI.

## 1. Migration — `scripts/003_stock_sales.sql`

Match the id/user_id types used by the existing tables before running (check whether current tables
FK to `auth.users`; the schema spec just declares `user_id UUID NOT NULL`, so plain columns below).

```sql
create table if not exists public.stock_sales (
  id             bigint primary key generated always as identity,
  user_id        uuid not null,
  holding_id     bigint references public.stock_holdings(id) on delete set null,
  ticker         text not null,               -- denormalized so history survives holding deletion
  company_name   text,
  shares_sold    real not null check (shares_sold > 0),
  sell_price     real not null check (sell_price > 0),
  sell_date      text not null,               -- 'YYYY-MM-DD', matches existing date convention
  avg_buy_price  real not null,               -- snapshot of holding.buy_price at sale time
  gross_proceeds real not null,               -- shares_sold * sell_price
  charges        real not null default 0,     -- brokerage + STT + stamp + DP
  net_proceeds   real not null,               -- gross_proceeds - charges
  realized_pnl   real not null,               -- (sell_price - avg_buy_price) * shares_sold - charges
  broker         text,
  notes          text,
  reverted_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists stock_sales_user_date_idx
  on public.stock_sales (user_id, sell_date desc);

create table if not exists public.stock_sale_allocations (
  id                 bigint primary key generated always as identity,
  user_id            uuid not null,
  sale_id            bigint not null references public.stock_sales(id) on delete cascade,
  destination        text not null check (destination in ('bank','sip')),
  bank_account_id    bigint references public.bank_accounts(id) on delete set null,
  sip_fund_id        bigint references public.sip_funds(id) on delete set null,
  sip_transaction_id bigint references public.sip_transactions(id) on delete set null,
  amount             real not null check (amount > 0),
  created_at         timestamptz not null default now(),
  constraint alloc_target_matches_destination check (
    (destination = 'bank' and bank_account_id is not null and sip_fund_id is null)
    or
    (destination = 'sip' and sip_fund_id is not null and bank_account_id is null)
  )
);

create index if not exists stock_sale_allocations_sale_idx
  on public.stock_sale_allocations (sale_id);

alter table public.stock_sales enable row level security;
alter table public.stock_sale_allocations enable row level security;

create policy "own stock_sales" on public.stock_sales
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own stock_sale_allocations" on public.stock_sale_allocations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

RLS-enabled-without-a-policy is deny-all — that's what broke `insurance_policies`. Both policies
above are mandatory.

## 2. Extract the SIP transaction helper — `src/lib/sip-transactions.ts`

`src/app/api/sip/transactions/route.ts` lines 34–68 insert a `sip_transactions` row and bump
`sip_funds.units` / `invested_value`. The sell route needs identical behavior. Move it out:

```ts
export async function recordSipTransaction(
  supabase: SupabaseClient,
  userId: string,
  input: { fundId: number; date: string; units: number; nav: number; amount: number; type?: string }
): Promise<number>   // returns the new sip_transactions.id
```

Rewrite the existing POST to call it. No behavior change there — it's a pure extraction.

## 3. Zod schema — `src/lib/schemas/stock-sale.ts`

```ts
import { z } from "zod";

const Allocation = z.discriminatedUnion("destination", [
  z.object({
    destination: z.literal("bank"),
    bank_account_id: z.number().int().positive(),
    amount: z.number().positive(),
  }),
  z.object({
    destination: z.literal("sip"),
    sip_fund_id: z.number().int().positive(),
    amount: z.number().positive(),
  }),
]);

export const StockSaleSchema = z
  .object({
    holding_id:  z.number().int().positive(),
    shares_sold: z.number().positive(),
    sell_price:  z.number().positive(),
    sell_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    charges:     z.number().min(0).default(0),
    broker:      z.string().max(100).optional().nullable(),
    notes:       z.string().max(500).optional().nullable(),
    allocations: z.array(Allocation).min(1),
  })
  .refine(
    (v) =>
      Math.abs(
        v.allocations.reduce((s, a) => s + a.amount, 0) -
          (v.shares_sold * v.sell_price - v.charges)
      ) < 0.01,
    { message: "Allocations must sum to net proceeds", path: ["allocations"] }
  );
```

## 4. Route — `src/app/api/stocks/sell/route.ts`

Model it on `src/app/api/bank-accounts/transfer/route.ts` — closest existing analog (money moving
between places, cascade-aware, reversible). Use `requireAuth` (it's a write).

**POST** — validate everything before mutating anything, since supabase-js has no transactions:

1. Load the holding scoped by `user_id`. 404 if missing.
2. Reject if `shares_sold > holding.shares` (400).
3. Load every referenced `bank_accounts.id` and `sip_funds.id` scoped by `user_id`; 404 if any is
   missing.
4. **Reject if any target SIP fund has a null/zero `current_nav`** (400, e.g. "Refresh NAV for
   {fund_name} before routing proceeds into it"). Otherwise `units = amount / 0` → `Infinity` and
   silently destroys the portfolio total.
5. Compute:
   - `gross_proceeds = shares_sold * sell_price`
   - `net_proceeds   = gross_proceeds - charges`
   - `realized_pnl   = (sell_price - holding.buy_price) * shares_sold - charges`
6. Insert the `stock_sales` row (denormalize `ticker`, `company_name`, `avg_buy_price` from the
   holding).
7. Per allocation:
   - `bank` → `adjustBankAccountBalance(supabase, user.id, bank_account_id, +amount)`
   - `sip`  → `recordSipTransaction(..., { units: amount / fund.current_nav, nav: fund.current_nav,
     amount, date: sell_date, type: "LUMPSUM" })`, keep the returned id
   - insert the `stock_sale_allocations` row, storing `sip_transaction_id` where applicable
8. **Last**, mutate the holding: `shares -= shares_sold`. `buy_price` is unchanged — a partial sale
   at average cost does not move average cost. If the result is 0, delete the holding row. Doing
   this last means a mid-flight failure leaves the holding intact rather than destroyed.
9. In `after()`, **sequentially — not `Promise.all`**:
   ```ts
   after(async () => {
     const { syncMonthlyWealthSnapshot } = await import("@/lib/monthly-totals");
     await syncMonthlyWealthSnapshot(supabase, user.id, saleMonth, saleYear);
     const { resyncCurrentMonthCascade } = await import("@/lib/bank-accounts");
     await resyncCurrentMonthCascade(supabase, user.id);
   });
   ```
   Order matters: `syncMonthlyWealthSnapshot` computes `cash_equivalents` from the *stale*
   `remaining_amount`, so the bank resync has to land second to correct it. Running them in
   parallel races two cascades over the same `monthly_summary` rows.

**GET** — sales history with allocations joined, newest first, `reverted_at is null`. Feeds the
Realized Gains panel.

**DELETE `/api/stocks/sell/[id]`** — undo a mis-entered sale. Reverse each allocation (negative
`adjustBankAccountBalance`; delete the `sip_transactions` row and subtract its units/amount back off
`sip_funds`), restore `shares` on the holding (re-insert it if it was deleted, using the
denormalized fields), set `reverted_at`, then run the same sequential cascade.

## 5. UI — `src/components/StockTracker.tsx`

**"Sell" button** on each holding row → new `SellStockModal`:

- Header prefilled from the holding: ticker, company, shares available, avg buy price, last price.
- Inputs: quantity (max = shares held), sell price, sell date (**defaults to today**), charges.
- Live readout as they type: Gross → Charges → **Net proceeds**, and **Realized P&L** in green/red
  against avg buy price.
- Allocation rows, repeatable via "+ Add destination": a destination dropdown listing every bank
  account and every active SIP fund, plus an amount field. SIP options show current NAV; disable any
  fund with no NAV and label it "refresh NAV first".
- A running **"Unallocated: ₹X"** line. Save stays disabled until it is 0. Add a "Sell all → " quick
  preset that dumps the full net proceeds into one chosen destination.
- Warn inline if `sell_date`'s month is not the active budget month (see gotcha below).

**Realized Gains panel** below the holdings table: sales history with per-sale realized P&L, plus
FY-wise totals (Apr–Mar). Useful at tax time. Undo button per row wired to the DELETE route.

`SIPTracker.tsx` needs no change beyond confirming LUMPSUM rows render in the transactions table.

## 6. Gotchas specific to this codebase

- **Snapshot rule.** Past months read stored `savings_shares` / `savings_sip`; only the current
  month goes live. Back-dating a sale into a closed month will not move that month's snapshot and
  the numbers read wrong. Default the date to today and warn otherwise.
- **`snapshotBankBalancesForMonth` cannot roll back sale credits** — the same documented blind spot
  as transfers (`src/lib/bank-accounts.ts` lines 50–53). A sale credited after a month has closed
  shifts that month's recorded per-account split. Narrow window; note it in the doc comment rather
  than trying to fix it here.
- Reuse the `after()` + dynamic-import pattern already used by the stocks and SIP routes.

## 7. Acceptance checks

Real case — 100 Laurus Labs sold at ₹1,757.10, avg buy ₹1,200, no charges:

- `gross_proceeds` = 175,710 · `realized_pnl` = 55,710 · `net_proceeds` = 175,710.
- Route 100,000 → bank, 75,710 → two SIPs (50,000 + 25,710). Save succeeds only when Unallocated
  hits 0.
- After save: holding gone from StockTracker; `savings_shares` drops by the live value of those 100
  shares; that bank account's balance rises 100,000; both SIP funds gain units at their current NAV;
  `savings_sip` rises 75,710.
- **Net worth before vs after differs only by `(1757.10 − last_fetched_price) × 100`** — not by
  55,710. If it moved by the realized gain, invariant 1 is broken.
- Dashboard Carryover for following months reflects the +100,000 after the cascade.
- Undo restores all of it.

## 8. Also update

`openspec/specs/01-database-schema.md` (two new tables), `02-api-routes.md` (sell endpoints),
`03-components.md` (SellStockModal), and add the realized-P&L invariant to `04-business-rules.md`.
