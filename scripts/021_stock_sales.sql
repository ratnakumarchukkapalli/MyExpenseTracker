-- Migration: stock sale history + proceeds routing (bank / SIP)
-- Run in Supabase SQL editor
--
-- Two deliberate deviations from the original spec draft:
--
-- 1. Money columns are NUMERIC, not REAL. float4 carries ~7 significant digits,
--    so a real sale credit of 175480.49 does not round-trip (it lands on
--    175480.48). Anything above ~1,67,772 with paise is lossy, which is exactly
--    the range these rows live in. Share counts stay REAL to match
--    stock_holdings.shares / sip_transactions.units.
-- 2. user_id carries the same FK to auth.users(id) that every other table here
--    uses (bank_accounts, bank_transfers), rather than a bare uuid column.
--
-- ids are BIGSERIAL because stock_holdings.id, sip_funds.id, sip_transactions.id
-- and bank_accounts.id are all bigint (verified against live Supabase).

CREATE TABLE IF NOT EXISTS stock_sales (
  id             BIGSERIAL PRIMARY KEY,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  holding_id     BIGINT REFERENCES stock_holdings(id) ON DELETE SET NULL,
  ticker         TEXT NOT NULL,                -- denormalized so history survives holding deletion
  company_name   TEXT,
  shares_sold    REAL NOT NULL CHECK (shares_sold > 0),
  sell_price     NUMERIC(15,4) NOT NULL CHECK (sell_price > 0),
  sell_date      TEXT NOT NULL,                -- 'YYYY-MM-DD', matches existing date convention
  avg_buy_price  NUMERIC(15,4) NOT NULL,       -- snapshot of holding.buy_price at sale time
  last_price     NUMERIC(15,4),                -- holding.current_price at sale time. Two jobs:
                                               --   1. undo can restore a fully-sold holding's price,
                                               --      so savings_shares comes back intact
                                               --   2. makes the true net-worth delta auditable:
                                               --      (sell_price - last_price) * shares_sold - charges
  gross_proceeds NUMERIC(15,2) NOT NULL,       -- shares_sold * sell_price
  charges        NUMERIC(15,2) NOT NULL DEFAULT 0,  -- brokerage + STT + stamp + DP
  net_proceeds   NUMERIC(15,2) NOT NULL,       -- gross_proceeds - charges
  realized_pnl   NUMERIC(15,2) NOT NULL,       -- (sell_price - avg_buy_price) * shares_sold - charges
  broker         TEXT,
  notes          TEXT,
  reverted_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stock_sales_user_date_idx
  ON stock_sales (user_id, sell_date DESC);

CREATE TABLE IF NOT EXISTS stock_sale_allocations (
  id                 BIGSERIAL PRIMARY KEY,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sale_id            BIGINT NOT NULL REFERENCES stock_sales(id) ON DELETE CASCADE,
  destination        TEXT NOT NULL CHECK (destination IN ('bank','sip')),
  bank_account_id    BIGINT REFERENCES bank_accounts(id) ON DELETE SET NULL,
  sip_fund_id        BIGINT REFERENCES sip_funds(id) ON DELETE SET NULL,
  sip_transaction_id BIGINT REFERENCES sip_transactions(id) ON DELETE SET NULL,
  amount             NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT alloc_target_matches_destination CHECK (
    (destination = 'bank' AND bank_account_id IS NOT NULL AND sip_fund_id IS NULL)
    OR
    (destination = 'sip' AND sip_fund_id IS NOT NULL AND bank_account_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS stock_sale_allocations_sale_idx
  ON stock_sale_allocations (sale_id);

-- RLS enabled without a policy is deny-all — that is what broke insurance_policies.
-- Both policies below are mandatory, not optional hardening.
ALTER TABLE stock_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_sale_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_sales_user_isolation" ON stock_sales;
CREATE POLICY "stock_sales_user_isolation" ON stock_sales
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "stock_sale_allocations_user_isolation" ON stock_sale_allocations;
CREATE POLICY "stock_sale_allocations_user_isolation" ON stock_sale_allocations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
