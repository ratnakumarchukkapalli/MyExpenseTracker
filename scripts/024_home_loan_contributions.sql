-- Migration: Home loan contribution tracking (who funded how much)
-- Run in Supabase SQL editor
--
-- Read-only reference, same spirit as home_loan_history (023): reconstructed
-- from bank statements, does NOT touch expenses/monthly totals. Tracks money
-- received from Krishna Kishore during the home loan period so the app can
-- show "your own contribution" = total home loan paid - amount received here.

CREATE TABLE IF NOT EXISTS home_loan_contributions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contributed_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'Krishna Kishore',
  amount NUMERIC NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE home_loan_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own home loan contributions"
ON home_loan_contributions FOR ALL
USING (auth.uid() = user_id);

-- Seed: every UPI/NEFT credit from Krishna Kishore, Jan 2023 (first home loan
-- debit month) onward. The 17-Jul-2023 ₹20,000 credit is deliberately excluded
-- per instruction (not counted as a loan contribution).
INSERT INTO home_loan_contributions (user_id, contributed_date, source, amount, note) VALUES
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-07-16', 'Krishna Kishore', 2500,  NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-09-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-10-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-10-13', 'Krishna Kishore', 20000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-10-25', 'Krishna Kishore', 25000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-10-26', 'Krishna Kishore', 25000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-10-26', 'Krishna Kishore', 15000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2023-12-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-01-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-02-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-03-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-04-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-06-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-07-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-08-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-09-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-10-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-11-01', 'Krishna Kishore', 25000, 'One of three separate ₹25,000 UPIs same day (loan-transition month)'),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-11-01', 'Krishna Kishore', 25000, 'One of three separate ₹25,000 UPIs same day (loan-transition month)'),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-11-01', 'Krishna Kishore', 25000, 'One of three separate ₹25,000 UPIs same day (loan-transition month)'),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-11-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2024-12-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-01-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-02-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-03-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-04-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-05-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-06-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-07-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-08-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-09-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-10-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-11-10', 'Krishna Kishore', 30000, NULL),
('70cd90c9-163e-4df8-b0ba-de31983f0238', '2025-12-15', 'Krishna Kishore', 20000, NULL);
