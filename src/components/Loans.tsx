'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, DollarSign, Calendar, Clock, AlertCircle,
  CheckCircle, Landmark, Wallet, TrendingDown, Search,
} from 'lucide-react';

interface Loan {
  id: number;
  name: string;
  amount: number;
  due_day: number;
  start_date?: string;
  end_date?: string;
  category?: string;
  status: string;
  comments?: string;
  paid_this_month?: boolean;
  remind_me?: boolean;
  outstanding_balance?: number;
  outstanding_balance_asof?: string;
}

const periodOf = (dateString: string) => {
  const d = new Date(dateString);
  return d.getFullYear() * 12 + (d.getMonth() + 1);
};

// A loan "covers" a given period if it started on/before it and (if it has an
// end date) hasn't ended before it. Missing start_date is treated as "always started"
// defensively, though the API always sets one.
const loanCoversPeriod = (loan: Loan, period: number) => {
  if (loan.start_date && periodOf(loan.start_date) > period) return false;
  if (loan.end_date && periodOf(loan.end_date) < period) return false;
  return true;
};

const REMAINING_BUCKETS = [
  { value: 'all', label: 'All' },
  { value: 'ending-soon', label: 'Ending ≤ 3 months' },
  { value: 'this-year', label: 'Ending within 12 months' },
  { value: 'long-term', label: 'Long-term (> 1 year)' },
  { value: 'ongoing', label: 'No end date' },
] as const;

type RemainingBucket = typeof REMAINING_BUCKETS[number]['value'];
type SortKey = 'due_day' | 'amount' | 'remaining' | 'name';

interface Props {
  onShowForm: () => void;
  onEdit: (loan: Loan) => void;
  refreshKey: number;
  currentMonth: number;
  currentYear: number;
  onPay?: () => void;
}

