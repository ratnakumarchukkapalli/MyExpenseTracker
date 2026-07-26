-- Migration: optional base-salary override for the retirement planner
-- (lets annual_bonus_pct apply cleanly on top of a bonus-excluded figure,
-- instead of double-counting a bonus already baked into the trailing average)
-- Run in Supabase SQL editor

ALTER TABLE retirement_plan ADD COLUMN IF NOT EXISTS annual_salary_override NUMERIC(15,2);
