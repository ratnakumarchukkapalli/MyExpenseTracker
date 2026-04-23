-- MET Webapp — Initial Schema Migration
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- All existing tables are empty so we DROP and recreate cleanly.

-- ============================================================
-- DROP EXISTING TABLES (all empty — safe to recreate)
-- ============================================================
DROP TABLE IF EXISTS subscription_payments CASCADE;
DROP TABLE IF EXISTS spending_insights CASCADE;
DROP TABLE IF EXISTS monthly_reports CASCADE;
DROP TABLE IF EXISTS financial_summary CASCADE;
DROP TABLE IF EXISTS ai_chat_history CASCADE;
DROP TABLE IF EXISTS category_budgets CASCADE;
DROP TABLE IF EXISTS insurance_policies CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS monthly_summary CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS loans CASCADE;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE expenses (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  description   TEXT NOT NULL,
  amount        NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  category      TEXT NOT NULL,
  is_auto_generated BOOLEAN DEFAULT FALSE,
  source_type   TEXT,        -- 'loan' | 'subscription' | 'iphone' | null
  source_id     BIGINT,
  iphone_import_id UUID,     -- dedup key for iMessage imports
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE monthly_summary (
  id                      BIGSERIAL PRIMARY KEY,
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month                   INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year                    INTEGER NOT NULL CHECK (year > 2000),
  salary                  NUMERIC(15,2) DEFAULT 0,
  total_expenses          NUMERIC(15,2) DEFAULT 0,
  remaining_amount        NUMERIC(15,2) DEFAULT 0,
  previous_month_remaining NUMERIC(15,2) DEFAULT 0,
  interest_income         NUMERIC(15,2) DEFAULT 0,
  savings_fd              NUMERIC(15,2) DEFAULT 0,
  savings_sip             NUMERIC(15,2) DEFAULT 0,
  savings_shares          NUMERIC(15,2) DEFAULT 0,
  savings_nps             NUMERIC(15,2) DEFAULT 0,
  savings_pf              NUMERIC(15,2) DEFAULT 0,
  cash_equivalents        NUMERIC(15,2) DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month, year)
);

CREATE TABLE subscriptions (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  amount        NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  renewal_date  TEXT,
  yearly_cost   NUMERIC(15,2),
  billing_type  TEXT DEFAULT 'monthly',
  status        TEXT DEFAULT 'active',
  category      TEXT,
  last_paid_date TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscription_payments (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id BIGINT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount          NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  paid_date       TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loans (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  amount      NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  due_day     INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  start_date  TEXT,
  end_date    TEXT,
  category    TEXT DEFAULT 'LOANS/CC',
  status      TEXT DEFAULT 'active',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE insurance_policies (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  insurer         TEXT NOT NULL,
  policy_number   TEXT,
  premium_amount  NUMERIC(15,2) NOT NULL CHECK (premium_amount >= 0),
  premium_mode    TEXT DEFAULT 'yearly',
  next_due_date   DATE,
  sum_assured     NUMERIC(15,2),
  notes           TEXT,
  status          TEXT DEFAULT 'active',
  last_paid_date  DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE category_budgets (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  budget_type   TEXT NOT NULL DEFAULT 'percentage',
  budget_value  NUMERIC(10,2) NOT NULL CHECK (budget_value >= 0),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

CREATE TABLE financial_summary (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month         INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year          INTEGER NOT NULL CHECK (year > 2000),
  fd_amount     NUMERIC(15,2) DEFAULT 0,
  sip_amount    NUMERIC(15,2) DEFAULT 0,
  shares_amount NUMERIC(15,2) DEFAULT 0,
  nps_amount    NUMERIC(15,2) DEFAULT 0,
  pf_amount     NUMERIC(15,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month, year)
);

CREATE TABLE monthly_reports (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year        INTEGER NOT NULL CHECK (year > 2000),
  report_data JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month, year)
);

CREATE TABLE spending_insights (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month         INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year          INTEGER NOT NULL CHECK (year > 2000),
  insights_data JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_chat_history (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_expenses_user_date ON expenses(user_id, date DESC);
CREATE INDEX idx_expenses_user_month ON expenses(user_id, date);
CREATE INDEX idx_monthly_summary_user ON monthly_summary(user_id, year DESC, month DESC);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id, status);
CREATE INDEX idx_loans_user ON loans(user_id, status);
CREATE INDEX idx_ai_chat_user_session ON ai_chat_history(user_id, session_id, created_at);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE spending_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_history ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES — one macro per table
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'expenses','monthly_summary','subscriptions','subscription_payments',
    'loans','insurance_policies','category_budgets','financial_summary',
    'monthly_reports','spending_insights','ai_chat_history'
  ] LOOP
    EXECUTE format('CREATE POLICY "%s_select" ON %I FOR SELECT USING (user_id = auth.uid())', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_insert" ON %I FOR INSERT WITH CHECK (user_id = auth.uid())', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_update" ON %I FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', tbl, tbl);
    EXECUTE format('CREATE POLICY "%s_delete" ON %I FOR DELETE USING (user_id = auth.uid())', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
-- AUTO-CLEANUP: delete AI chat history older than 7 days
-- pg_cron must be enabled first:
--   Dashboard → Database → Extensions → search "pg_cron" → enable
-- Then run this separately after enabling:
--
--   SELECT cron.schedule(
--     'cleanup-ai-chat-history',
--     '0 0 * * *',
--     $$DELETE FROM ai_chat_history WHERE created_at < NOW() - INTERVAL '7 days'$$
--   );
-- ============================================================

-- ============================================================
-- VERIFY
-- ============================================================
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
