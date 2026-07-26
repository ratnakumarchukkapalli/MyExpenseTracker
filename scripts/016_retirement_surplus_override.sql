-- Migration: manual override for the auto-calculated retirement monthly surplus
-- Run in Supabase SQL editor

ALTER TABLE retirement_plan ADD COLUMN IF NOT EXISTS monthly_surplus_override NUMERIC(15,2);
