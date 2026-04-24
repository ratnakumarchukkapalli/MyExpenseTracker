'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
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
import ExpenseForm from './ExpenseForm';
import ExpenseList from './ExpenseList';
import Subscriptions from './Subscriptions';
import SubscriptionForm from './SubscriptionForm';
import Loans from './Loans';
import LoanForm from './LoanForm';
import Insurance from './Insurance';
import Dashboard from './Dashboard';
import MonthlyReport from './MonthlyReport';
import YearEndProjection from './YearEndProjection';
import SIPTracker from './SIPTracker';
import StockTracker from './StockTracker';
import LogoutConfirmModal from './LogoutConfirmModal';
import MobileNav from './MobileNav';



type Expense = {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  note?: string;
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

type ViewId =
  | 'dashboard'
  | 'expenses'
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

function AppShell() {
  const now = new Date();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('darkMode') === 'true';
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
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const monthScrollRef = useRef<HTMLDivElement>(null);

  const loadCoreData = async () => {
    if (!monthlySummary) setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/bootstrap?month=${currentMonth}&year=${currentYear}`);

      if (!res.ok) {
        throw new Error('Failed to load webapp data');
      }

      const data = await res.json();

      setExpenses(data.expenses ?? []);
      setSubscriptions(data.subscriptions ?? []);
      setMonthlySummary(data.summary ?? null);
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
    if (!mounted) return;
    window.localStorage.setItem('activeView', currentView);
  }, [currentView, mounted]);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem('selectedMonth', currentMonth.toString());
    window.localStorage.setItem('selectedYear', currentYear.toString());
    loadCoreData();
  }, [currentMonth, currentYear, refreshKey, mounted]);

  const filteredExpenses = useMemo(() => expenses, [expenses]);
  
  // Use stable defaults during hydration
  const displayMonth = mounted ? currentMonth : now.getMonth() + 1;
  const displayYear = mounted ? currentYear : now.getFullYear();
  const displayView = mounted ? currentView : 'dashboard';

  // Auto-scroll active month chip into view on mobile
  useEffect(() => {
    if (!monthScrollRef.current) return;
    const active = monthScrollRef.current.querySelector('.mobile-month-chip.active') as HTMLElement | null;
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [displayMonth]);

  const periodLabel = `${MONTHS_SHORT[displayMonth - 1]} ${displayYear}`;
  const currentLabel = NAV_SECTIONS.flatMap((section) => section.items).find((item) => item.id === displayView)?.label || 'Dashboard';

  const triggerRefresh = () => setRefreshKey((value) => value + 1);

  const handleExpenseSubmit = async (payload: Omit<Expense, 'id'>) => {
    // Optimistic Update
    const tempId = Date.now();
    const optimisticExpense: Expense = { ...payload, id: tempId };
    
    // Update expenses list immediately
    setExpenses((prev) => [optimisticExpense, ...prev]);
    
    // Update monthly summary immediately
    if (monthlySummary) {
      const amount = Number(payload.amount);
      const newTotal = (Number(monthlySummary.total_expenses || 0)) + amount;
      const newRemaining = Number(monthlySummary.remaining_amount || 0) - amount;
      setMonthlySummary({
        ...monthlySummary,
        total_expenses: newTotal,
        remaining_amount: newRemaining,
        cash_equivalents: (Number(monthlySummary.cash_equivalents || 0)) - amount
      });
    }

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`Failed to save expense: ${err?.error ?? res.statusText}`);
      // Rollback on error? For now just trigger refresh
    }
    setShowExpenseForm(false);
    setEditingExpense(null);
    triggerRefresh();
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
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`Failed to update expense: ${err?.error ?? res.statusText}`);
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
      const newTotal = (Number(monthlySummary.total_expenses || 0)) - amount;
      const newRemaining = Number(monthlySummary.remaining_amount || 0) + amount;
      setMonthlySummary({
        ...monthlySummary,
        total_expenses: newTotal,
        remaining_amount: newRemaining,
        cash_equivalents: (Number(monthlySummary.cash_equivalents || 0)) + amount
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

            <button className="icon-btn cursor-pointer" title={darkMode ? 'Light mode' : 'Dark mode'} onClick={() => setDarkMode((value) => !value)}>
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              className="icon-btn cursor-pointer"
              title="Logout"
              onClick={() => setShowLogoutModal(true)}
            >

              <LogOut size={16} />
            </button>

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
                    <div key={i} className="h-32 bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-2xl shadow-sm" />
                  ))}
                </div>
                <div className="h-64 bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-2xl shadow-sm" />
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-2xl shadow-sm" />
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

                {currentView === 'expenses' && (
                  <ExpenseList
                    expenses={filteredExpenses}
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
                    onAdd={async (expense) => {
                      await handleExpenseSubmit({
                        date: expense.date ?? new Date().toISOString().split('T')[0],
                        description: expense.description ?? '',
                        amount: Number(expense.amount ?? 0),
                        category: expense.category ?? 'Personal',
                        note: expense.note ?? '',
                      });
                    }}
                  />
                )}

                {currentView === 'subscriptions' && (
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
                  />
                )}

                {currentView === 'loans' && (
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
                  />
                )}

                {currentView === 'reports' && <MonthlyReport currentMonth={currentMonth} currentYear={currentYear} />}
                {currentView === 'projection' && <YearEndProjection currentMonth={currentMonth} currentYear={currentYear} />}
                {currentView === 'sip' && <SIPTracker currentMonth={currentMonth} currentYear={currentYear} onPortfolioUpdate={triggerRefresh} />}
                {currentView === 'stocks' && <StockTracker currentMonth={currentMonth} currentYear={currentYear} onPortfolioUpdate={triggerRefresh} />}
                {currentView === 'insurance' && <Insurance />}
              </>
            )}
          </main>
        </div>
      </div>

      {showExpenseForm && (
        <ExpenseForm
          expense={editingExpense}
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
          onConfirm={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login';
          }}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}

      <MobileNav 
        currentView={currentView}
        onViewChange={(v) => setCurrentView(v)}
        onQuickAdd={() => { setEditingExpense(null); setShowExpenseForm(true); }}
      />
    </>




  );
}

export default AppShell;
