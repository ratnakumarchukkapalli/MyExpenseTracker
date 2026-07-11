-- Migration: link subscription_payments to the expense they created
-- Run in Supabase SQL editor
-- Needed so "Undo Payment" can cleanly delete the exact expense a payment created,
-- instead of relying on manual deletion (which used to leave last_paid_date/renewal_date stale).

ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS expense_id BIGINT REFERENCES expenses(id) ON DELETE SET NULL;
