const { createClient } = require('@supabase/supabase-client');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = '84b476e3-f8a4-432d-9486-da2425501ba4'; // Primary user

const supabase = createClient(supabaseUrl, supabaseKey);

async function auditWealth() {
  console.log('--- WEALTH AUDIT ---');

  // 1. SIP
  const { data: sips } = await supabase.from('sip_funds').select('fund_name, units, current_nav').eq('user_id', userId);
  const sipTotal = (sips || []).reduce((s, f) => s + (f.units * f.current_nav), 0);
  console.log(`SIP Total: ${sipTotal.toLocaleString()}`);

  // 2. Stocks
  const { data: stocks } = await supabase.from('stock_holdings').select('ticker, shares, current_price').eq('user_id', userId);
  const stockTotal = (stocks || []).reduce((s, st) => s + (st.shares * st.current_price), 0);
  console.log(`Stock Total: ${stockTotal.toLocaleString()}`);

  // 3. Summary
  const { data: summary } = await supabase.from('monthly_summary').select('*').eq('user_id', userId).eq('month', 4).eq('year', 2026).maybeSingle();
  console.log('Latest Summary:', summary);

  // 4. Expenses
  const { data: expenses } = await supabase.from('expenses').select('amount').eq('user_id', userId).gte('date', '2026-04-01').lt('date', '2026-05-01');
  const expTotal = (expenses || []).reduce((s, e) => s + e.amount, 0);
  console.log(`Monthly Expenses: ${expTotal.toLocaleString()}`);

  const cash = (summary?.previous_month_remaining || 0) + (summary?.salary || 0) + (summary?.interest_income || 0) - expTotal;
  const netWorth = sipTotal + stockTotal + cash + (summary?.savings_fd || 0) + (summary?.savings_nps || 0) + (summary?.savings_pf || 0);
  
  console.log('--- FINAL CALCULATION ---');
  console.log(`Calculated Net Worth: ${netWorth.toLocaleString()}`);
}

auditWealth();
