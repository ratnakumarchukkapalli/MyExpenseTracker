'use client';

import React, { useState, useMemo } from 'react';
import {
  Calendar, DollarSign, AlertCircle, Edit2, Trash2, Plus, CreditCard,
  CheckCircle, Search, Filter, X, History, ChevronDown, ChevronRight,
} from 'lucide-react';

interface Subscription {
  id: number;
  name: string;
  amount: number;
  billing_type: string;
  renewal_date?: string;
  category?: string;
  status?: string;
  last_paid_date?: string;
}

interface Props {
  subscriptions: Subscription[];
  onAdd: () => void;
  onEdit: (sub: Subscription | null) => void;
  onDelete: (id: number) => void;
  onPay: (sub: Subscription) => void;
  currentMonth: number;
  currentYear: number;
}

const CATEGORIES = ['Entertainment', 'Utilities', 'Software', 'Health', 'Finance', 'Shopping', 'Other'];

function Subscriptions({ subscriptions, onAdd, onEdit, onDelete, onPay, currentMonth, currentYear }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedPaymentHistory, setExpandedPaymentHistory] = useState<number | null>(null);
  const [paymentHistory] = useState<Record<number, any[]>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [payingId, setPayingId] = useState<number | null>(null);

  const getProjectedRenewalDate = (sub: Subscription) => {
    if (!sub.renewal_date) return null;
    if (sub.billing_type === 'yearly') return sub.renewal_date;
    const originalDate = new Date(sub.renewal_date);
    const dayOfMonth = originalDate.getDate();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const projectedDay = Math.min(dayOfMonth, daysInMonth);
    return new Date(currentYear, currentMonth - 1, projectedDay).toISOString().split('T')[0];
  };

  const isPaidForSelectedPeriod = (sub: Subscription) => {
    // If it was paid in the selected month/year, it's paid.
    if (sub.last_paid_date) {
      const lastPaid = new Date(sub.last_paid_date);
      // months are 0-indexed in JS Date, but currentMonth is 1-indexed
      if (lastPaid.getMonth() + 1 === currentMonth && lastPaid.getFullYear() === currentYear) {
        return true;
      }
    }

    if (!sub.renewal_date) return false;
    const renewalDate = new Date(sub.renewal_date);
    const selectedMonthEnd = new Date(currentYear, currentMonth, 0);
    renewalDate.setHours(0, 0, 0, 0);
    selectedMonthEnd.setHours(23, 59, 59, 999);
    return renewalDate > selectedMonthEnd;
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const getDaysUntilRenewal = (dateString?: string | null) => {
    if (!dateString) return null;
    const renewalDate = new Date(dateString);
    const today = new Date();
    return Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getRenewalStatus = (dateString?: string | null, isPaid?: boolean) => {
    if (isPaid) return { style: { background: 'var(--pos-bg)', color: 'var(--pos)' }, text: 'Paid' };
    const daysUntil = getDaysUntilRenewal(dateString);
    if (daysUntil === null) return { style: { background: 'var(--hairline)', color: 'var(--ink-muted)' }, text: 'No date' };
    if (daysUntil < 0) return { style: { background: 'var(--neg-bg)', color: 'var(--neg)' }, text: 'Overdue' };
    if (daysUntil <= 7) return { style: { background: 'var(--warn-bg)', color: 'var(--warn)' }, text: 'Due soon' };
    if (daysUntil <= 30) return { style: { background: 'var(--accent-bg)', color: 'var(--accent)' }, text: 'Upcoming' };
    return { style: { background: 'var(--accent-bg)', color: 'var(--accent)' }, text: 'Active' };
  };

  const filteredSubscriptions = useMemo(() => {
    let result = [...subscriptions];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(sub => sub.name.toLowerCase().includes(query));
    }
    if (categoryFilter !== 'all') {
      result = result.filter(sub => (sub.category || 'Other') === categoryFilter);
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [subscriptions, searchQuery, categoryFilter]);

  const monthlySubscriptions = filteredSubscriptions.filter(sub => sub.billing_type === 'monthly');
  const yearlySubscriptions = filteredSubscriptions.filter(sub => sub.billing_type === 'yearly');
  const monthlyTotal = monthlySubscriptions.reduce((sum, sub) => sum + (sub.amount || 0), 0);
  const yearlyTotal = yearlySubscriptions.reduce((sum, sub) => sum + (sub.amount || 0), 0);
  const yearlyProjection = monthlyTotal * 12 + yearlyTotal;

  const overdueSubscriptions = subscriptions.filter(sub => {
    const projectedDate = getProjectedRenewalDate(sub);
    const isPaid = isPaidForSelectedPeriod(sub);
    const daysUntil = getDaysUntilRenewal(projectedDate);
    return !isPaid && daysUntil !== null && daysUntil < 0;
  });

  const dueSoonCount = subscriptions.filter(sub => {
    const projectedDate = getProjectedRenewalDate(sub);
    const isPaid = isPaidForSelectedPeriod(sub);
    const daysUntil = getDaysUntilRenewal(projectedDate);
    return !isPaid && daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;
  }).length;

  const handleMarkPaid = async (sub: Subscription) => {
    if (payingId) return;
    setPayingId(sub.id);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: sub.amount }),
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to record payment');
      }

      onPay(sub);
    } catch (error) {
      console.error('Failed to record payment:', error);
      alert(error instanceof Error ? error.message : 'Failed to record payment');
    } finally {
      setPayingId(null);
    }
  };

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const SubscriptionRow = ({ subscription }: { subscription: Subscription }) => {
    const projectedDate = getProjectedRenewalDate(subscription);
    const isPaid = isPaidForSelectedPeriod(subscription);
    const status = getRenewalStatus(projectedDate, isPaid);
    const isExpanded = expandedPaymentHistory === subscription.id;
    const history = paymentHistory[subscription.id] || [];

    return (
      <>
        <tr className="group" style={{ borderTop: '1px solid var(--hairline)' }}>
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: subscription.billing_type === 'monthly' ? 'var(--accent-bg)' : 'var(--pos-bg)', color: subscription.billing_type === 'monthly' ? 'var(--accent)' : 'var(--pos)' }}>
                <CreditCard className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate" style={{ color: 'var(--ink)' }}>{subscription.name}</p>
              </div>
            </div>
          </td>
          <td className="px-4 py-3">
            <span className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink-soft)' }}>
              {subscription.category || 'Other'}
            </span>
          </td>
          <td className="px-4 py-3 text-right">
            <span className="font-semibold" style={{ color: 'var(--ink)' }}>₹{subscription.amount.toLocaleString()}</span>
          </td>
          <td className="px-4 py-3 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
            {formatDate(projectedDate)}
          </td>
          <td className="px-4 py-3 text-center">
            <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full" style={status.style}>
              {status.text}
            </span>
          </td>
          <td className="px-4 py-3 text-center text-xs" style={{ color: 'var(--ink-faint)' }}>
            {subscription.last_paid_date ? formatDate(subscription.last_paid_date) : '-'}
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              {!isPaid && (
                <button 
                  onClick={() => handleMarkPaid(subscription)} 
                  disabled={payingId === subscription.id}
                  className="p-1.5 rounded-lg transition-all cursor-pointer"
                  style={{ color: payingId === subscription.id ? 'var(--ink-faint)' : 'var(--pos)' }}
                  title="Mark Paid"
                >
                  {payingId === subscription.id ? (
                    <div className="h-4 w-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--pos)' }} />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                </button>
              )}
              <button
                onClick={() => setExpandedPaymentHistory(isExpanded ? null : subscription.id)}
                className="p-1.5 rounded-lg cursor-pointer transition-colors"
                style={{ color: isExpanded ? 'var(--accent)' : 'var(--ink-faint)', background: isExpanded ? 'var(--accent-bg)' : 'transparent' }}
                title="Payment History"
              >
                <History className="h-4 w-4" />
              </button>
              <button onClick={() => onEdit(subscription)} className="p-1.5 rounded-lg cursor-pointer transition-colors" style={{ color: 'var(--ink-faint)' }} title="Edit">
                <Edit2 className="h-4 w-4" />
              </button>
              <button onClick={() => { if (window.confirm(`Delete ${subscription.name}?`)) onDelete(subscription.id); }} className="p-1.5 rounded-lg cursor-pointer transition-colors" style={{ color: 'var(--ink-faint)' }} title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </td>
        </tr>
        {isExpanded && (
          <tr>
            <td colSpan={7} className="px-4 py-3" style={{ background: 'var(--bg-tint)' }}>
              <div className="ml-11">
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--ink-faint)' }}>PAYMENT HISTORY</p>
                {history.length > 0 ? (
                  <div className="space-y-1">
                    {history.slice(0, 5).map((payment, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm max-w-xs">
                        <span style={{ color: 'var(--ink-soft)' }}>{formatDate(payment.paid_date)}</span>
                        <span className="font-medium" style={{ color: 'var(--ink)' }}>₹{payment.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>No payment history yet</p>
                )}
              </div>
            </td>
          </tr>
        )}
      </>
    );
  };

  const SubscriptionTable = ({
    title, subscriptions: subs, total, type, icon: Icon, color,
  }: {
    title: string; subscriptions: Subscription[]; total: number; type: string;
    icon: React.ComponentType<any>; color: string;
  }) => {
    const isCollapsed = collapsedSections[type];
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-sm)' }}>
        <button
          onClick={() => toggleSection(type)}
          className="w-full flex items-center justify-between px-5 py-4 transition-colors cursor-pointer"
          style={{ background: 'color-mix(in srgb, var(--bg-tint) 40%, transparent)' }}
        >
          <div className="flex items-center gap-3">
            {isCollapsed ? <ChevronRight className="h-4 w-4" style={{ color: 'var(--ink-faint)' }} /> : <ChevronDown className="h-4 w-4" style={{ color: 'var(--ink-faint)' }} />}
            <div className={`p-2 rounded-lg ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="text-left">
              <span className="font-bold" style={{ color: 'var(--ink)' }}>{title}</span>
              <span className="text-sm ml-2" style={{ color: 'var(--ink-muted)' }}>({subs.length})</span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold" style={{ color: 'var(--ink)' }}>₹{total.toLocaleString()}</p>
            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>{type === 'monthly' ? 'per month' : 'per year'}</p>
          </div>
        </button>

        {!isCollapsed && subs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead style={{ background: 'transparent', borderTop: '1px solid var(--hairline)' }}>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase" style={{ color: 'var(--ink-faint)' }}>Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase w-28" style={{ color: 'var(--ink-faint)' }}>Category</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase w-24" style={{ color: 'var(--ink-faint)' }}>Amount</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold uppercase w-24" style={{ color: 'var(--ink-faint)' }}>Due</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold uppercase w-24" style={{ color: 'var(--ink-faint)' }}>Status</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold uppercase w-24" style={{ color: 'var(--ink-faint)' }}>Last Paid</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase w-32" style={{ color: 'var(--ink-faint)' }}>Actions</th>
                </tr>
              </thead>
              <tbody style={{ borderTop: '1px solid var(--hairline)' }}>
                {subs.map(sub => <SubscriptionRow key={sub.id} subscription={sub} />)}
              </tbody>
            </table>
          </div>
        )}
        {!isCollapsed && subs.length === 0 && (
          <div className="p-6 text-center" style={{ color: 'var(--ink-faint)' }}>No {type} subscriptions</div>
        )}
      </div>
    );
  };

  if (subscriptions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Subscriptions</h2>
          <button onClick={onAdd} className="btn btn-accent cursor-pointer">
            <Plus size={14} /> Add Subscription
          </button>
        </div>
        <div className="pane p-12 text-center">
          <CreditCard className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--ink-faint)' }} />
          <h3 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>No subscriptions yet</h3>
          <p className="mt-2" style={{ color: 'var(--ink-muted)' }}>Track your recurring payments and never miss a renewal date.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {overdueSubscriptions.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-red-900">{overdueSubscriptions.length} Overdue</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                {overdueSubscriptions.map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-red-200">
                    <span className="text-sm font-medium">{sub.name}</span>
                    <span className="text-sm text-red-600 font-bold">₹{sub.amount.toLocaleString()}</span>
                    <button 
                      onClick={() => handleMarkPaid(sub)} 
                      disabled={payingId === sub.id}
                      className={`text-xs px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                        payingId === sub.id 
                          ? 'bg-gray-400 text-white cursor-wait' 
                          : 'bg-red-600 text-white hover:bg-red-700 active:scale-95 shadow-sm'
                      }`}
                    >
                      {payingId === sub.id ? 'Processing...' : 'Pay Now'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--pane)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid var(--hairline)', borderRadius: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
          {filteredSubscriptions.length} of {subscriptions.length}
        </span>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--ink-faint)' }} />
          <input type="text" placeholder="Search…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 10, fontSize: 13, color: 'var(--ink)', outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className="btn btn-sm cursor-pointer" style={categoryFilter !== 'all' ? { background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'transparent' } : {}}>
          <Filter className="h-4 w-4" /> Filters
        </button>
        <button onClick={onAdd} className="btn btn-sm btn-accent cursor-pointer">
          <Plus size={13} /> Add
        </button>
      </div>

      {showFilters && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 14px', background: 'var(--accent-bg)', borderRadius: 12, border: '1px solid var(--hairline)' }}>
          <button onClick={() => setCategoryFilter('all')} className="btn btn-sm" style={categoryFilter === 'all' ? { background: 'var(--ink)', color: 'var(--bg)' } : {}}>All</button>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)} className="btn btn-sm" style={categoryFilter === cat ? { background: 'var(--ink)', color: 'var(--bg)' } : {}}>{cat}</button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-2xl p-4" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}><DollarSign className="h-4 w-4" /></div>
            <p className="text-xs font-medium" style={{ color: 'var(--ink-muted)' }}>Monthly</p>
          </div>
          <p className="text-xl font-bold" style={{ color: 'var(--ink)' }}>₹{monthlyTotal.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg" style={{ background: 'var(--pos-bg)', color: 'var(--pos)' }}><Calendar className="h-4 w-4" /></div>
            <p className="text-xs font-medium" style={{ color: 'var(--ink-muted)' }}>Yearly</p>
          </div>
          <p className="text-xl font-bold" style={{ color: 'var(--ink)' }}>₹{yearlyTotal.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}><CheckCircle className="h-4 w-4" /></div>
            <p className="text-xs font-medium" style={{ color: 'var(--ink-muted)' }}>Annual Projection</p>
          </div>
          <p className="text-xl font-bold" style={{ color: 'var(--ink)' }}>₹{yearlyProjection.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg" style={{ background: 'var(--warn-bg)', color: 'var(--warn)' }}><AlertCircle className="h-4 w-4" /></div>
            <p className="text-xs font-medium" style={{ color: 'var(--ink-muted)' }}>Due Soon</p>
          </div>
          <p className="text-xl font-bold" style={{ color: 'var(--ink)' }}>{dueSoonCount}</p>
          <p className="text-xs" style={{ color: 'var(--warn)' }}>within 7 days</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg" style={{ background: 'var(--neg-bg)', color: 'var(--neg)' }}><X className="h-4 w-4" /></div>
            <p className="text-xs font-medium" style={{ color: 'var(--ink-muted)' }}>Overdue</p>
          </div>
          <p className="text-xl font-bold" style={{ color: 'var(--ink)' }}>{overdueSubscriptions.length}</p>
          <p className="text-xs" style={{ color: 'var(--neg)' }}>needs payment</p>
        </div>
      </div>

      <SubscriptionTable title="Monthly Subscriptions" subscriptions={monthlySubscriptions} total={monthlyTotal} type="monthly" icon={DollarSign} color="bg-blue-100 text-blue-600" />
      <SubscriptionTable title="Yearly Subscriptions" subscriptions={yearlySubscriptions} total={yearlyTotal} type="yearly" icon={Calendar} color="bg-purple-100 text-purple-600" />
    </div>
  );
}

export default Subscriptions;
