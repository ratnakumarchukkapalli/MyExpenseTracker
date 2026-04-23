const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  // Get all monthly summaries for April to find the user
  const { data: aprilSummaries } = await supabase
    .from('monthly_summary')
    .select('*')
    .eq('month', 4)
    .eq('year', 2026);
    
  if (!aprilSummaries || aprilSummaries.length === 0) {
    console.log("No summaries found for April 2026");
    return;
  }
  
  const userId = aprilSummaries[0].user_id;
  console.log(`--- Audit for User ID: ${userId} ---`);
  
  // Get monthly summaries
  const { data: summaries } = await supabase
    .from('monthly_summary')
    .select('*')
    .eq('user_id', userId)
    .in('month', [3, 4])
    .eq('year', 2026)
    .order('month');
    
  console.log("\n--- Monthly Summaries ---");
  console.table(summaries);
  
  // Get expenses for April
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .gte('date', '2026-04-01')
    .lt('date', '2026-05-01');
    
  console.log("\n--- April Expenses (Summary) ---");
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const savingsExpenses = expenses.filter(e => e.category === 'Savings').reduce((sum, e) => sum + e.amount, 0);
  
  console.log(`Total Expenses: ${totalExpenses}`);
  console.log(`Savings Expenses: ${savingsExpenses}`);
  
  const fdExpenses = expenses.filter(e => e.category === 'Savings' && e.description.toLowerCase().includes('fd'));
  console.log(`FD Specific Expenses:`, fdExpenses);
}

run().catch(console.error);
