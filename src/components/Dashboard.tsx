'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';

// NSE market hours: 9:15 AM – 3:30 PM IST, Mon–Fri
function isMarketHours(): boolean {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  // IST = UTC+330 minutes
  const istMinutes = Math.floor(now.getTime() / 60000) + 330;
  const timeOfDay = istMinutes % 1440; // minutes since midnight IST
  return timeOfDay >= 555 && timeOfDay <= 930; // 9:15 AM = 555, 3:30 PM = 930
}
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { X, Save } from 'lucide-react';
import BudgetSettingsModal from './BudgetSettingsModal';
import CategoryDrillDown from './CategoryDrillDown';
import { CATEGORY_COLORS } from '../constants/categories';

type Expense = {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  note?: string;
  payment_source?: string;
};

type Subscription = {
  id: number;
  name: string;
  amount: number;
  billing_type: string;
  renewal_date?: string;
  status?: string;
};

type MonthlySummary = {
  month: number;
  year: number;
  salary: number;
  previous_month_remaining: number;
  total_expenses?: number;
  totalExpenses?: number;
  remaining_amount: number;
  interest_income: number;
  savings_fd: number;
  savings_sip: number;
  savings_shares: number;
  savings_nps: number;
  savings_pf: number;
  cash_equivalents: number;
  sodexo_balance?: number;
  sodexo_spent?: number;
  sodexo_credit?: number;
};

type YearlyRow = {
  month: number;
  year: number;
  cash: number;
  fd: number;
  sip: number;
  shares: number;
  nps_pf: number;
  salary: number;
  savings?: number;
};

type LoanMilestone = {
  name: string;
  amount: number;
  end_date: string;
};

type FinancialFields = {
  salary: number;
  previous_month_remaining: number;
  interest_income: number;
  savings_fd: number;
  savings_sip: number;
  savings_shares: number;
  savings_nps: number;
  savings_pf: number;
  sodexo_balance: number;
  sodexo_credit: number;
};

type Props = {
  expenses: Expense[];
  subscriptions: Subscription[];
  monthlySummary: MonthlySummary | null;
  currentMonth: number;
  currentYear: number;
  prevMonthExpenses: Expense[];
  yearlyRows: YearlyRow[];
  initialCategoryBudgets: Array<{ category: string; budget_type: string; budget_value: number }>;
  initialLoanMilestones: LoanMilestone[];
  stockRefreshTick?: number;
  privacyMode?: boolean;
  onFinancialsUpdate?: (data: FinancialFields) => Promise<void>;
};

type BudgetMap = Record<string, { budget_type: string; budget_value: number }>;


const DEFAULT_PCT: Record<string, number> = {
  'HOME Purpose': 30,
  'LOANS/CC': 20,
  MonthlyBills: 15,
  Personal: 15,
  Savings: 25,
};

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getCurrentRemaining = (summary: MonthlySummary | null) =>
  summary?.remaining_amount ?? 0;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
}

const PRIVACY_MASK = '₹ ••••';

