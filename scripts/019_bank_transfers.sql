-- Migration: transfer history + undo support for bank-accounts/transfer
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS bank_transfers (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_account_id BIGINT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  to_account_id   BIGINT NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  amount          NUMERIC(15,2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  reverted_at     TIMESTAMPTZ
);

ALTER TABLE bank_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_transfers_user_isolation" ON bank_transfers
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
