-- Migration: Track whether a month's salary has already been credited to a
-- bank account, so the multi-month cascade doesn't double-count it.
-- Run in Supabase SQL editor

-- true once POST /api/monthly-summary/[month]/[year] has applied this row's
-- salary to the designated salary account (see cascadeUpdateFutureMonths).
ALTER TABLE monthly_summary ADD COLUMN IF NOT EXISTS salary_bank_synced BOOLEAN NOT NULL DEFAULT false;
