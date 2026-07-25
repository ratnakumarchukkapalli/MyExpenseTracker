-- Migration: per-month bank account balance snapshots
-- Run in Supabase SQL editor

-- bank_accounts.current_balance holds one running "as of now" value with no
-- month dimension, so a closed month's per-account split has nowhere to live —
-- the tiles ended up showing today's balances on every month tab. Transfers
-- mutate balances without writing an audit row (see bank-accounts/transfer),
-- so once movements accumulate a past split is unrecoverable. Capture it at the
-- moment a month stops being the active budget month instead.
CREATE TABLE IF NOT EXISTS bank_account_balances (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_account_id BIGINT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  month           SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            SMALLINT NOT NULL,
  balance         NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, bank_account_id, month, year)
);

CREATE INDEX IF NOT EXISTS bank_account_balances_month_idx
  ON bank_account_balances (user_id, year, month);

ALTER TABLE bank_account_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_account_balances_user_isolation" ON bank_account_balances
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