function Dashboard({ expenses, subscriptions, monthlySummary, currentMonth, currentYear, prevMonthExpenses, yearlyRows, initialCategoryBudgets, initialLoanMilestones, stockRefreshTick, privacyMode, onFinancialsUpdate }: Props) {
  const [prevMonthCategoryTotals, setPrevMonthCategoryTotals] = useState<Record<string, number>>(() =>
    (prevMonthExpenses ?? []).reduce((acc: Record<string, number>, e) => {
      acc[e.category] = (acc[e.category] || 0) + Number(e.amount || 0);
      return acc;
    }, {})
  );
  const [rawYearlyRows, setRawYearlyRows] = useState<YearlyRow[]>(yearlyRows ?? []);
  const [loanMilestones, setLoanMilestones] = useState<LoanMilestone[]>(initialLoanMilestones ?? []);
  const [categoryBudgets, setCategoryBudgets] = useState<BudgetMap>(() => {
    const map: BudgetMap = {};
    for (const row of initialCategoryBudgets ?? []) {
      map[row.category] = { budget_type: row.budget_type, budget_value: Number(row.budget_value) };
    }
    return map;
  });
  const [dashMounted, setDashMounted] = useState(false);
  const [showBudgetSettings, setShowBudgetSettings] = useState(false);
  const [showEditFinancials, setShowEditFinancials] = useState(false);
  const [savingFinancials, setSavingFinancials] = useState(false);
  const [liveWealth, setLiveWealth] = useState<{ sip: number; stocks: number; total: number } | null>(null);
  const [previousMonthExpenses, setPreviousMonthExpenses] = useState<Expense[]>(prevMonthExpenses ?? []);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const lastScrapeTimeRef = useRef<number>(
    typeof window !== 'undefined' ? Number(localStorage.getItem('lastStockScrapeTime') || 0) : 0
  );

  // Sync prev-month data when bootstrap delivers fresh props (month navigation)
  useEffect(() => {
    const totals = (prevMonthExpenses ?? []).reduce((acc: Record<string, number>, e) => {
      acc[e.category] = (acc[e.category] || 0) + Number(e.amount || 0);
      return acc;
    }, {});
    setPrevMonthCategoryTotals(totals);
    setPreviousMonthExpenses(prevMonthExpenses ?? []);
  }, [prevMonthExpenses]);

  useEffect(() => {
    setRawYearlyRows(yearlyRows ?? []);
  }, [yearlyRows]);

  useEffect(() => {
    setLoanMilestones(initialLoanMilestones ?? []);
  }, [initialLoanMilestones]);

  useEffect(() => { setDashMounted(true); }, []);

  // Load live portfolio — only after bootstrap delivers summary for the current month.
  // Deps are primitive month/year (not the summary object) to avoid firing on every
  // bootstrap refresh of the same month.
  useEffect(() => {
    if (!monthlySummary) return;
    const isCurrentMonth =
      monthlySummary.month === new Date().getMonth() + 1 &&
      monthlySummary.year === new Date().getFullYear();
    if (!isCurrentMonth) return;

    const loadLiveWealth = async () => {
      try {
        const res = await fetch('/api/wealth/total');
        if (res.ok) {
          const data = await res.json();
          setLiveWealth({
            sip: data.breakdown?.sip || 0,
            stocks: data.breakdown?.stocks || 0,
            total: data.live_portfolio_total || 0,
          });
        }

        // Optimistic lock: set the timestamp BEFORE the await so concurrent
        // invocations (e.g. navigating months while the fetch is in-flight) skip the scrape.
        const nowMs = Date.now();
        // 15 min throttle during market hours, 1 hour otherwise
        const throttleMs = isMarketHours() ? 900000 : 3600000;
        if (nowMs - lastScrapeTimeRef.current > throttleMs) {
          lastScrapeTimeRef.current = nowMs;
          localStorage.setItem('lastStockScrapeTime', String(nowMs));
          const refreshRes = await fetch('/api/stocks/refresh-prices', { method: 'POST' });
          if (refreshRes.ok) {
            const updatedRes = await fetch('/api/wealth/total');
            if (updatedRes.ok) {
              const updatedData = await updatedRes.json();
              setLiveWealth({
                sip: updatedData.breakdown?.sip || 0,
                stocks: updatedData.breakdown?.stocks || 0,
                total: updatedData.live_portfolio_total || 0,
              });
            }
          }
        }
      } catch (error) {
        console.error('Failed to load live wealth:', error);
      }
    };

    void loadLiveWealth();

    // Poll every 15 minutes while page is open during market hours
    const interval = setInterval(() => {
      if (isMarketHours()) void loadLiveWealth();
    }, 900000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthlySummary?.month, monthlySummary?.year]);

  // Month-end snapshot: when viewing the previous calendar month within the first 3 days of the
  // new month (day 1 = ideal, 2-3 cover weekends/holidays), snapshot live SIP+Stocks into that
  // month's monthly_summary record — once only (localStorage guard). The cascade in the POST
  // handler propagates the updated values to all future carry-forward months automatically.
  useEffect(() => {
    if (!monthlySummary || !onFinancialsUpdate) return;

    const now = new Date();
    const todayDay = now.getDate();
    const todayMonth = now.getMonth() + 1;
    const todayYear = now.getFullYear();

    if (todayDay > 3) return; // outside snapshot window

    const snapMonth = todayMonth === 1 ? 12 : todayMonth - 1;
    const snapYear  = todayMonth === 1 ? todayYear - 1 : todayYear;

    if (currentMonth !== snapMonth || currentYear !== snapYear) return; // not viewing prev month

    const key = `snapshot_${snapYear}_${String(snapMonth).padStart(2, '0')}`;
    if (typeof window !== 'undefined' && localStorage.getItem(key) === 'done') return;

    const doSnapshot = async () => {
      try {
        const res = await fetch('/api/wealth/total');
        if (!res.ok) return;
        const data = await res.json();

        await onFinancialsUpdate({
          salary:                    Number(monthlySummary.salary                    ?? 0),
          previous_month_remaining:  Number(monthlySummary.previous_month_remaining  ?? 0),
          interest_income:           Number(monthlySummary.interest_income           ?? 0),
          savings_fd:                Number(monthlySummary.savings_fd                ?? 0),
          savings_sip:               data.breakdown?.sip    ?? Number(monthlySummary.savings_sip    ?? 0),
          savings_shares:            data.breakdown?.stocks ?? Number(monthlySummary.savings_shares ?? 0),
          savings_nps:               Number(monthlySummary.savings_nps               ?? 0),
          savings_pf:                Number(monthlySummary.savings_pf                ?? 0),
          sodexo_balance:            Number(monthlySummary.sodexo_balance            ?? 0),
          sodexo_credit:             Number(monthlySummary.sodexo_credit             ?? 0),
        });

        localStorage.setItem(key, 'done');
      } catch (e) {
        console.error('Month-end snapshot failed:', e);
      }
    };

    void doSnapshot();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth, currentYear]);

  // Re-fetch wealth when StockTracker manually refreshes prices
  useEffect(() => {
    if (!stockRefreshTick) return;
    fetch('/api/wealth/total', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setLiveWealth({ sip: data.breakdown?.sip || 0, stocks: data.breakdown?.stocks || 0, total: data.live_portfolio_total || 0 });
      })
      .catch(() => {});
  }, [stockRefreshTick]);

  const yearlySavings = useMemo(() => {
    const now = new Date();
    const isThisYear = currentYear === now.getFullYear();
    const thisMonth = now.getMonth() + 1;

    return rawYearlyRows.map(row => {
      if (isThisYear && row.month === thisMonth && liveWealth) {
        return {
          ...row,
          sip: liveWealth.sip,
          shares: liveWealth.stocks,
          // Recalculate savings for current month based on live portfolio?
          // Actually, 'savings' in the row might be different, but for net worth charts we care about components.
        };
      }
      return row;
    });
  }, [rawYearlyRows, liveWealth, currentYear]);

  const yearlyNetWorth = useMemo(() => {
    const now = new Date();
    const isThisYear = currentYear === now.getFullYear();
    const thisMonth = now.getMonth() + 1;

    return MONTHS_SHORT.map((name, index) => {
      const month = index + 1;
      const row = yearlySavings.find((item) => item.month === month);
      if (!row) return { month: name, total: 0 };
      
      return {
        month: name,
        total: Number(row.cash || 0) + Number(row.fd || 0) + Number(row.sip || 0) + Number(row.shares || 0) + Number(row.nps_pf || 0),
      };
    });
  }, [yearlySavings]);

  const categoryTotals = useMemo(() => {
    return expenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + Number(expense.amount || 0);
      return acc;
    }, {});
  }, [expenses]);

  const totalSavings = categoryTotals.Savings || 0;
  const totalExpensesOnly = Object.entries(categoryTotals)
    .filter(([category]) => category !== 'Savings')
    .reduce((sum, [, amount]) => sum + amount, 0);
  const totalExpenses = totalExpensesOnly + totalSavings;

  const currentCash = getCurrentRemaining(monthlySummary);
  const currentFD = Number(monthlySummary?.savings_fd || 0);
  const currentSIP = Number(monthlySummary?.savings_sip || 0);
  const currentShares = Number(monthlySummary?.savings_shares || 0);
  const currentNPS_PF = Number(monthlySummary?.savings_nps || 0) + Number(monthlySummary?.savings_pf || 0);

  const livePortfolio = liveWealth?.total ?? null;
  const dbPortfolio = currentSIP + currentShares;

  // Use live prices only for current month; past months use stored monthly snapshot
  const isCurrentMonth = currentMonth === new Date().getMonth() + 1 && currentYear === new Date().getFullYear();
  const portfolioTotal = (isCurrentMonth && livePortfolio !== null) ? livePortfolio : dbPortfolio;
  const displaySIP = (isCurrentMonth && liveWealth) ? liveWealth.sip : currentSIP;
  const displayShares = (isCurrentMonth && liveWealth) ? liveWealth.stocks : currentShares;

  // BANK BALANCE definition: For the UI, we'll show "Liquid Cash" as the bank balance.
  // We'll treat FD as a separate asset to avoid "duplication" confusion.
  const calculateBankBalance = () => currentCash;

  const calculateCashEquivalents = () => {
    return currentCash + currentFD + currentSIP + currentShares;
  };

  const calculateFutureSavings = () => currentNPS_PF;

  const dayOfMonth = Math.min(new Date().getDate(), new Date(currentYear, currentMonth, 0).getDate());
  const monthName = new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' });

  const nwSorted = yearlyNetWorth.filter((item) => {
    const index = MONTHS_SHORT.indexOf(item.month);
    return index !== -1 && index < currentMonth && item.total > 0;
  });
  const nwCurrent = nwSorted[nwSorted.length - 1]?.total || 0;
  const nwPrev = nwSorted[nwSorted.length - 2]?.total || 0;
  const nwMomAbs = nwCurrent - nwPrev;
  const nwMomPct = nwPrev > 0 ? ((nwCurrent - nwPrev) / nwPrev) * 100 : null;

  const prevCash = Number(monthlySummary?.previous_month_remaining ?? 0);
  const cashMomAbs = currentCash - prevCash;
  const cashMomPct = prevCash > 0 ? ((currentCash - prevCash) / prevCash) * 100 : null;

  const salary = Number(monthlySummary?.salary || 0);
  const sodexoBalance = Number(monthlySummary?.sodexo_balance || 0);
  // Prefer stored sodexo_spent (set by server-side recalc or migration) over live expense filter
  const sodexoSpentLive = expenses
    .filter((e) => e.payment_source === 'sodexo')
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const sodexoSpent = Number(monthlySummary?.sodexo_spent || 0) || sodexoSpentLive;
  const bankExpensesOnly = totalExpensesOnly - sodexoSpentLive;
  const totalIncome = salary + sodexoBalance;
  const spentPct = totalIncome > 0 ? Math.round((totalExpensesOnly / totalIncome) * 100) : 0;

  // CRITICAL: Final Net Worth calculation
  // Cash + FD + (SIP + Stocks) + (NPS + PF)
  const currentNetWorth = currentCash + currentFD + portfolioTotal + currentNPS_PF;

  const summaryText = salary > 0
    ? privacyMode
      ? `Spent ${spentPct}% of income this ${monthName}. Saved ${salary > 0 ? ((totalSavings / salary) * 100).toFixed(0) : '0'}% of salary. (amounts hidden)`
      : `You've spent ${formatCurrency(totalExpensesOnly)} this ${monthName} — ${
          totalExpensesOnly <= salary * 0.55
            ? `within budget. Cash balance is ${formatCurrency(currentCash)}.`
            : `${((totalExpensesOnly / salary - 0.55) * 100).toFixed(0)}% above the 55% envelope target.`
        } Saved ${formatCurrency(totalSavings)} (${((totalSavings / salary) * 100).toFixed(0)}% of salary).`
    : 'Update your salary in financials to unlock spending analysis and year-end projection.';

  const resolveBudget = (key: string) => {
    const budget = categoryBudgets[key];
    if (!budget) return salary * (DEFAULT_PCT[key] || 0) / 100;
    return (budget.budget_type === 'percentage' || budget.budget_type === 'percent')
      ? salary * budget.budget_value / 100
      : budget.budget_value;
  };

  const categoryDefinitions = [
    { key: 'HOME Purpose', label: 'HOME', color: '#8b5cf6' },
    { key: 'LOANS/CC', label: 'Loans', color: '#ef4444' },
    { key: 'MonthlyBills', label: 'Bills', color: '#f59e0b' },
    { key: 'Personal', label: 'Personal', color: '#3b82f6' },
    { key: 'Savings', label: 'Savings', color: '#10b981' },
  ].map((item) => ({ ...item, budget: resolveBudget(item.key) }));

  const budgetAlerts = privacyMode ? [] : categoryDefinitions
    .map((cat) => ({ ...cat, spent: categoryTotals[cat.key] || 0, pct: cat.budget > 0 ? (categoryTotals[cat.key] || 0) / cat.budget * 100 : 0 }))
    .filter((cat) => cat.pct >= 80 && cat.budget > 0);

  const upcomingRenewals = subscriptions
    .filter((sub) => sub.renewal_date && sub.status !== 'cancelled' && sub.status !== 'inactive')
    .map((sub) => ({ ...sub, renewal: new Date(sub.renewal_date as string) }))
    .filter((sub) => {
      const today = new Date();
      const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      return sub.renewal >= today && sub.renewal <= nextMonth;
    });

  const handleFinancialsSave = async (data: FinancialFields) => {
    if (!onFinancialsUpdate) return;
    setSavingFinancials(true);
    try {
      await onFinancialsUpdate(data);
      setShowEditFinancials(false);
    } finally {
      setSavingFinancials(false);
    }
  };

  return (
    <div className="fade-in" style={{ paddingBottom: 48 }}>
      {showBudgetSettings && (
        <BudgetSettingsModal
          salary={salary}
          onClose={() => setShowBudgetSettings(false)}
          onSaved={() => setShowBudgetSettings(false)}
        />
      )}

      {showEditFinancials && (
        <FinancialEditModal
          monthlySummary={monthlySummary}
          saving={savingFinancials}
          onSave={handleFinancialsSave}
          onClose={() => setShowEditFinancials(false)}
        />
      )}

      <div className="dash-hero">
        <div className="dash-hero-left">
          <div className="eyebrow">Net worth · {monthName} {currentYear}</div>
          <div className="dash-hero-number serif">
            {privacyMode ? '••••••' : Math.round(currentNetWorth).toLocaleString('en-IN')}
            {!privacyMode && <span className="dash-hero-rupee">₹</span>}
          </div>
          <div className="dash-hero-deltas">
            {!privacyMode && nwMomPct !== null && (
              <span className={`delta-pill ${nwMomAbs >= 0 ? 'pos' : 'neg'}`}>
                {nwMomAbs >= 0 ? '↑' : '↓'} {Math.abs(nwMomPct).toFixed(1)}% MoM
              </span>
            )}
            {!privacyMode && nwMomAbs !== 0 && (
              <span className="delta-pill">
                {nwMomAbs >= 0 ? '+' : ''}{formatCurrency(nwMomAbs)} since last month
              </span>
            )}
            <span className="delta-pill">{dayOfMonth} days · {expenses.length} txns</span>
          </div>
        </div>

      </div>

      <div className="grid-rings-row mb-8">
        <div className="pane rings-card">
          <div className="rings-title">
            <div className="eyebrow">This month</div>
            <div className="serif" style={{ fontSize: 22, margin: '4px 0 0', color: 'var(--ink)' }}>How am I doing?</div>
          </div>
          <div className="rings-flex">
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <svg width="200" height="200">
                {[
                  { value: bankExpensesOnly, target: salary,       color: '#ef4444', r: 80, sw: 11 },
                  { value: totalSavings,     target: salary,       color: '#22c55e', r: 62, sw: 11 },
                  { value: sodexoSpent,      target: sodexoBalance, color: '#f97316', r: 44, sw: 11 },
                ].map((ring, index) => {
                  const circumference = 2 * Math.PI * ring.r;
                  const pct = ring.target > 0 ? Math.min(ring.value / ring.target, 1) : 0;
                  const offset = circumference * (1 - pct);
                  return (
                    <g key={index}>
                      <circle cx="100" cy="100" r={ring.r} fill="none" stroke="var(--hairline)" strokeWidth={ring.sw} />
                      <circle
                        cx="100"
                        cy="100"
                        r={ring.r}
                        fill="none"
                        stroke={ring.color}
                        strokeWidth={ring.sw}
                        strokeDasharray={`${circumference} ${circumference}`}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        transform="rotate(-90 100 100)"
                      />
                    </g>
                  );
                })}
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div className="serif dash-hero-pct" style={{ fontSize: 34, lineHeight: 1, color: 'var(--ink)' }}>{spentPct}%</div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 3 }}>of income</div>
              </div>

            </div>

            <div className="rings-legend">
              {[
                { label: 'Spent (Bank)', value: bankExpensesOnly, color: '#ef4444' },
                { label: 'Sodexo used', value: sodexoSpent, color: '#f97316' },
                { label: 'Saved', value: totalSavings, color: '#22c55e' },
                { label: 'Salary', value: salary, color: 'var(--accent)' },
                ...(sodexoBalance > 0 ? [{ label: 'Sodexo allocated', value: sodexoBalance, color: '#f97316' }] : []),
                { label: 'Total used', value: totalExpenses, color: '#6b7280' },
              ].map((item) => (
                <div key={item.label} className="rings-legend-row" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="ring-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)', flex: 1 }}>{item.label}</div>
                  <div style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--ink)' }}>
                    {privacyMode ? PRIVACY_MASK : formatCurrency(item.value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pane stat-bar">
          <div className="stat-bar-row">
            <div className="eyebrow" style={{ color: 'var(--ink-soft)' }}>Cash balance</div>
            <div className="serif dash-stat-value" style={{ fontSize: 26, marginTop: 4, color: 'var(--ink)' }}>
              {privacyMode ? PRIVACY_MASK : formatCurrency(currentCash)}
            </div>
            {!privacyMode && cashMomPct !== null && (
              <div className="dash-hero-deltas" style={{ marginTop: 6 }}>
                <span className={`delta-pill ${cashMomAbs >= 0 ? 'pos' : 'neg'}`}>
                  {cashMomAbs >= 0 ? '↑' : '↓'} {Math.abs(cashMomPct).toFixed(1)}% MoM
                </span>
              </div>
            )}
          </div>
          <div className="hr" />
          <div className="stat-bar-row">
            <div className="eyebrow">Fixed Deposits</div>
            <div className="dash-stat-small" style={{ fontSize: 16, marginTop: 4, color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {privacyMode ? PRIVACY_MASK : formatCurrency(currentFD)}
            </div>
          </div>
          <div className="hr" />
          <div className="stat-bar-row">
            <div className="eyebrow">Investments</div>
            <div className="dash-stat-small" style={{ fontSize: 16, marginTop: 4, color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {privacyMode ? PRIVACY_MASK : formatCurrency(portfolioTotal)}
            </div>
          </div>
          <div className="hr" />
          <div className="stat-bar-row">
            <div className="eyebrow">Carryover</div>
            <div className="dash-stat-small" style={{ fontSize: 16, marginTop: 4, color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {privacyMode ? PRIVACY_MASK : formatCurrency(Number(monthlySummary?.previous_month_remaining ?? 0))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>from last month</div>
          </div>
          {sodexoBalance > 0 && (
            <>
              <div className="hr" />
              <div className="stat-bar-row">
                <div className="eyebrow" style={{ color: '#f97316' }}>Sodexo</div>
                <div className="dash-stat-small" style={{ fontSize: 16, marginTop: 4, color: '#f97316', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {privacyMode ? PRIVACY_MASK : formatCurrency(sodexoBalance - sodexoSpent)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-light)', marginTop: 2 }}>
                  {privacyMode ? PRIVACY_MASK : `${formatCurrency(sodexoSpent)} of ${formatCurrency(sodexoBalance)} used`}
                </div>
              </div>
            </>
          )}
          <div className="hr" />
          <div className="stat-bar-row">
            <div className="eyebrow">Future savings</div>
            <div className="dash-stat-small" style={{ fontSize: 16, marginTop: 4, color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {privacyMode ? PRIVACY_MASK : formatCurrency(currentNPS_PF)}
            </div>
          </div>
          <div className="hr" />
          <div className="stat-bar-row">
            <div className="eyebrow">Salary & Edit</div>
            <div className="dash-stat-small" style={{ fontSize: 16, marginTop: 4, color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {privacyMode ? PRIVACY_MASK : formatCurrency(salary)}
            </div>
            <button
              onClick={() => setShowEditFinancials(true)}
              className="cursor-pointer edit-financials-btn"
              style={{ marginTop: 6, fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', padding: 0, textAlign: 'left' }}
            >
              Edit financials →
            </button>
          </div>

        </div>
      </div>


      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 16 }}>
          <div className="eyebrow">Envelopes</div>
          <div className="serif" style={{ fontSize: 22, color: 'var(--ink)' }}>Categories this month</div>
          <button
            onClick={() => setShowBudgetSettings(true)}
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 12px',
              borderRadius: 8,
              border: '1px solid var(--hairline)',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--ink-muted)',
            }}
          >
            ✏️ Edit budgets
          </button>
        </div>
        {dashMounted && budgetAlerts.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {budgetAlerts.map((cat) => {
              const over = cat.pct > 100;
              return (
                <div
                  key={cat.key}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    background: over ? '#fef2f2' : '#fffbeb',
                    color: over ? '#b91c1c' : '#92400e',
                    border: `1px solid ${over ? '#fecaca' : '#fde68a'}`,
                  }}
                >
                  <span>{over ? '⬤' : '◆'}</span>
                  <span>{cat.label} — {cat.pct.toFixed(0)}% used{over ? ' · over budget' : ''}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">



          {categoryDefinitions.map((category) => {
            const spent = categoryTotals[category.key] || 0;
            const pct = category.budget > 0 ? Math.min(100, (spent / category.budget) * 100) : 0;
            const over = spent > category.budget && category.budget > 0;
            const prevSpent = prevMonthCategoryTotals[category.key] || 0;
            const trend = prevSpent > 0 ? ((spent - prevSpent) / prevSpent) * 100 : null;
            return (
              <div 
                key={category.key} 
                className="cat-card cursor-pointer group relative transition-all duration-200 hover:translate-y-[-2px] hover:shadow-lg active:scale-[0.97]" 
                style={{ ['--cat' as string]: category.color }}
                onClick={() => setSelectedCategory(category.key)}
              >
                <div className="cat-card-accent opacity-10 group-hover:opacity-20 transition-opacity" />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="eyebrow" style={{ color: category.color }}>{category.label}</div>
                    {trend !== null && (
                      <span className={`chip ${trend > 0 ? 'neg' : 'pos'} animate-in fade-in zoom-in-50 duration-300`} style={{ height: 18, padding: '0 6px', fontSize: 10, display: 'inline-flex', alignItems: 'center', borderRadius: 999 }}>
                        {trend > 0 ? '↑' : '↓'}{Math.abs(trend).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="serif mt-2 font-bold tabular-nums text-[var(--ink)] group-hover:text-[var(--accent)] transition-colors dash-cat-amount">
                    {privacyMode ? '••••' : spent >= 100000 ? `${(spent / 100000).toFixed(2)}L` : `₹${Math.round(spent / 1000)}K`}
                  </div>

                  <div className="text-[11px] text-[var(--ink-faint)] mt-1">
                    {privacyMode ? 'of ••••' : `of ${category.budget >= 100000 ? `${(category.budget / 100000).toFixed(1)}L` : `₹${Math.round(category.budget / 1000)}K`}`}
                  </div>
                  <div className="cat-progress mt-3 h-1.5 rounded-full bg-[var(--hairline)] overflow-hidden">
                    <div
                      className="cat-progress-fill h-full rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${pct}%`, background: over ? 'var(--neg)' : category.color }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10.5, color: 'var(--ink-faint)', fontWeight: 500 }}>
                    <span className={over ? 'text-[var(--neg)] font-bold' : ''}>{pct.toFixed(0)}% used</span>
                    <span>{over ? 'over budget' : spent === 0 ? '—' : privacyMode ? '••••' : `${formatCurrency(category.budget - spent)} left`}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pane" style={{ padding: '14px 20px', marginBottom: 24 }}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">



          {[
            { label: 'FD', value: monthlySummary?.savings_fd, dot: '#3b82f6' },
            { label: 'SIP', value: displaySIP, dot: '#8b5cf6' },
            { label: 'Shares', value: displayShares, dot: '#f59e0b' },
            { label: 'NPS', value: monthlySummary?.savings_nps, dot: '#6366f1' },
            { label: 'PF', value: monthlySummary?.savings_pf, dot: '#10b981' },
            { label: 'Interest', value: monthlySummary?.interest_income, dot: '#f97316' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: item.dot, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 10, color: 'var(--ink-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                  {privacyMode ? PRIVACY_MASK : formatCurrency(Number(item.value || 0))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <SavingsRatePanel
        yearlySavings={yearlySavings}
        loanMilestones={loanMilestones}
        currentMonth={currentMonth}
        currentYear={currentYear}
        privacyMode={privacyMode}
        formatCurrency={formatCurrency}
      />

      <NetWorthGrowthChart
        yearlySavings={yearlySavings}
        currentYear={currentYear}
        currentMonth={currentMonth}
        privacyMode={privacyMode}
        formatCurrency={formatCurrency}
      />

      <CategoryDrillDown
        isOpen={!!selectedCategory}
        onClose={() => setSelectedCategory(null)}
        category={selectedCategory}
        expenses={expenses.filter(e => e.category === selectedCategory)}
      />
    </div>
  );
}

const MONTHS_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function SavingsRatePanel({
  yearlySavings,
  loanMilestones,
  currentMonth,
  currentYear,
  privacyMode,
  formatCurrency,
}: {
  yearlySavings: YearlyRow[];
  loanMilestones: LoanMilestone[];
  currentMonth: number;
  currentYear: number;
  privacyMode?: boolean;
  formatCurrency: (n: number) => string;
}) {
  const pastMonths = yearlySavings.filter((m) => m.salary > 0);
  const ytdSavings = pastMonths.reduce((sum, m) => sum + (m.savings || 0), 0);
  const ytdSalary  = pastMonths.reduce((sum, m) => sum + (m.salary  || 0), 0);
  const ytdRate    = ytdSalary > 0 ? (ytdSavings / ytdSalary) * 100 : 0;

  const curData  = yearlySavings.find((m) => m.month === currentMonth);
  const curRate  = curData && curData.salary > 0 ? ((curData.savings || 0) / curData.salary) * 100 : 0;

  const avgMonthly      = pastMonths.length > 0 ? ytdSavings / pastMonths.length : 0;
  const remainingMonths = 12 - currentMonth;
  const projected       = Math.round(ytdSavings + avgMonthly * remainingMonths);

  const maxSavings = Math.max(...pastMonths.map((m) => m.savings || 0), 1);
  const MAX_BAR_PX = 64;

  // Group loan milestones by month
  const milestoneMap: Record<string, number> = {};
  loanMilestones.forEach((l) => {
    if (!l.end_date) return;
    const endMonth = l.end_date.slice(0, 7);
    milestoneMap[endMonth] = (milestoneMap[endMonth] || 0) + l.amount;
  });
  const upcomingMilestones = Object.entries(milestoneMap).sort(([a], [b]) => a.localeCompare(b));

  const rateColor = ytdRate >= 20 ? '#4ade80' : ytdRate >= 10 ? '#fbbf24' : '#f87171';

  return (
    <div className="pane" style={{ padding: '18px 20px', marginBottom: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div className="eyebrow" style={{ color: 'var(--ink-soft)' }}>Savings Rate</div>
          <div className="serif" style={{ fontSize: 18, marginTop: 2, color: 'var(--ink)' }}>{currentYear} savings ÷ salary</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: rateColor, fontVariantNumeric: 'tabular-nums' }}>{ytdRate.toFixed(1)}%</div>
          <div style={{ fontSize: 10, color: 'var(--ink-faint)' }}>YTD rate</div>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">



        {[
          { label: 'This Month', main: `${curRate.toFixed(1)}%`, sub: privacyMode ? PRIVACY_MASK : formatCurrency(curData?.savings || 0) },
          { label: 'Saved YTD',  main: privacyMode ? PRIVACY_MASK : formatCurrency(ytdSavings), sub: `${pastMonths.length} months` },
          { label: 'Dec Outlook', main: privacyMode ? PRIVACY_MASK : formatCurrency(projected), sub: 'at current rate' },
        ].map(({ label, main, sub }) => (
          <div key={label} style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 10, padding: '8px 10px' }}>
            <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{main}</div>
            <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 1 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Monthly savings bar chart */}
      <div style={{ marginBottom: upcomingMilestones.length > 0 ? 16 : 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Monthly savings</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: MAX_BAR_PX + 28 }}>
          {MONTHS_ABBR.map((name, idx) => {
            const month = idx + 1;
            const row = yearlySavings.find((m) => m.month === month);
            const sv = row?.savings || 0;
            const isFuture = month > currentMonth;
            const isCur = month === currentMonth;
            const barH = sv > 0 ? Math.max(Math.round((sv / maxSavings) * MAX_BAR_PX), 4) : 3;
            return (
              <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ fontSize: 8, color: 'var(--ink-faint)', height: 12, display: 'flex', alignItems: 'flex-end' }}>
                  {sv > 0 && !isFuture && !privacyMode ? (sv >= 100000 ? `₹${(sv/100000).toFixed(1)}L` : `₹${Math.round(sv/1000)}K`) : ''}
                </div>
                <div style={{
                  width: '100%', borderRadius: '2px 2px 0 0',
                  height: barH,
                  background: isFuture ? 'var(--hairline)' : isCur ? '#10b981' : '#6ee7b7',
                  transition: 'height 0.3s',
                }} />
                <div style={{ fontSize: 8, color: 'var(--ink-faint)' }}>{name}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* EMI milestones */}
      {upcomingMilestones.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            EMI relief coming — more to save
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {upcomingMilestones.map(([month, amount]) => {
              const [y, m] = month.split('-');
              const endIdx = parseInt(m) - 1;
              const freedIdx = (endIdx + 1) % 12;
              const freedYear = freedIdx === 0 ? parseInt(y) + 1 : parseInt(y);
              const freedLabel = `${MONTHS_ABBR[freedIdx]}${freedYear !== currentYear ? ` ${freedYear}` : ''}`;
              return (
                <div key={month} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 8, padding: '7px 12px' }}>
                  <span style={{ fontSize: 12, color: '#059669', fontWeight: 500 }}>⚡ From {freedLabel}</span>
                  <span style={{ fontSize: 12, color: '#047857', fontWeight: 700 }}>{privacyMode ? '+•••• /mo freed' : `+${formatCurrency(Math.round(amount))}/mo freed`}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function NetWorthGrowthChart({
  yearlySavings,
  currentYear,
  currentMonth,
  privacyMode,
  formatCurrency,
}: {
  yearlySavings: YearlyRow[];
  currentYear: number;
  currentMonth: number;
  privacyMode?: boolean;
  formatCurrency: (n: number) => string;
}) {
  const SEGMENTS = [
    { key: 'cash',   label: 'Cash',    color: '#10b981' },
    { key: 'fd',     label: 'FD',      color: '#3b82f6' },
    { key: 'sip',    label: 'SIP',     color: '#8b5cf6' },
    { key: 'shares', label: 'Shares',  color: '#f59e0b' },
    { key: 'nps_pf', label: 'NPS+PF',  color: '#4f46e5' },
  ] as const;

  const data = MONTHS_SHORT.map((name, i) => {
    if (i >= currentMonth) return null; // exclude future months (idx is 0-based, currentMonth is 1-based)
    const row = yearlySavings.find((r) => r.month === i + 1);
    if (!row) return null;
    const total = Number(row.cash || 0) + Number(row.fd || 0) + Number(row.sip || 0) + Number(row.shares || 0) + Number(row.nps_pf || 0);
    if (total === 0) return null;
    return {
      month: name,
      cash:   Number(row.cash || 0),
      fd:     Number(row.fd || 0),
      sip:    Number(row.sip || 0),
      shares: Number(row.shares || 0),
      nps_pf: Number(row.nps_pf || 0),
      total,
    };
  }).filter(Boolean) as Array<{ month: string; cash: number; fd: number; sip: number; shares: number; nps_pf: number; total: number }>;

  if (data.length < 1) return null;

  const firstVal = data[0].total;
  const lastVal  = data[data.length - 1].total;
  const growth   = lastVal - firstVal;
  const growthPct = firstVal > 0 ? ((growth) / firstVal) * 100 : 0;
  const isUp = growth >= 0;

  const fmtL = (v: unknown) => { if (privacyMode) return '••••'; const n = Number(v ?? 0); return n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${Math.round(n / 1000)}K`; };

  return (
    <div className="pane" style={{ padding: '18px 20px', marginBottom: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div className="eyebrow">Net Worth Growth</div>
        <div className="serif" style={{ fontSize: 18, marginTop: 2 }}>{currentYear} month-by-month</div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">



        <div>
          <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginBottom: 2 }}>Current Net Worth</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
            {privacyMode ? PRIVACY_MASK : formatCurrency(lastVal)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginBottom: 2 }}>Growth since Jan</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: isUp ? '#4ade80' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>
            {privacyMode ? PRIVACY_MASK : `${isUp ? '+' : ''}${formatCurrency(growth)}`}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginBottom: 2 }}>Change</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: isUp ? '#4ade80' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>
            {isUp ? '↑' : '↓'}{Math.abs(growthPct).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
        {SEGMENTS.map(({ key, label, color }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{label}</span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 20, right: 4, left: 0, bottom: 0 }} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--ink-faint)' }} axisLine={false} tickLine={false} />
          <YAxis
            tickFormatter={(v) => privacyMode ? '••••' : v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${Math.round(v / 1000)}K`}
            tick={{ fontSize: 9, fill: 'var(--ink-faint)' }}
            axisLine={false} tickLine={false} width={44}
          />
          <Tooltip
            formatter={(value, name) => [privacyMode ? PRIVACY_MASK : formatCurrency(Number(value ?? 0)), String(name).toUpperCase()]}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: 'var(--ink-muted)', fontWeight: 600 }}
          />
          {SEGMENTS.map(({ key, color }, idx) => (
            <Bar key={key} dataKey={key} stackId="nw" fill={color} radius={idx === SEGMENTS.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}>
              {idx === SEGMENTS.length - 1 && (
                <LabelList
                  dataKey="total"
                  position="top"
                  formatter={fmtL}
                  style={{ fontSize: 10, fill: 'var(--ink-faint)', fontVariantNumeric: 'tabular-nums' }}
                />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function FinancialEditModal({
  monthlySummary,
  saving,
  onSave,
  onClose,
}: {
  monthlySummary: MonthlySummary | null;
  saving: boolean;
  onSave: (data: FinancialFields) => Promise<void>;
  onClose: () => void;
}) {
  const sodexoCarry = Math.max(0, Number(monthlySummary?.sodexo_balance ?? 0) - Number(monthlySummary?.sodexo_credit ?? 0));

  const [form, setForm] = useState({
    salary: Number(monthlySummary?.salary ?? 0),
    previous_month_remaining: Number(monthlySummary?.previous_month_remaining ?? 0),
    interest_income: Number(monthlySummary?.interest_income ?? 0),
    savings_fd: Number(monthlySummary?.savings_fd ?? 0),
    savings_sip: Number(monthlySummary?.savings_sip ?? 0),
    savings_shares: Number(monthlySummary?.savings_shares ?? 0),
    savings_nps: Number(monthlySummary?.savings_nps ?? 0),
    savings_pf: Number(monthlySummary?.savings_pf ?? 0),
    sodexo_credit: Number(monthlySummary?.sodexo_credit ?? 0),
  });

  const fields: Array<{ key: keyof typeof form; label: string }> = [
    { key: 'salary', label: 'Monthly Salary' },
    { key: 'previous_month_remaining', label: 'Opening Cash' },
    { key: 'interest_income', label: 'Interest Income' },
    { key: 'savings_fd', label: 'Fixed Deposits' },
    { key: 'savings_sip', label: 'SIP Balance' },
    { key: 'savings_shares', label: 'Stocks Balance' },
    { key: 'savings_nps', label: 'NPS' },
    { key: 'savings_pf', label: 'PF' },
  ];

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-[24px] shadow-[0_32px_80px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col max-h-[90vh]" style={{ background: 'var(--pane-strong)', backdropFilter: 'blur(32px)', border: '1px solid var(--hairline)' }}>
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--hairline)', background: 'var(--accent-bg)' }}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--ink-faint)' }}>Financials</div>
            <h2 className="text-xl font-bold tracking-tight italic serif" style={{ color: 'var(--ink)' }}>Month-End Summary</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-all cursor-pointer"
            style={{ background: 'var(--hairline)', color: 'var(--ink-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-2 gap-x-6 gap-y-5">
            {fields.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>
                  {label}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-medium text-sm" style={{ color: 'var(--ink-muted)' }}>₹</span>
                  <input
                    type="number"
                    value={form[key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                    className="w-full pl-8 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-medium"
                    style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Sodexo Credit — custom field with carry hint */}
          <div className="mt-5">
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>
              Sodexo Credit This Month
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-medium text-sm" style={{ color: 'var(--ink-muted)' }}>₹</span>
              <input
                type="number"
                value={form.sodexo_credit}
                onChange={(e) => setForm((prev) => ({ ...prev, sodexo_credit: parseFloat(e.target.value) || 0 }))}
                className="w-full pl-8 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-medium"
                style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
              />
            </div>
            {sodexoCarry > 0 && (
              <p className="mt-1.5 text-[11px]" style={{ color: 'var(--ink-faint)' }}>
                + ₹{Math.round(sodexoCarry).toLocaleString('en-IN')} carried · effective balance ₹{Math.round(form.sodexo_credit + sodexoCarry).toLocaleString('en-IN')}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 mt-8">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-4 rounded-2xl font-bold text-sm transition-all cursor-pointer"
              style={{ background: 'var(--hairline)', color: 'var(--ink-muted)' }}
            >
              Cancel
            </button>
            <button
              onClick={() => onSave({ ...form, sodexo_balance: form.sodexo_credit + sodexoCarry })}
              disabled={saving}
              className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Updating…' : 'Save Financials'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
