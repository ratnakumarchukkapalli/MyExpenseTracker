-- Migration: Add Sodexo coupon support
-- Run in Supabase SQL editor

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_source TEXT DEFAULT 'bank';
ALTER TABLE monthly_summary ADD COLUMN IF NOT EXISTS sodexo_balance REAL DEFAULT 0;
ALTER TABLE monthly_summary ADD COLUMN IF NOT EXISTS sodexo_spent REAL DEFAULT 0;
