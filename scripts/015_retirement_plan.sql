-- Migration: Retirement / FI corpus planner
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS retirement_plan (
  id                    BIGSERIAL PRIMARY KEY,
  user_id               UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_year            INTEGER NOT NULL,
  target_age            INTEGER NOT NULL DEFAULT 45,
  life_expectancy_age   INTEGER NOT NULL DEFAULT 85,
  pre_return_rate       NUMERIC(5,4) NOT NULL DEFAULT 0.12,
  post_return_rate      NUMERIC(5,4) NOT NULL DEFAULT 0.08,
  inflation_rate        NUMERIC(5,4) NOT NULL DEFAULT 0.06,
  salary_growth_rate    NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  annual_bonus_pct      NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE retirement_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retirement_plan_user_isolation" ON retirement_plan
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS retirement_milestones (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  target_year  INTEGER NOT NULL,
  amount       NUMERIC(15,2) NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE retirement_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retirement_milestones_user_isolation" ON retirement_milestones
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
