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
    if (isPaid) return { color: 'bg-green-100 text-green-700', text: 'Paid' };
    const daysUntil = getDaysUntilRenewal(dateString);
    if (daysUntil === null) return { color: 'bg-gray-100 text-gray-600', text: 'No date' };
    if (daysUntil < 0) return { color: 'bg-red-100 text-red-700', text: 'Overdue' };
    if (daysUntil <= 7) return { color: 'bg-orange-100 text-orange-700', text: 'Due soon' };
    if (daysUntil <= 30) return { color: 'bg-yellow-100 text-yellow-700', text: 'Upcoming' };
    return { color: 'bg-blue-100 text-blue-700', text: 'Active' };
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
    try {
      await fetch(`/api/subscriptions/${sub.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: sub.amount }),
      });
      onPay(sub);
    } catch (error) {
      console.error('Failed to record payment:', error);
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
        <tr className="hover:bg-gray-50 group">
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${subscription.billing_type === 'monthly' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                <CreditCard className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{subscription.name}</p>
              </div>
            </div>
          </td>
          <td className="px-4 py-3">
            <span className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
              {subscription.category || 'Other'}
            </span>
          </td>
          <td className="px-4 py-3 text-right">
            <span className="font-semibold text-gray-900">₹{subscription.amount.toLocaleString()}</span>
          </td>
          <td className="px-4 py-3 text-center text-sm text-gray-600">
            {formatDate(projectedDate)}
          </td>
          <td className="px-4 py-3 text-center">
            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${status.color}`}>
              {status.text}
            </span>
          </td>
          <td className="px-4 py-3 text-center text-xs text-gray-500">
            {subscription.last_paid_date ? formatDate(subscription.last_paid_date) : '-'}
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!isPaid && (
                <button onClick={() => handleMarkPaid(subscription)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg cursor-pointer" title="Mark Paid">
                  <CheckCircle className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setExpandedPaymentHistory(isExpanded ? null : subscription.id)}
                className={`p-1.5 rounded-lg cursor-pointer ${isExpanded ? 'text-primary-600 bg-primary-50' : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'}`}
                title="Payment History"
              >
                <History className="h-4 w-4" />
              </button>
              <button onClick={() => onEdit(subscription)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg cursor-pointer" title="Edit">
                <Edit2 className="h-4 w-4" />
              </button>
              <button onClick={() => { if (window.confirm(`Delete ${subscription.name}?`)) onDelete(subscription.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer" title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </td>
        </tr>
        {isExpanded && (
          <tr>
            <td colSpan={7} className="bg-gray-50 px-4 py-3">
              <div className="ml-11">
                <p className="text-xs font-medium text-gray-500 mb-2">PAYMENT HISTORY</p>
                {history.length > 0 ? (
                  <div className="space-y-1">
                    {history.slice(0, 5).map((payment, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm max-w-xs">
                        <span className="text-gray-600">{formatDate(payment.paid_date)}</span>
                        <span className="font-medium text-gray-900">₹{payment.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No payment history yet</p>
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
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          onClick={() => toggleSection(type)}
          className="w-full flex items-center justify-between px-5 py-4 bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            {isCollapsed ? <ChevronRight className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            <div className={`p-2 rounded-lg ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="text-left">
              <span className="font-bold text-gray-900">{title}</span>
              <span className="text-sm text-gray-500 ml-2">({subs.length})</span>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-gray-900">₹{total.toLocaleString()}</p>
            <p className="text-xs text-gray-500">{type === 'monthly' ? 'per month' : 'per year'}</p>
          </div>
        </button>

        {!isCollapsed && subs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/50 border-t border-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase w-28">Category</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase w-24">Amount</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase w-24">Due</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase w-24">Status</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase w-24">Last Paid</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subs.map(sub => <SubscriptionRow key={sub.id} subscription={sub} />)}
              </tbody>
            </table>
          </div>
        )}
        {!isCollapsed && subs.length === 0 && (
          <div className="p-6 text-center text-gray-500">No {type} subscriptions</div>
        )}
      </div>
    );
  };

  if (subscriptions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Subscriptions</h2>
          <button onClick={onAdd} className="btn btn-accent cursor-pointer">
            <Plus size={14} /> Add Subscription
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No subscriptions yet</h3>
          <p className="mt-2 text-gray-500">Track your recurring payments and never miss a renewal date.</p>
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
                    <button onClick={() => handleMarkPaid(sub)} className="text-xs bg-red-600 text-white px-2 py-0.5 rounded hover:bg-red-700 cursor-pointer">Pay</button>
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
        <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-blue-100 rounded-lg"><DollarSign className="h-4 w-4 text-blue-600" /></div>
            <p className="text-xs font-medium text-blue-900">Monthly</p>
          </div>
          <p className="text-xl font-bold text-blue-900">₹{monthlyTotal.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-white rounded-2xl border border-purple-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-purple-100 rounded-lg"><Calendar className="h-4 w-4 text-purple-600" /></div>
            <p className="text-xs font-medium text-purple-900">Yearly</p>
          </div>
          <p className="text-xl font-bold text-purple-900">₹{yearlyTotal.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-white rounded-2xl border border-green-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-green-100 rounded-lg"><CheckCircle className="h-4 w-4 text-green-600" /></div>
            <p className="text-xs font-medium text-green-900">Annual Projection</p>
          </div>
          <p className="text-xl font-bold text-green-900">₹{yearlyProjection.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-white rounded-2xl border border-orange-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-orange-100 rounded-lg"><AlertCircle className="h-4 w-4 text-orange-600" /></div>
            <p className="text-xs font-medium text-orange-900">Due Soon</p>
          </div>
          <p className="text-xl font-bold text-orange-900">{dueSoonCount}</p>
          <p className="text-xs text-orange-600">within 7 days</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-white rounded-2xl border border-red-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-red-100 rounded-lg"><X className="h-4 w-4 text-red-600" /></div>
            <p className="text-xs font-medium text-red-900">Overdue</p>
          </div>
          <p className="text-xl font-bold text-red-900">{overdueSubscriptions.length}</p>
          <p className="text-xs text-red-600">needs payment</p>
        </div>
      </div>

      <SubscriptionTable title="Monthly Subscriptions" subscriptions={monthlySubscriptions} total={monthlyTotal} type="monthly" icon={DollarSign} color="bg-blue-100 text-blue-600" />
      <SubscriptionTable title="Yearly Subscriptions" subscriptions={yearlySubscriptions} total={yearlyTotal} type="yearly" icon={Calendar} color="bg-purple-100 text-purple-600" />
    </div>
  );
}

export default Subscriptions;
