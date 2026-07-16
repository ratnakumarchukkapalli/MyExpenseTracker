-- Migration: Default bank account per subscription
-- Run in Supabase SQL editor

-- Which account a subscription is auto-debited from when "Pay Now" is used.
-- NULL means no default set (Pay Now falls back to a plain, unattributed bank expense).
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS bank_account_id BIGINT REFERENCES bank_accounts(id) ON DELETE SET NULL;
