'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BootstrapData } from '@/lib/bootstrap-data';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Landmark,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Receipt,
  Shield,
  BarChart2,
  Sun,
  TrendingUp,
} from 'lucide-react';
import dynamic from 'next/dynamic';
// Dashboard is the default view — eager loaded so it renders with SSR data
import Dashboard from './Dashboard';
// Always-visible chrome — keep in the initial bundle
import MobileNav from './MobileNav';
import SessionTimeout from './SessionTimeout';
// All other views/modals are code-split: loaded only when the user navigates to them
const ExpenseForm = dynamic(() => import('./ExpenseForm'));
const ExpenseList = dynamic(() => import('./ExpenseList'));
const Subscriptions = dynamic(() => import('./Subscriptions'));
const SubscriptionForm = dynamic(() => import('./SubscriptionForm'));
const Loans = dynamic(() => import('./Loans'));
const LoanForm = dynamic(() => import('./LoanForm'));
const CreditCards = dynamic(() => import('./CreditCards'));
const Insurance = dynamic(() => import('./Insurance'));
const MonthlyReport = dynamic(() => import('./MonthlyReport'));
const Analytics = dynamic(() => import('./Analytics'));
const YearEndProjection = dynamic(() => import('./YearEndProjection'));
const SIPTracker = dynamic(() => import('./SIPTracker'));
const StockTracker = dynamic(() => import('./StockTracker'));
const LogoutConfirmModal = dynamic(() => import('./LogoutConfirmModal'));



type Expense = {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  note?: string;
  tag?: string;
  payment_source?: string;
  credit_card_id?: number | null;
  bank_account_id?: number | null;
};

type CreditCard = {
  id: number;
  name: string;
  credit_limit?: number | null;
  current_balance: number;
};

type BankAccount = {
  id: number;
  name: string;
  current_balance: number;
};

type Subscription = {
  id: number;
  name: string;
  amount: number;
  billing_type: string;
  renewal_date?: string;
  category?: string;
  status?: string;
  last_paid_date?: string;
  comments?: string;
  bank_account_id?: number | null;
};

