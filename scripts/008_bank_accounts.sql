-- Migration: Bank account balance tracking
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS bank_accounts (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  current_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_accounts_user_isolation" ON bank_accounts
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Which account a bank-sourced expense was paid from. NULL for other payment
-- sources, and for pre-existing bank expenses logged before this migration.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS bank_account_id BIGINT REFERENCES bank_accounts(id) ON DELETE SET NULL;
