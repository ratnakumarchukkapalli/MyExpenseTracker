-- Migration: optional real withdrawal phase for the retirement planner
-- Run in Supabase SQL editor

ALTER TABLE retirement_plan ADD COLUMN IF NOT EXISTS withdrawal_start_age INTEGER;
