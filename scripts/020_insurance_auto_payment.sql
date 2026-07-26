-- Migration: insurance auto-payment (mirrors loans + subscriptions)
-- Run in Supabase SQL editor
--
-- Marking a premium paid used to only bump next_due_date, so the money never
-- showed up as spend and never left the bank account. Give insurance the same
-- treatment loans and subscriptions already have: a default debit account, and
-- a payment record linked to the expense it created so "Undo Payment" can
-- delete the exact expense instead of leaving the dates stale.

-- Which account a premium is auto-debited from when "Pay Now" is used.
-- NULL means no default set (Pay Now falls back to a plain, unattributed bank expense).
ALTER TABLE insurance_policies ADD COLUMN IF NOT EXISTS bank_account_id BIGINT REFERENCES bank_accounts(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS insurance_payments (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_id   BIGINT NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
  amount      NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  paid_date   DATE NOT NULL,
  -- Previous next_due_date, so undo restores the exact date Pay Now replaced
  -- rather than re-deriving it from premium_mode (which the user may have edited).
  prev_due_date DATE,
  expense_id  BIGINT REFERENCES expenses(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS insurance_payments_policy_idx
  ON insurance_payments (user_id, policy_id, paid_date DESC);

ALTER TABLE insurance_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insurance_payments_user_isolation" ON insurance_payments;
CREATE POLICY "insurance_payments_user_isolation" ON insurance_payments
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
