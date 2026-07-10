-- Migration: Loan reminder flag + outstanding balance tracking
-- Run in Supabase SQL editor

ALTER TABLE loans ADD COLUMN IF NOT EXISTS remind_me BOOLEAN DEFAULT false;
-- double precision, not REAL: REAL is single-precision float (~7 significant
-- digits) and silently rounds loan balances in the lakhs/crores range.
ALTER TABLE loans ADD COLUMN IF NOT EXISTS outstanding_balance DOUBLE PRECISION;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS outstanding_balance_asof TEXT;

-- Backfill: preserve current due-soon/overdue banner behavior, which was
-- previously hardcoded to loans named 'solar' or 'home loan'.
UPDATE loans SET remind_me = true WHERE lower(trim(name)) IN ('solar', 'home loan');
