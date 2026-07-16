-- Migration: Credit card balance tracking
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS credit_cards (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  credit_limit    NUMERIC(15,2),
  current_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_cards_user_isolation" ON credit_cards
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Which card a credit_card-sourced expense is charged to. NULL for other
-- payment sources, and for pre-existing credit_card expenses logged before
-- this migration (they just won't count against any card's balance).
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS credit_card_id BIGINT REFERENCES credit_cards(id) ON DELETE SET NULL;
