-- SECURITY LOCKDOWN: Enable RLS and User-Isolation Policies

-- 1. Enable RLS on all financial tables
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE sip_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_holdings ENABLE ROW LEVEL SECURITY;

-- 2. Create "Owner Only" Policies for Expenses
CREATE POLICY "Users can only access their own expenses" 
ON expenses FOR ALL 
USING (auth.uid() = user_id);

-- 3. Create "Owner Only" Policies for Monthly Summary
CREATE POLICY "Users can only access their own summaries" 
ON monthly_summary FOR ALL 
USING (auth.uid() = user_id);

-- 4. Create "Owner Only" Policies for Subscriptions
CREATE POLICY "Users can only access their own subscriptions" 
ON subscriptions FOR ALL 
USING (auth.uid() = user_id);

-- 5. Create "Owner Only" Policies for Loans
CREATE POLICY "Users can only access their own loans" 
ON loans FOR ALL 
USING (auth.uid() = user_id);

-- 6. Create "Owner Only" Policies for SIP Funds
CREATE POLICY "Users can only access their own SIPs" 
ON sip_funds FOR ALL 
USING (auth.uid() = user_id);

-- 7. Create "Owner Only" Policies for Stock Holdings
CREATE POLICY "Users can only access their own stocks" 
ON stock_holdings FOR ALL 
USING (auth.uid() = user_id);
