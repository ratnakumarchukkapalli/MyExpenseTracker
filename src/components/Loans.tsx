'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, DollarSign, Calendar, Clock, AlertCircle,
  CheckCircle, Landmark,
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
}

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

  const visibleLoans = useMemo(() => loans.filter(l => {
    if (l.status !== 'active') return false;
    if (!l.end_date) return true;
    const end = new Date(l.end_date);
    const endPeriod = end.getFullYear() * 12 + (end.getMonth() + 1);
    return endPeriod >= selectedPeriod;
  }), [loans, selectedPeriod]);

  const activeLoans = useMemo(() => loans.filter(l => l.status === 'active'), [loans]);
  const totalMonthlyEMI = useMemo(() => visibleLoans.reduce((sum, l) => sum + (l.amount || 0), 0), [visibleLoans]);
  const totalYearlyEMI = totalMonthlyEMI * 12;

  // Banner logic runs against the real current month (EMIs are paid now, not in the viewed month)
  const today = new Date();
  const realPeriod = today.getFullYear() * 12 + (today.getMonth() + 1);
  const isViewingCurrentMonth = currentMonth === today.getMonth() + 1 && currentYear === today.getFullYear();

  const getDaysUntilDue = (loan: Loan) => {
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dueDate = new Date(today.getFullYear(), today.getMonth(), Math.min(loan.due_day, daysInMonth));
    return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  // CC EMIs (IGo, New EMI, PolicyBazaar, paytm, etc.) are paid as one lump credit card
  // statement, not individually — only real fixed EMIs get due-soon/overdue tracking.
  const BANNER_TRACKED_LOANS = new Set(['solar', 'home loan']);

  const payableLoans = useMemo(() => loans.filter(l => {
    if (l.status !== 'active' || l.paid_this_month) return false;
    if (!BANNER_TRACKED_LOANS.has(l.name.trim().toLowerCase())) return false;
    if (!l.end_date) return true;
    const end = new Date(l.end_date);
    return end.getFullYear() * 12 + (end.getMonth() + 1) >= realPeriod;
  }), [loans, realPeriod]);

  const overdueLoans = payableLoans.filter(l => getDaysUntilDue(l) < 0);
  const dueSoonLoans = payableLoans.filter(l => {
    const d = getDaysUntilDue(l);
    return d >= 0 && d <= 7;
  });

  const getMonthsRemaining = (endDate?: string) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const endPeriod = end.getFullYear() * 12 + (end.getMonth() + 1);
    return Math.max(0, endPeriod - selectedPeriod);
  };

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
          <p className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>{activeLoans.length}</p>
        </div>

        <div className="rounded-2xl p-5" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}><Clock className="h-5 w-5" /></div>
            <p className="text-sm font-medium" style={{ color: 'var(--ink-muted)' }}>Total Loans</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>{loans.length}</p>
        </div>
      </div>

      {/* Loans Table */}
      {visibleLoans.length === 0 ? (
        <div className="pane p-12 text-center">
          <Landmark className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--ink-faint)' }} />
          <h3 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>No loans yet</h3>
          <p className="mt-2" style={{ color: 'var(--ink-muted)' }}>Add your loans and EMIs to track them automatically.</p>
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
                      </td>
                      <td className="px-4 py-4 text-center">
                        {isViewingCurrentMonth && loan.status === 'active' && loan.paid_this_month ? (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full" style={{ background: 'var(--pos-bg)', color: 'var(--pos)' }}>
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full"
                            style={{
                              background: loan.status === 'active' ? 'var(--pos-bg)' : loan.status === 'completed' ? 'var(--hairline)' : 'var(--warn-bg)',
                              color: loan.status === 'active' ? 'var(--pos)' : loan.status === 'completed' ? 'var(--ink-muted)' : 'var(--warn)'
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
