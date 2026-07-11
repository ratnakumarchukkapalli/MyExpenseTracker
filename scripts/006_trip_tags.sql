-- Migration: Add free-text tag support for grouping expenses (e.g. trips)
-- Run in Supabase SQL editor

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tag TEXT;
