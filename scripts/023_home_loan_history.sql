-- Migration: Home loan payment history (read-only reference, from bank statements)
-- Run in Supabase SQL editor
--
-- This is deliberately separate from `expenses` / `loans` — it's a historical
-- record extracted from Kotak bank statements (Jan 2023 - Aug 2026) for the
-- home loan, which changed lender (Tata Capital Housing Finance -> IDBI Bank)
-- and narration format twice. It does NOT feed monthly totals, remaining-cash,
-- or savings figures — it's purely for visibility into what was actually paid.
--
-- A transition month can have rows from both lenders (e.g. Oct/Nov 2024), so
-- uniqueness is per (user, month, lender) rather than per (user, month).

CREATE TABLE IF NOT EXISTS home_loan_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL,                 -- first of month
  lender TEXT NOT NULL,                -- 'Tata Capital' | 'IDBI Bank'
  main_emi NUMERIC NOT NULL DEFAULT 0,       -- principal EMI (TATACAPHOUFINLTD / TCHHL...016 / IDBI ...07641)
  service_charge NUMERIC NOT NULL DEFAULT 0, -- smaller recurring piece (TCHIN...017 / IDBI ...07702)
  extra_debit NUMERIC NOT NULL DEFAULT 0,    -- one-off loan-related debits outside the two NACH lines above
  refund_credit NUMERIC NOT NULL DEFAULT 0,  -- refunds/credits received back from the lender (not counted as "paid")
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month, lender)
);

ALTER TABLE home_loan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own home loan history"
ON home_loan_history FOR ALL
USING (auth.uid() = user_id);

-- Seed: full history reconstructed from Kotak statements, Jan 2023 - Aug 2026.
-- main_emi + service_charge + extra_debit = actual amount debited that month.
-- refund_credit is shown for transparency but excluded from "total paid".
INSERT INTO home_loan_history (user_id, month, lender, main_emi, service_charge, extra_debit, refund_credit, note) VALUES
-- Tata Capital Housing Finance era
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-01-01', 'Tata Capital', 58733, 0,    0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-02-01', 'Tata Capital', 58733, 2421, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-03-01', 'Tata Capital', 58733, 2421, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-04-01', 'Tata Capital', 58733, 2421, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-05-01', 'Tata Capital', 85911, 2421, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-06-01', 'Tata Capital', 85911, 2421, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-07-01', 'Tata Capital', 85911, 2421, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-08-01', 'Tata Capital', 85911, 2421, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-09-01', 'Tata Capital', 95585, 2421, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-10-01', 'Tata Capital', 95585, 2421, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-11-01', 'Tata Capital', 95585, 2421, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-12-01', 'Tata Capital', 95585, 2421, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-01-01', 'Tata Capital', 95585, 2421, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-02-01', 'Tata Capital', 95585, 2421, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-03-01', 'Tata Capital', 95585, 2421, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-04-01', 'Tata Capital', 95585, 2454, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-05-01', 'Tata Capital', 95585, 2454, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-06-01', 'Tata Capital', 95585, 2454, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-07-01', 'Tata Capital', 95585, 2454, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-08-01', 'Tata Capital', 95585, 2454, 1770,  0,      'Extra UPI payments to Tata Capital Housing on 13 & 14 Aug 2024 (₹590 + ₹1,180)'),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-09-01', 'Tata Capital', 95585, 2504, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-10-01', 'Tata Capital', 95585, 2504, 0,     0,      'Last full Tata Capital NACH month — IDBI also took its first (partial) installment this month, see IDBI row'),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-11-01', 'Tata Capital', 95585, 2504, 27359, 102494, 'Final Tata Capital month. Extra debit = one-off "TATA CAPITAL HOUSING FIN ICICI B" charge. Refund = two NEFT credits (₹95,586 + ₹6,908) received back as part of the transfer to IDBI.'),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-12-01', 'Tata Capital', 0,     0,    0,     122570, 'No EMI — final refund credit (NEFT ₹1,22,570) from Tata Capital Housing Finance after the loan fully moved to IDBI Bank'),
-- IDBI Bank era
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-10-01', 'IDBI Bank',     22253, 0,    0,     0,      'First (partial) IDBI installment in the transition month — only the main EMI (...07641) started; the ₹1,349 piece (...07702) began the next month'),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-11-01', 'IDBI Bank',     93829, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-12-01', 'IDBI Bank',     93829, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-01-01', 'IDBI Bank',     93829, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-02-01', 'IDBI Bank',     93829, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-03-01', 'IDBI Bank',     93829, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-04-01', 'IDBI Bank',     93829, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-05-01', 'IDBI Bank',     76440, 1349, 0,     0,      'Main EMI dropped from ₹93,829 to ₹76,440 this month onward — confirm with IDBI whether this was a part-prepayment or a rate reset'),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-06-01', 'IDBI Bank',     76440, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-07-01', 'IDBI Bank',     76440, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-08-01', 'IDBI Bank',     76440, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-09-01', 'IDBI Bank',     76440, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-10-01', 'IDBI Bank',     76440, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-11-01', 'IDBI Bank',     76440, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-12-01', 'IDBI Bank',     76440, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2026-01-01', 'IDBI Bank',     76440, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2026-02-01', 'IDBI Bank',     76440, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2026-03-01', 'IDBI Bank',     76440, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2026-04-01', 'IDBI Bank',     76440, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2026-05-01', 'IDBI Bank',     76440, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2026-06-01', 'IDBI Bank',     76440, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2026-07-01', 'IDBI Bank',     76440, 1349, 0,     0,      NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2026-08-01', 'IDBI Bank',     76440, 1349, 0,     0,      NULL)
ON CONFLICT (user_id, month, lender) DO NOTHING;