function Loans({ onShowForm, onEdit, refreshKey, currentMonth, currentYear, onPay }: Props) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [remainingFilter, setRemainingFilter] = useState<RemainingBucket>('all');
  const [showAllStatuses, setShowAllStatuses] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('due_day');

  useEffect(() => { loadLoans(); }, [refreshKey]);

  const loadLoans = async () => {
    try {
      // no-store: paid_this_month must be fresh after a Pay Now refresh
      const res = await fetch('/api/loans', { cache: 'no-store' });
      const data = await res.json();
      setLoans(data || []);
    } catch (error) {
      console.error('Failed to load loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (loan: Loan) => {
    if (payingId) return;
    setPayingId(loan.id);
    try {
      const res = await fetch(`/api/loans/${loan.id}/pay`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to record payment');
      }
      setLoans(prev => prev.map(l => l.id === loan.id ? { ...l, paid_this_month: true } : l));
      onPay?.();
    } catch (error) {
      console.error('Failed to record EMI payment:', error);
      alert(error instanceof Error ? error.message : 'Failed to record payment');
    } finally {
      setPayingId(null);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (window.confirm(`Delete ${name}?`)) {
      try {
        await fetch(`/api/loans/${id}`, { method: 'DELETE' });
        loadLoans();
      } catch (error) {
        console.error('Failed to delete loan:', error);
      }
    }
  };

  const selectedPeriod = (currentYear || new Date().getFullYear()) * 12 + ((currentMonth || new Date().getMonth() + 1));

  // Single definition of "active loan covering a given period" — status active
  // AND start_date/end_date actually cover it. Previously only end_date was
  // checked, so a loan added with a future start_date would already count
  // toward the current month's EMI total. Reused everywhere below instead of
  // re-deriving the same predicate per card, so the fix can't be missed in one spot.
  const loansActiveIn = (period: number) => loans.filter(l => l.status === 'active' && loanCoversPeriod(l, period));

  const activeInPeriod = useMemo(() => loansActiveIn(selectedPeriod), [loans, selectedPeriod]);

  const categories = useMemo(
    () => Array.from(new Set(loans.map(l => l.category).filter(Boolean))) as string[],
    [loans]
  );

  const getMonthsRemaining = (endDate?: string) => {
    if (!endDate) return null;
    return Math.max(0, periodOf(endDate) - selectedPeriod);
  };

  const matchesRemainingBucket = (loan: Loan) => {
    if (remainingFilter === 'all') return true;
    if (remainingFilter === 'ongoing') return !loan.end_date;
    const months = getMonthsRemaining(loan.end_date);
    if (months === null) return false;
    if (remainingFilter === 'ending-soon') return months <= 3;
    if (remainingFilter === 'this-year') return months <= 12;
    return months > 12; // long-term
  };

  const visibleLoans = useMemo(() => {
    const filtered = (showAllStatuses ? loans : activeInPeriod).filter(l => {
      if (search.trim() && !l.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (categoryFilter !== 'all' && l.category !== categoryFilter) return false;
      if (!matchesRemainingBucket(l)) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === 'amount') return b.amount - a.amount;
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      if (sortKey === 'remaining') {
        const ra = getMonthsRemaining(a.end_date) ?? Infinity;
        const rb = getMonthsRemaining(b.end_date) ?? Infinity;
        return ra - rb;
      }
      return a.due_day - b.due_day;
    });
    return sorted;
  }, [loans, activeInPeriod, showAllStatuses, search, categoryFilter, remainingFilter, selectedPeriod, sortKey]);

  const totalMonthlyEMI = useMemo(() => activeInPeriod.reduce((sum, l) => sum + (l.amount || 0), 0), [activeInPeriod]);

  // Real 12-month projection instead of monthly * 12 — accounts for loans that
  // end partway through the year instead of assuming every active loan runs all 12 months.
  const totalYearlyEMI = useMemo(() => {
    let total = 0;
    for (let i = 0; i < 12; i++) {
      total += loansActiveIn(selectedPeriod + i).reduce((sum, l) => sum + (l.amount || 0), 0);
    }
    return total;
  }, [loans, selectedPeriod]);

  // Nominal sum of every future EMI (principal + interest) for loans with a known
  // end date — will run higher than Outstanding Loans, which is principal only.
  // getMonthsRemaining counts months AFTER the viewed period, so +1 to include
  // the viewed period's own payment (matches totalYearlyEMI's inclusive i=0 start).
  const totalRemainingPayout = useMemo(
    () => activeInPeriod.reduce((sum, l) => {
      const months = getMonthsRemaining(l.end_date);
      return months === null ? sum : sum + l.amount * (months + 1);
    }, 0),
    [activeInPeriod, selectedPeriod]
  );

  // Sum of manually-entered outstanding balances (from bank statements). Includes
  // 'paused' loans (e.g. an EMI moratorium) since the debt still exists even while
  // payments are on hold — only 'completed'/'inactive' loans are excluded, since
  // those mean the loan itself is done. Not amortized/estimated — always exact as
  // of its own date, goes stale between updates. Intentionally NOT wired into Net
  // Worth — that number is built from monthly_summary snapshots (see snapshot
  // rule) and retrofitting history here would need a separate backfill migration.
  const outstandingLoans = useMemo(() => {
    const tracked = loans.filter(l =>
      (l.status === 'active' || l.status === 'paused') &&
      loanCoversPeriod(l, selectedPeriod) &&
      l.outstanding_balance != null
    );
    const total = tracked.reduce((sum, l) => sum + (l.outstanding_balance || 0), 0);
    const oldestAsof = tracked
      .map(l => l.outstanding_balance_asof)
      .filter((d): d is string => !!d)
      .sort()[0] ?? null;
    return { total, trackedCount: tracked.length, oldestAsof };
  }, [loans, selectedPeriod]);

  // Banner logic runs against the real current month (EMIs are paid now, not in the viewed month)
  const today = new Date();
  const realPeriod = today.getFullYear() * 12 + (today.getMonth() + 1);
  const isViewingCurrentMonth = currentMonth === today.getMonth() + 1 && currentYear === today.getFullYear();

  const getDaysUntilDue = (loan: Loan) => {
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dueDate = new Date(today.getFullYear(), today.getMonth(), Math.min(loan.due_day, daysInMonth));
    return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Only loans marked "remind me" get due-soon/overdue banner tracking (per-loan
  // flag, set in LoanForm) — CC-bundled EMIs are usually left off since they're
  // paid as one lump credit card statement, not individually.
  const payableLoans = useMemo(
    () => loansActiveIn(realPeriod).filter(l => !l.paid_this_month && l.remind_me),
    [loans, realPeriod]
  );

  const overdueLoans = payableLoans.filter(l => getDaysUntilDue(l) < 0);
  const dueSoonLoans = payableLoans.filter(l => {
    const d = getDaysUntilDue(l);
    return d >= 0 && d <= 7;
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-gray-200 dark:bg-surface-800 rounded-lg" />
            <div className="h-4 w-64 bg-gray-100 dark:bg-surface-800 rounded-lg" />
          </div>
          <div className="h-10 w-32 bg-gray-100 dark:bg-surface-800 rounded-xl" />
        </div>

        {/* Summary Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-100 dark:bg-surface-800 rounded-lg" />
                <div className="h-4 w-20 bg-gray-100 dark:bg-surface-800 rounded" />
              </div>
              <div className="h-8 w-32 bg-gray-200 dark:bg-surface-800 rounded-lg" />
            </div>
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-surface-800 bg-gray-50/50 dark:bg-surface-800/30">
            <div className="grid grid-cols-7 gap-4">
              {[1, 2, 3, 4, 5, 6, 7].map(i => (
                <div key={i} className="h-3 bg-gray-200 dark:bg-surface-800 rounded w-16" />
              ))}
            </div>
          </div>
          <div className="p-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="grid grid-cols-7 gap-4 items-center">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-gray-100 dark:bg-surface-800 rounded-xl" />
                  <div className="space-y-1">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-surface-800 rounded" />
                    <div className="h-3 w-16 bg-gray-100 dark:bg-surface-800 rounded" />
                  </div>
                </div>
                <div className="h-4 bg-gray-200 dark:bg-surface-800 rounded w-20 justify-self-end" />
                <div className="h-6 bg-gray-100 dark:bg-surface-800 rounded w-16 justify-self-center" />
                <div className="h-4 bg-gray-100 dark:bg-surface-800 rounded w-32 justify-self-center" />
                <div className="h-6 bg-gray-100 dark:bg-surface-800 rounded w-20 justify-self-center" />
                <div className="h-5 bg-gray-100 dark:bg-surface-800 rounded w-16 justify-self-center" />
                <div className="h-8 w-8 bg-gray-100 dark:bg-surface-800 rounded-lg justify-self-end" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {overdueLoans.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-red-900">{overdueLoans.length} EMI{overdueLoans.length > 1 ? 's' : ''} Overdue</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {overdueLoans.map(loan => (
                  <div key={loan.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-red-200">
                    <span className="text-sm font-medium">{loan.name}</span>
                    <span className="text-xs text-red-700">due {loan.due_day}th</span>
                    <span className="text-sm text-red-600 font-bold">₹{loan.amount.toLocaleString()}</span>
                    <button
                      onClick={() => handleMarkPaid(loan)}
                      disabled={payingId === loan.id}
                      className={`text-xs px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                        payingId === loan.id
                          ? 'bg-gray-400 text-white cursor-wait'
                          : 'bg-red-600 text-white hover:bg-red-700 active:scale-95 shadow-sm'
                      }`}
                    >
                      {payingId === loan.id ? 'Processing...' : 'Pay Now'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {dueSoonLoans.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-amber-900">{dueSoonLoans.length} EMI{dueSoonLoans.length > 1 ? 's' : ''} Due Soon</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {dueSoonLoans.map(loan => {
                  const daysUntil = getDaysUntilDue(loan);
                  return (
                    <div key={loan.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-amber-200">
                      <span className="text-sm font-medium">{loan.name}</span>
                      <span className="text-xs text-amber-700">{daysUntil === 0 ? 'due today' : `in ${daysUntil}d`}</span>
                      <span className="text-sm text-amber-600 font-bold">₹{loan.amount.toLocaleString()}</span>
                      <button
                        onClick={() => handleMarkPaid(loan)}
                        disabled={payingId === loan.id}
                        className={`text-xs px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                          payingId === loan.id
                            ? 'bg-gray-400 text-white cursor-wait'
                            : 'bg-amber-600 text-white hover:bg-amber-700 active:scale-95 shadow-sm'
                        }`}
                      >
                        {payingId === loan.id ? 'Processing...' : 'Pay Now'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Loans & EMIs</h2>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Track your fixed monthly payments</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onShowForm}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-xl font-medium shadow-lg shadow-primary-600/20 cursor-pointer"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Loan
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl p-5" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}><DollarSign className="h-5 w-5" /></div>
            <p className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>Monthly EMI</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>₹{totalMonthlyEMI.toLocaleString()}</p>
        </div>

        <div className="rounded-2xl p-5" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ background: 'var(--pos-bg)', color: 'var(--pos)' }}><Calendar className="h-5 w-5" /></div>
            <p className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>Yearly EMI</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>₹{totalYearlyEMI.toLocaleString()}</p>
        </div>

        <div className="rounded-2xl p-5" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}><CheckCircle className="h-5 w-5" /></div>
            <p className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>Active Loans</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>{activeInPeriod.length}</p>
        </div>

        <div className="rounded-2xl p-5" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}><Clock className="h-5 w-5" /></div>
            <p className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>Total Loans</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>{loans.length}</p>
        </div>
      </div>

      {/* Liability Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}><Wallet className="h-5 w-5" /></div>
            <p className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>Total Future EMI Outflow</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>₹{totalRemainingPayout.toLocaleString()}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>Sum of EMI × months left — includes interest, so this will exceed the Outstanding Loans balance</p>
        </div>

        <div className="rounded-2xl p-5" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}><TrendingDown className="h-5 w-5" /></div>
            <p className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>Outstanding Loans</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>₹{Math.round(outstandingLoans.total).toLocaleString()}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>
            {outstandingLoans.trackedCount > 0
              ? `From ${outstandingLoans.trackedCount} loan${outstandingLoans.trackedCount > 1 ? 's' : ''} with a balance entered${outstandingLoans.oldestAsof ? `, oldest as of ${formatDate(outstandingLoans.oldestAsof)}` : ''} — not included in Net Worth`
              : 'Enter a balance from your latest statement when editing a loan to track this'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--ink-faint)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search loans…"
            className="text-sm outline-none"
            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: 'var(--bg-tint)', border: '1px solid var(--hairline)', borderRadius: 12, color: 'var(--ink)' }}
          />
        </div>

        <select
          value={remainingFilter}
          onChange={(e) => setRemainingFilter(e.target.value as RemainingBucket)}
          className="px-3 py-2 text-sm rounded-xl outline-none cursor-pointer"
          style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
        >
          {REMAINING_BUCKETS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
        </select>

        {categories.length > 1 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl outline-none cursor-pointer"
            style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
          >
            <option value="all">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="px-3 py-2 text-sm rounded-xl outline-none cursor-pointer"
          style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
        >
          <option value="due_day">Sort: Due day</option>
          <option value="amount">Sort: EMI amount</option>
          <option value="remaining">Sort: Remaining</option>
          <option value="name">Sort: Name</option>
        </select>

        <label className="flex items-center gap-2 text-sm cursor-pointer px-1" style={{ color: 'var(--ink-soft)' }}>
          <input
            type="checkbox"
            checked={showAllStatuses}
            onChange={(e) => setShowAllStatuses(e.target.checked)}
            className="h-4 w-4 rounded cursor-pointer"
          />
          Show completed/inactive too
        </label>
      </div>

      {/* Loans Table */}
      {visibleLoans.length === 0 ? (
        <div className="pane p-12 text-center">
          <Landmark className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--ink-faint)' }} />
          <h3 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>
            {loans.length === 0 ? 'No loans yet' : 'No loans match these filters'}
          </h3>
          <p className="mt-2" style={{ color: 'var(--ink-muted)' }}>
            {loans.length === 0
              ? 'Add your loans and EMIs to track them automatically.'
              : 'Try clearing the search, category, or remaining-months filter.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: 'color-mix(in srgb, var(--bg-tint) 40%, transparent)', borderBottom: '1px solid var(--hairline)' }}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: 'var(--ink-faint)' }}>Loan</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase" style={{ color: 'var(--ink-faint)' }}>EMI</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: 'var(--ink-faint)' }}>Due Day</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: 'var(--ink-faint)' }}>Duration</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: 'var(--ink-faint)' }}>Remaining</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: 'var(--ink-faint)' }}>Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase" style={{ color: 'var(--ink-faint)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleLoans.map((loan) => {
                  const monthsRemaining = getMonthsRemaining(loan.end_date);
                  const totalMonths = loan.start_date && loan.end_date
                    ? Math.max(1, periodOf(loan.end_date) - periodOf(loan.start_date))
                    : null;
                  const progressPct = totalMonths !== null && monthsRemaining !== null
                    ? Math.min(100, Math.max(0, Math.round(((totalMonths - monthsRemaining) / totalMonths) * 100)))
                    : null;
                  return (
                    <tr key={loan.id} className="group">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                            <Landmark className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold" style={{ color: 'var(--ink)' }}>{loan.name}</p>
                            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>{loan.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-bold" style={{ color: 'var(--ink)' }}>₹{loan.amount.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 text-sm font-medium rounded-lg" style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink-soft)' }}>
                          {loan.due_day}
                          <span className="text-xs ml-1" style={{ color: 'var(--ink-faint)' }}>of month</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
                        {formatDate(loan.start_date)} - {loan.end_date ? formatDate(loan.end_date) : 'Ongoing'}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {monthsRemaining !== null ? (
                          monthsRemaining === 0 ? (
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-lg" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}>
                              Last month
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-lg" 
                              style={{ 
                                background: monthsRemaining <= 3 ? 'var(--pos-bg)' : monthsRemaining <= 12 ? 'var(--warn-bg)' : 'var(--accent-bg)', 
                                color: monthsRemaining <= 3 ? 'var(--pos)' : monthsRemaining <= 12 ? 'var(--warn)' : 'var(--accent)' 
                              }}
                            >
                              {monthsRemaining} months
                            </span>
                          )
                        ) : (
                          <span style={{ color: 'var(--ink-faint)' }}>-</span>
                        )}
                        {progressPct !== null && (
                          <div className="w-20 h-1 rounded-full mt-2 mx-auto overflow-hidden" style={{ background: 'var(--hairline)' }} title={`${progressPct}% paid`}>
                            <div className="h-full rounded-full" style={{ width: `${progressPct}%`, background: 'var(--accent)' }} />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {isViewingCurrentMonth && loan.status === 'active' && loan.paid_this_month ? (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full" style={{ background: 'var(--pos-bg)', color: 'var(--pos)' }}>
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full"
                            style={{
                              background: loan.status === 'active' ? 'var(--pos-bg)' : loan.status === 'completed' ? 'var(--hairline)' : loan.status === 'paused' ? 'var(--accent-bg)' : 'var(--warn-bg)',
                              color: loan.status === 'active' ? 'var(--pos)' : loan.status === 'completed' ? 'var(--ink-muted)' : loan.status === 'paused' ? 'var(--accent)' : 'var(--warn)'
                            }}
                          >
                            {loan.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          {isViewingCurrentMonth && loan.status === 'active' && !loan.paid_this_month && (
                            <button
                              onClick={() => handleMarkPaid(loan)}
                              disabled={payingId === loan.id}
                              className="p-1.5 rounded-lg transition-all cursor-pointer"
                              style={{ color: payingId === loan.id ? 'var(--ink-faint)' : 'var(--pos)' }}
                              title="Mark EMI Paid"
                            >
                              {payingId === loan.id ? (
                                <div className="h-4 w-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--pos)' }} />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => onEdit(loan)}
                            className="p-1.5 rounded-lg cursor-pointer transition-colors"
                            style={{ color: 'var(--ink-faint)' }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(loan.id, loan.name)}
                            className="p-1.5 rounded-lg cursor-pointer transition-colors"
                            style={{ color: 'var(--ink-faint)' }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Note */}
      <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'var(--accent-bg)', border: '1px solid var(--hairline)' }}>
        <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
        <div className="text-sm" style={{ color: 'var(--ink-soft)' }}>
          <p className="font-medium mb-1">How it works</p>
          <p>EMIs due within 7 days appear at the top each month. Tap Pay Now (or the check button) to record the payment — it&apos;s added to your expenses under LOANS/CC and reflected in your cash balance.</p>
        </div>
      </div>
    </div>
  );
}

export default Loans;