type Loan = {
  id: number;
  name: string;
  amount: number;
  due_day: number;
  start_date?: string;
  end_date?: string;
  category?: string;
  status: string;
  comments?: string;
  remind_me?: boolean;
  outstanding_balance?: number;
  outstanding_balance_asof?: string;
  bank_account_id?: number | null;
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

type CategoryBudgetRow = {
  category: string;
  budget_type: string;
  budget_value: number;
};

type LoanMilestone = {
  name: string;
  amount: number;
  end_date: string;
};

type ViewId =
  | 'dashboard'
  | 'expenses'
  | 'analytics'
  | 'subscriptions'
  | 'loans'
  | 'insurance'
  | 'reports'
  | 'projection'
  | 'sip'
  | 'stocks';

const NAV_SECTIONS: Array<{
  label: string;
  items: Array<{ id: ViewId; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }>;
}> = [
  {
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'expenses', label: 'Expenses', icon: Receipt },
      { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    ],
  },
  {
    label: 'Commitments',
    items: [
      { id: 'subscriptions', label: 'Subscriptions', icon: Calendar },
      { id: 'loans', label: 'Loans & EMIs', icon: Landmark },
    ],
  },
  {
    label: 'Wealth',
    items: [
      { id: 'sip', label: 'SIP Tracker', icon: TrendingUp },
      { id: 'stocks', label: 'Stocks', icon: BarChart2 },
    ],
  },
  {
    label: 'Health',
    items: [{ id: 'insurance', label: 'Insurance', icon: Shield }],
  },
  {
    label: 'Reports',
    items: [
      { id: 'reports', label: 'Monthly Report', icon: Receipt },
    ],
  },
];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getStoredNumber(key: string, fallback: number) {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

type AppShellProps = {
  initialData?: BootstrapData;
  serverMonth?: number;
  serverYear?: number;
};

function AppShell({ initialData, serverMonth, serverYear }: AppShellProps) {
  const now = new Date();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('darkMode') === 'true';
  });
  const [privacyMode, setPrivacyMode] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('privacyMode');
    return stored === null ? true : stored === 'true';
  });
  const [mounted, setMounted] = useState(false);
  const [currentView, setCurrentView] = useState<ViewId>('dashboard');
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());

  useEffect(() => {
    // Load preferences on mount
    const savedView = window.localStorage.getItem('activeView');
    const savedMonth = window.localStorage.getItem('selectedMonth');
    const savedYear = window.localStorage.getItem('selectedYear');

    if (savedView) setCurrentView(savedView as ViewId);
    if (savedMonth) setCurrentMonth(Number(savedMonth));
    if (savedYear) setCurrentYear(Number(savedYear));
    
    setMounted(true);
  }, []);
  const [expenses, setExpenses] = useState<Expense[]>((initialData?.expenses as Expense[]) ?? []);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>((initialData?.subscriptions as Subscription[]) ?? []);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>((initialData?.summary as MonthlySummary) ?? null);
  const [prevMonthExpenses, setPrevMonthExpenses] = useState<Expense[]>((initialData?.prevMonthExpenses as Expense[]) ?? []);
  const [yearlyRows, setYearlyRows] = useState<YearlyRow[]>((initialData?.yearlyRows as YearlyRow[]) ?? []);
  const [yearlyCategoryRows, setYearlyCategoryRows] = useState<{ month: number; category: string; total: number }[]>((initialData?.yearlyCategoryRows as { month: number; category: string; total: number }[]) ?? []);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudgetRow[]>((initialData?.categoryBudgets as CategoryBudgetRow[]) ?? []);
  const [loanMilestones, setLoanMilestones] = useState<LoanMilestone[]>((initialData?.loanMilestones as LoanMilestone[]) ?? []);
  const [creditCards, setCreditCards] = useState<CreditCard[]>((initialData?.creditCards as CreditCard[]) ?? []);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>((initialData?.bankAccounts as BankAccount[]) ?? []);
  const [loading, setLoading] = useState(!initialData);
  const [refreshKey, setRefreshKey] = useState(0);
  const [stockRefreshTick, setStockRefreshTick] = useState(0);
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => new Set(['dashboard']));
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [userInfo, setUserInfo] = useState<{ email: string | null; name: string | null } | null>(initialData?.user ?? null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const monthScrollRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const prevMonthRef = useRef(currentMonth);
  const prevYearRef = useRef(currentYear);
  // Skip the first client-side fetch when server already provided data for the current month/year
  const skipInitialFetchRef = useRef(!!initialData);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('session_last_active');
    window.location.href = '/login';
  };

  // light=true: only fetch month-specific data (expenses, summary, prevExpenses)
  // Used on same-year month navigation to skip static queries (subscriptions, yearly chart, budgets, loans)
  const loadCoreData = async (showLoading = false, light = false) => {
    if (showLoading || !monthlySummary) setLoading(true);
    setErrorMessage(null);
    try {
      const url = `/api/bootstrap?month=${currentMonth}&year=${currentYear}${light ? "&light=true" : ""}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error('Failed to load webapp data');
      }

      const data = await res.json();

      setExpenses(data.expenses ?? []);
      setMonthlySummary(data.summary ?? null);
      setPrevMonthExpenses(data.prevMonthExpenses ?? []);
      if (!light) {
        setSubscriptions(data.subscriptions ?? []);
        setYearlyRows(data.yearlyRows ?? []);
        setYearlyCategoryRows((data as any).yearlyCategoryRows ?? []);
        setCategoryBudgets(data.categoryBudgets ?? []);
        setLoanMilestones(data.loanMilestones ?? []);
        setCreditCards(data.creditCards ?? []);
        setBankAccounts(data.bankAccounts ?? []);
        if (data.user && !userInfo) setUserInfo(data.user);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.removeAttribute('data-theme');
    }
    window.localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    window.localStorage.setItem('privacyMode', String(privacyMode));
  }, [privacyMode]);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem('activeView', currentView);
    setMountedTabs(prev => {
      if (prev.has(currentView)) return prev;
      const next = new Set(prev);
      next.add(currentView);
      return next;
    });
  }, [currentView, mounted]);

  useEffect(() => {
    if (!mounted) return;

    const monthChanged = prevMonthRef.current !== currentMonth;
    const yearChanged = prevYearRef.current !== currentYear;

    prevMonthRef.current = currentMonth;
    prevYearRef.current = currentYear;

    window.localStorage.setItem('selectedMonth', currentMonth.toString());
    window.localStorage.setItem('selectedYear', currentYear.toString());

    // Skip the first fetch when server already provided data for this month/year
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      if (currentMonth === serverMonth && currentYear === serverYear && refreshKey === 0) {
        return;
      }
    }

    // Light fetch on same-year month switch: skip subscriptions, yearly chart, budgets, loans
    const isLightNav = monthChanged && !yearChanged;
    loadCoreData(monthChanged || yearChanged, isLightNav);
  }, [currentMonth, currentYear, refreshKey, mounted]);

  const filteredExpenses = useMemo(() => expenses, [expenses]);

  // Descriptions that appear in both current and previous month = recurring
  const recurringDescriptions = useMemo(() => {
    const prevDescs = new Set(
      prevMonthExpenses
        .filter((e) => e.description)
        .map((e) => e.description.toLowerCase().trim())
    );
    return new Set(
      expenses
        .filter((e) => e.description)
        .map((e) => e.description.toLowerCase().trim())
        .filter((d) => prevDescs.has(d))
    );
  }, [expenses, prevMonthExpenses]);
  
  // Use stable defaults during hydration
  const displayMonth = mounted ? currentMonth : now.getMonth() + 1;
  const displayYear = mounted ? currentYear : now.getFullYear();
  const displayView = mounted ? currentView : 'dashboard';

  // Close user menu on outside click
  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showUserMenu]);

  // Auto-scroll active month chip into view on mobile
  useEffect(() => {
    if (!monthScrollRef.current) return;
    const active = monthScrollRef.current.querySelector('.mobile-month-chip.active') as HTMLElement | null;
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [displayMonth]);

  const periodLabel = `${MONTHS_SHORT[displayMonth - 1]} ${displayYear}`;
  const currentLabel = NAV_SECTIONS.flatMap((section) => section.items).find((item) => item.id === displayView)?.label || 'Dashboard';

  const triggerRefresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  const userInitials = (() => {
    if (userInfo?.name) {
      const parts = userInfo.name.trim().split(' ').filter(Boolean);
      return parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : parts[0].slice(0, 2).toUpperCase();
    }
    if (userInfo?.email) return userInfo.email[0].toUpperCase();
    return '?';
  })();

  const userDisplayName = userInfo?.name || userInfo?.email?.split('@')[0] || 'Account';

  const handleExpenseSubmit = async (payload: Omit<Expense, 'id'>) => {
    const tempId = Date.now();
    const optimisticExpense: Expense = { ...payload, id: tempId };
    const prevExpenses = expenses;
    const prevSummary = monthlySummary;

    // Optimistic updates
    setExpenses(prev => [optimisticExpense, ...prev]);
    if (monthlySummary) {
      const amount = Number(payload.amount);
      // Credit card expenses are deferred — they don't touch total_expenses or the bank balance
      const isCreditCard = payload.payment_source === 'credit_card';
      setMonthlySummary({
        ...monthlySummary,
        total_expenses: isCreditCard
          ? Number(monthlySummary.total_expenses || 0)
          : Number(monthlySummary.total_expenses || 0) + amount,
        remaining_amount: isCreditCard
          ? Number(monthlySummary.remaining_amount || 0)
          : Number(monthlySummary.remaining_amount || 0) - amount,
        cash_equivalents: isCreditCard
          ? Number(monthlySummary.cash_equivalents || 0)
          : Number(monthlySummary.cash_equivalents || 0) - amount,
      });
    }

    // Close immediately — optimistic update already reflects the change
    setShowExpenseForm(false);
    setEditingExpense(null);

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setExpenses(prevExpenses);
      setMonthlySummary(prevSummary);
      alert(`Failed to save expense: ${err?.error ?? res.statusText}`);
      return;
    }

    // Confirm: replace temp id with real expense + sync summary from server
    const result = await res.json();
    if (result.expense) {
      setExpenses(prev => prev.map(e => e.id === tempId ? result.expense as Expense : e));
    }
    if (result.summary) {
      setMonthlySummary(prev => prev ? { ...prev, ...result.summary as MonthlySummary } : result.summary as MonthlySummary);
    }
    // Refresh card/account balances if this expense was charged to one
    if (payload.payment_source === 'credit_card' || (payload as { bank_account_id?: number | null }).bank_account_id) {
      triggerRefresh();
    }
  };

  const handleExpenseUpdate = async (expense: Expense) => {
    // For update, we'll just trigger refresh for now to keep it simple, 
    // but we'll stop the loading screen flicker.
    const res = await fetch(`/api/expenses/${expense.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: expense.date,
        description: expense.description,
        amount: Number(expense.amount),
        category: expense.category,
        note: expense.note ?? '',
        tag: expense.tag ?? null,
        payment_source: expense.payment_source ?? 'bank',
        credit_card_id: expense.credit_card_id ?? null,
        bank_account_id: expense.bank_account_id ?? null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = typeof err?.error === 'string' ? err.error : JSON.stringify(err?.error ?? res.statusText);
      alert(`Failed to update expense: ${msg}`);
      return;
    }
    setShowExpenseForm(false);
    setEditingExpense(null);
    triggerRefresh();
  };

  const handleExpenseDelete = async (id: number) => {
    // Optimistic Update
    const expenseToDelete = expenses.find(e => e.id === id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));

    if (monthlySummary && expenseToDelete) {
      const amount = Number(expenseToDelete.amount);
      const isCreditCard = expenseToDelete.payment_source === 'credit_card';
      const newTotal = isCreditCard
        ? Number(monthlySummary.total_expenses || 0)
        : Number(monthlySummary.total_expenses || 0) - amount;
      const newRemaining = isCreditCard
        ? Number(monthlySummary.remaining_amount || 0)
        : Number(monthlySummary.remaining_amount || 0) + amount;
      setMonthlySummary({
        ...monthlySummary,
        total_expenses: newTotal,
        remaining_amount: newRemaining,
        cash_equivalents: isCreditCard
          ? Number(monthlySummary.cash_equivalents || 0)
          : (Number(monthlySummary.cash_equivalents || 0)) + amount
      });
    }

    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    triggerRefresh();
  };

  const handleSubscriptionSubmit = async (payload: Omit<Subscription, 'id'>) => {
    await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setShowSubscriptionForm(false);
    setEditingSubscription(null);
    triggerRefresh();
  };

  const handleSubscriptionUpdate = async (payload: Subscription) => {
    await fetch(`/api/subscriptions/${payload.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setShowSubscriptionForm(false);
    setEditingSubscription(null);
    triggerRefresh();
  };

  const handleSubscriptionDelete = async (id: number) => {
    await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
    triggerRefresh();
  };

  const handleLoanSubmit = async (payload: Omit<Loan, 'id'>) => {
    await fetch('/api/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setShowLoanForm(false);
    setEditingLoan(null);
    triggerRefresh();
  };

  const handleLoanUpdate = async (payload: Loan) => {
    await fetch(`/api/loans/${payload.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setShowLoanForm(false);
    setEditingLoan(null);
    triggerRefresh();
  };

  return (
    <>
      <div className="bg-ambient" />

      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-brand-mark">MET</div>
            <div className="sidebar-brand-text">
              <strong>MyExpenseTracker</strong>
              <span>Did I MET my expectations?</span>
            </div>
          </div>

          {NAV_SECTIONS.map((section) => (
            <React.Fragment key={section.label}>
              <div className="nav-section-label">{section.label}</div>
              {section.items.map(({ id, label, icon: Icon }) => {
                // Stable check for hydration: on first pass (mounted=false), only 'dashboard' is active
                const active = mounted ? currentView === id : id === 'dashboard';
                return (
                  <div key={id} className={`nav-item cursor-pointer ${active ? 'active' : ''}`} onClick={() => setCurrentView(id)}>
                    <span className="nav-icon">
                      <Icon size={16} />
                    </span>
                    {label}
                    {active && <span className="nav-active-dot" />}
                  </div>
                );
              })}
            </React.Fragment>
          ))}

          <div className="sidebar-footer">
            <div className="period-card">
              <div className="period-card-eyebrow">Current Period</div>
              <div className="period-card-value">{periodLabel}</div>
              <div className="period-card-sub">{expenses.length} transactions</div>
            </div>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <div className="topbar-title">{currentLabel}</div>
            <div style={{ flex: 1 }} />

            <div className="scrubber">
              {MONTHS_SHORT.map((month, index) => (
                <div
                  key={index + 1}
                  className={`scrubber-item cursor-pointer ${index + 1 === displayMonth ? 'active' : ''}`}
                  onClick={() => setCurrentMonth(index + 1)}
                >
                  {month}
                </div>
              ))}
              <div className="scrubber-divider" />
              <div className="scrubber-item cursor-pointer" style={{ padding: '0 6px' }} onClick={() => setCurrentYear((value) => value - 1)}>
                <ChevronLeft size={12} />
              </div>
              <div className="scrubber-year">{displayYear}</div>
              <div className="scrubber-item cursor-pointer" style={{ padding: '0 6px' }} onClick={() => setCurrentYear((value) => value + 1)}>
                <ChevronRight size={12} />
              </div>
            </div>

            <button
              className="icon-btn cursor-pointer"
              title={mounted ? (privacyMode ? 'Show financials' : 'Hide financials') : 'Hide financials'}
              onClick={() => setPrivacyMode((v) => !v)}
            >
              {mounted && !privacyMode ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>

            <button className="icon-btn cursor-pointer" title={mounted ? (darkMode ? 'Light mode' : 'Dark mode') : 'Dark mode'} onClick={() => setDarkMode((value) => !value)}>
              {mounted && darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* User avatar + dropdown */}
            <div style={{ position: 'relative' }} ref={userMenuRef}>
              <button
                className="user-avatar cursor-pointer"
                title={userInfo?.email ?? 'Account'}
                onClick={() => setShowUserMenu((v) => !v)}
              >
                {userInitials}
              </button>
              {showUserMenu && (
                <div className="user-menu">
                  <div className="user-menu-header">
                    <div className="user-menu-avatar">{userInitials}</div>
                    <div>
                      <div className="user-menu-name">{userDisplayName}</div>
                      {userInfo?.email && <div className="user-menu-email">{userInfo.email}</div>}
                    </div>
                  </div>
                  <div className="user-menu-divider" />
                  <button
                    className="user-menu-item cursor-pointer"
                    onClick={() => { setShowUserMenu(false); setShowLogoutModal(true); }}
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              )}
            </div>

            <button className="btn btn-accent cursor-pointer" onClick={() => { setEditingExpense(null); setShowExpenseForm(true); }}>
              <Plus size={14} />
              Quick add
            </button>
          </header>

          {/* Mobile-only month navigation — scrubber is hidden on mobile */}
          <div className="mobile-month-bar">
            <div className="mobile-year-row">
              <button className="mobile-year-btn" onClick={() => setCurrentYear((v) => v - 1)}>
                <ChevronLeft size={16} />
              </button>
              <span className="mobile-year-label">{displayYear}</span>
              <button className="mobile-year-btn" onClick={() => setCurrentYear((v) => v + 1)}>
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="mobile-month-scroll" ref={monthScrollRef}>
              {MONTHS_SHORT.map((m, i) => (
                <button
                  key={i}
                  className={`mobile-month-chip${i + 1 === displayMonth ? ' active' : ''}`}
                  onClick={() => setCurrentMonth(i + 1)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <main className="content fade-in">
            {errorMessage ? (
              <div className="pane" style={{ padding: 24 }}>
                <div className="serif" style={{ fontSize: 24, marginBottom: 8 }}>Unable to load the webapp</div>
                <p style={{ color: 'var(--ink-muted)' }}>{errorMessage}</p>
              </div>
            ) : loading ? (
              <div className="space-y-8 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-32 rounded-2xl shadow-sm" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }} />
                  ))}
                </div>
                <div className="h-64 rounded-2xl shadow-sm" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }} />
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 rounded-2xl shadow-sm" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }} />
                  ))}
                </div>
              </div>
            ) : (
              <>
                {currentView === 'dashboard' && (
                  <Dashboard
                    expenses={expenses}
                    subscriptions={subscriptions}
                    monthlySummary={monthlySummary}
                    currentMonth={currentMonth}
                    currentYear={currentYear}
                    prevMonthExpenses={prevMonthExpenses}
                    yearlyRows={yearlyRows}
                    initialCategoryBudgets={categoryBudgets}
                    initialLoanMilestones={loanMilestones}
                    bankAccounts={bankAccounts}
                    onBankAccountsChange={triggerRefresh}
                    stockRefreshTick={stockRefreshTick}
                    privacyMode={privacyMode}
                    onFinancialsUpdate={async (data) => {
                      const res = await fetch(`/api/monthly-summary/${currentMonth}/${currentYear}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data),
                      });
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        alert(`Failed to save financials: ${err?.error ?? res.statusText}`);
                        return;
                      }
                      triggerRefresh();
                    }}
                  />
                )}

                {mountedTabs.has('expenses') && (
                  <div style={{ display: currentView === 'expenses' ? undefined : 'none' }}>
                    <ExpenseList
                      expenses={filteredExpenses}
                      recurringDescriptions={recurringDescriptions}
                      onEdit={async (expense, mode) => {
                        if (mode === 'save-inline') {
                          await handleExpenseUpdate(expense);
                          return;
                        }
                        setEditingExpense(expense);
                        setShowExpenseForm(true);
                      }}
                      onDelete={(id) => {
                        handleExpenseDelete(id);
                      }}
                    />
                  </div>
                )}

                {mountedTabs.has('analytics') && (
                  <div style={{ display: currentView === 'analytics' ? undefined : 'none' }}>
                    <Analytics
                      expenses={expenses}
                      yearlyRows={yearlyRows}
                      yearlyCategoryRows={yearlyCategoryRows}
                      currentMonth={currentMonth}
                      currentYear={currentYear}
                      privacyMode={privacyMode}
                    />
                  </div>
                )}

                {mountedTabs.has('subscriptions') && (
                  <div style={{ display: currentView === 'subscriptions' ? undefined : 'none' }}>
                    <Subscriptions
                      subscriptions={subscriptions}
                      currentMonth={currentMonth}
                      currentYear={currentYear}
                      onAdd={() => {
                        setEditingSubscription(null);
                        setShowSubscriptionForm(true);
                      }}
                      onEdit={(subscription) => {
                        setEditingSubscription(subscription);
                        setShowSubscriptionForm(true);
                      }}
                      onDelete={(id) => {
                        void handleSubscriptionDelete(id);
                      }}
                      onPay={() => {
                        triggerRefresh();
                      }}
                      onUndoPay={() => {
                        triggerRefresh();
                      }}
                    />
                  </div>
                )}

                {mountedTabs.has('loans') && (
                  <div style={{ display: currentView === 'loans' ? undefined : 'none' }}>
                    <Loans
                      refreshKey={refreshKey}
                      onShowForm={() => {
                        setEditingLoan(null);
                        setShowLoanForm(true);
                      }}
                      onEdit={(loan) => {
                        setEditingLoan(loan);
                        setShowLoanForm(true);
                      }}
                      currentMonth={currentMonth}
                      currentYear={currentYear}
                      onPay={() => {
                        triggerRefresh();
                      }}
                    />
                    <div className="mt-6">
                      <CreditCards cards={creditCards} bankAccounts={bankAccounts} onChange={triggerRefresh} />
                    </div>
                  </div>
                )}

                {mountedTabs.has('reports') &&<div style={{ display: currentView === 'reports' ? undefined : 'none' }}><MonthlyReport currentMonth={currentMonth} currentYear={currentYear} /></div>}
                {mountedTabs.has('projection') && <div style={{ display: currentView === 'projection' ? undefined : 'none' }}><YearEndProjection currentMonth={currentMonth} currentYear={currentYear} /></div>}
                {mountedTabs.has('sip') && <div style={{ display: currentView === 'sip' ? undefined : 'none' }}><SIPTracker currentMonth={currentMonth} currentYear={currentYear} onPortfolioUpdate={triggerRefresh} frozenSip={monthlySummary?.savings_sip} /></div>}
                {mountedTabs.has('stocks') && <div style={{ display: currentView === 'stocks' ? undefined : 'none' }}><StockTracker currentMonth={currentMonth} currentYear={currentYear} onPortfolioUpdate={triggerRefresh} onPricesRefreshed={() => setStockRefreshTick(t => t + 1)} frozenShares={monthlySummary?.savings_shares} /></div>}
                {mountedTabs.has('insurance') && <div style={{ display: currentView === 'insurance' ? undefined : 'none' }}><Insurance /></div>}
              </>
            )}
          </main>
        </div>
      </div>

      {showExpenseForm && (
        <ExpenseForm
          expense={editingExpense}
          creditCards={creditCards}
          bankAccounts={bankAccounts}
          defaultDate={!editingExpense ? (() => {
            const today = new Date();
            const isCurrentMonth = currentMonth === today.getMonth() + 1 && currentYear === today.getFullYear();
            if (isCurrentMonth) return today.toISOString().split('T')[0];
            return `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
          })() : undefined}
          onSubmit={async (payload) => {
            if (editingExpense?.id) {
              await handleExpenseUpdate({ ...editingExpense, ...payload, amount: Number(payload.amount) });
            } else {
              await handleExpenseSubmit(payload);
            }
          }}
          onCancel={() => {
            setShowExpenseForm(false);
            setEditingExpense(null);
          }}
        />
      )}

      {showSubscriptionForm && (
        <SubscriptionForm
          subscription={editingSubscription}
          bankAccounts={bankAccounts}
          onSubmit={(payload) => {
            if (editingSubscription?.id) {
              void handleSubscriptionUpdate({ ...editingSubscription, ...payload, amount: Number(payload.amount) });
            } else {
              void handleSubscriptionSubmit(payload);
            }
          }}
          onCancel={() => {
            setShowSubscriptionForm(false);
            setEditingSubscription(null);
          }}
        />
      )}

      {showLoanForm && (
        <LoanForm
          loan={editingLoan}
          bankAccounts={bankAccounts}
          onSubmit={(payload) => {
            if (editingLoan?.id) {
              void handleLoanUpdate({ ...editingLoan, ...payload, amount: Number(payload.amount), due_day: Number(payload.due_day) });
            } else {
              void handleLoanSubmit({ ...payload, amount: Number(payload.amount), due_day: Number(payload.due_day) });
            }
          }}
          onCancel={() => {
            setShowLoanForm(false);
            setEditingLoan(null);
          }}
        />
      )}
      {showLogoutModal && (
        <LogoutConfirmModal
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}

      <SessionTimeout onLogout={handleLogout} />

      <MobileNav 
        currentView={currentView}
        onViewChange={(v) => setCurrentView(v)}
        onQuickAdd={() => { setEditingExpense(null); setShowExpenseForm(true); }}
      />
    </>




  );
}

export default AppShell;
