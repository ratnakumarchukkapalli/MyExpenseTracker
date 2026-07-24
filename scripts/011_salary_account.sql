-- Migration: Designate a bank account as the salary-credit account
-- Run in Supabase SQL editor

-- When true, saving `salary` on monthly_summary auto-adjusts this account's
-- current_balance by the delta (see POST /api/monthly-summary/[month]/[year]).
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS is_salary_account BOOLEAN NOT NULL DEFAULT false;

-- Only one salary account per user at a time.
CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_one_salary_account_per_user
  ON bank_accounts (user_id)
  WHERE is_salary_account;
