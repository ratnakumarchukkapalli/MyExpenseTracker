'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield, Plus, Edit2, Trash2, AlertTriangle, ChevronDown, ChevronUp,
  Car, Heart, User, X, Check,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrencyLocal(amount: number) {
  if (!amount) return '₹0';
  const lakhs = amount / 100000;
  if (lakhs >= 1) return `₹${lakhs.toFixed(2)} L`;
  const thousands = amount / 1000;
  if (thousands >= 1) return `₹${thousands.toFixed(1)}K`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatDateLocal(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDaysUntil(dateStr?: string) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function annualPremium(policy: any) {
  const amt = policy.premium_amount || 0;
  if (policy.premium_mode === 'monthly') return amt * 12;
  if (policy.premium_mode === 'quarterly') return amt * 4;
  if (policy.premium_mode === 'biennial') return amt / 2;
  return amt;
}

function hasNomineeIssue(policy: any) {
  if (!policy.nominee) return true;
  if (policy.nominee.toUpperCase().includes('NOMINEE NOT REGISTERED')) return true;
  return false;
}

// ── Type config ────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  Life:    { label: 'Life',    color: 'bg-blue-100 text-blue-700',   icon: User  },
  Health:  { label: 'Health',  color: 'bg-green-100 text-green-700', icon: Heart },
  Vehicle: { label: 'Vehicle', color: 'bg-orange-100 text-orange-700', icon: Car },
};

const TYPE_ORDER = ['Life', 'Health', 'Vehicle'];

const EMPTY_FORM = {
  name: '', type: 'Life', insurer: '', policy_number: '',
  sum_insured: '', premium_amount: '', premium_mode: 'yearly',
  start_date: '', end_date: '', next_due_date: '',
  nominee: '', vehicle_reg: '', notes: '', status: 'active', owner: 'self',
};

// ── PolicyCard ─────────────────────────────────────────────────────────────

function PolicyCard({ policy, onEdit, onDelete, onMarkPaid }: any) {
  const [showNotes, setShowNotes] = useState(false);
  const days = getDaysUntil(policy.next_due_date);
  const cfg = TYPE_CONFIG[policy.type] || TYPE_CONFIG.Life;
  const TypeIcon = cfg.icon;
  const nomineeIssue = hasNomineeIssue(policy);

  let dueBadge = null;
  if (days !== null) {
    if (days < 0) dueBadge = <span className="text-xs font-semibold text-red-600">Overdue</span>;
    else if (days <= 30) dueBadge = <span className="text-xs font-semibold text-red-600">Due in {days}d</span>;
    else if (days <= 90) dueBadge = <span className="text-xs font-semibold text-yellow-600">Due in {days}d</span>;
  }

  const premiumLabel = () => {
    const annual = annualPremium(policy);
    const amt = policy.premium_amount || 0;
    const mode = policy.premium_mode;
    if (mode === 'biennial') return `${formatCurrencyLocal(annual)}/yr (${formatCurrencyLocal(amt)}/2yr)`;
    if (mode === 'quarterly') return `${formatCurrencyLocal(annual)}/yr (${formatCurrencyLocal(amt)}/qtr)`;
    if (mode === 'monthly') return `${formatCurrencyLocal(annual)}/yr (${formatCurrencyLocal(amt)}/mo)`;
    return formatCurrencyLocal(annual);
  };

  return (
    <div className="rounded-2xl p-5 shadow-sm transition-shadow" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
            <TypeIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{policy.name}</p>
            <p className="text-xs truncate" style={{ color: 'var(--ink-muted)' }}>{policy.insurer}</p>
            {policy.policy_number && (
              <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--ink-faint)' }}>{policy.policy_number}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
          {days !== null && days <= 30 && policy.premium_mode !== 'single' && (
            <button onClick={() => onMarkPaid(policy.id)} title="Mark as paid" className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--pos)' }}>
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={() => onEdit(policy)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--ink-faint)' }}>
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(policy.id)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--ink-faint)' }}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
        <div>
          <p className="text-xs mb-0.5" style={{ color: 'var(--ink-faint)' }}>Sum Insured / IDV</p>
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>{formatCurrencyLocal(policy.sum_insured)}</p>
        </div>
        <div>
          <p className="text-xs mb-0.5" style={{ color: 'var(--ink-faint)' }}>Premium</p>
          <p className="font-semibold text-xs" style={{ color: 'var(--ink)' }}>{premiumLabel()}</p>
        </div>
        <div>
          <p className="text-xs mb-0.5" style={{ color: 'var(--ink-faint)' }}>Next Due</p>
          <div className="flex items-center gap-1.5">
            <p className={`font-medium ${days !== null && days <= 30 ? 'text-red-600' : days !== null && days <= 90 ? 'text-yellow-600' : ''}`} style={days !== null && days > 90 ? { color: 'var(--ink)' } : {}}>
              {formatDateLocal(policy.next_due_date)}
            </p>
            {dueBadge}
          </div>
        </div>
        <div>
          <p className="text-xs mb-0.5" style={{ color: 'var(--ink-faint)' }}>{policy.type === 'Life' ? 'Maturity Date' : 'Expiry Date'}</p>
          <p className="font-medium" style={{ color: 'var(--ink)' }}>{formatDateLocal(policy.end_date)}</p>
        </div>
      </div>

      <div className="mb-2">
        <p className="text-xs mb-0.5" style={{ color: 'var(--ink-faint)' }}>Nominee</p>
        {nomineeIssue ? (
          <p className="text-sm font-semibold text-red-600 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Not Registered
          </p>
        ) : (
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{policy.nominee}</p>
        )}
      </div>

      {policy.type === 'Vehicle' && policy.vehicle_reg && (
        <div className="mb-2">
          <p className="text-xs mb-0.5" style={{ color: 'var(--ink-faint)' }}>Vehicle Reg</p>
          <p className="text-sm font-mono" style={{ color: 'var(--ink-soft)' }}>{policy.vehicle_reg}</p>
        </div>
      )}

      {policy.notes && (
        <div className="border-t border-gray-100 pt-2 mt-2">
          <button onClick={() => setShowNotes(v => !v)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            {showNotes ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showNotes ? 'Hide Notes' : 'View Notes'}
          </button>
          {showNotes && <p className="mt-1.5 text-xs text-gray-600 leading-relaxed">{policy.notes}</p>}
        </div>
      )}
    </div>
  );
}

// ── PolicyForm ─────────────────────────────────────────────────────────────

function PolicyForm({ policy, onSubmit, onCancel, defaultOwner }: any) {
  const [form, setForm] = useState(policy ? {
    name: policy.name || '', type: policy.type || 'Life', insurer: policy.insurer || '',
    policy_number: policy.policy_number || '', sum_insured: policy.sum_insured || '',
    premium_amount: policy.premium_amount || '', premium_mode: policy.premium_mode || 'yearly',
    start_date: policy.start_date || '', end_date: policy.end_date || '',
    next_due_date: policy.next_due_date || '', nominee: policy.nominee || '',
    vehicle_reg: policy.vehicle_reg || '', notes: policy.notes || '',
    status: policy.status || 'active', owner: policy.owner || 'self',
  } : { ...EMPTY_FORM, owner: defaultOwner || 'self' });

  const set = (field: string, value: string) => setForm((f: any) => ({ ...f, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.insurer.trim()) { alert('Name and Insurer are required.'); return; }
    onSubmit({ ...form, sum_insured: parseFloat(form.sum_insured) || 0, premium_amount: parseFloat(form.premium_amount) || 0 });
  };

  const inputClass = 'w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm';
  const labelClass = 'block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-md transition-opacity"
        onClick={onCancel}
      />

      {/* Light Glass Modal */}
      <div className="relative z-10 w-full max-w-2xl rounded-[24px] shadow-[0_32px_80px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col max-h-[90vh]" style={{ background: 'var(--pane-strong)', backdropFilter: 'blur(32px)', border: '1px solid var(--hairline)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: 'var(--hairline)', background: 'var(--accent-bg)' }}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-1" style={{ color: 'var(--ink-faint)' }}>Insurance</div>
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--ink)' }}>{policy ? 'Edit Policy' : 'Add Insurance Policy'}</h2>
          </div>
          <button
            onClick={onCancel}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-all cursor-pointer"
            style={{ background: 'var(--hairline)', color: 'var(--ink-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className={labelClass}>Policy Name *</label>
              <input className={inputClass} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. LIC Bima Shree" required />
            </div>
            <div>
              <label className={labelClass}>Belongs To</label>
              <select className={inputClass + ' cursor-pointer'} value={form.owner} onChange={e => set('owner', e.target.value)}>
                <option value="self">My Policy</option>
                <option value="dad">Family</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Type *</label>
              <select className={inputClass + ' cursor-pointer'} value={form.type} onChange={e => set('type', e.target.value)}>
                <option value="Life">Life</option>
                <option value="Health">Health</option>
                <option value="Vehicle">Vehicle</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass + ' cursor-pointer'} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="lapsed">Lapsed</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Insurer *</label>
            <input className={inputClass} value={form.insurer} onChange={e => set('insurer', e.target.value)} placeholder="e.g. LIC" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Policy Number</label>
              <input className={inputClass} value={form.policy_number} onChange={e => set('policy_number', e.target.value)} placeholder="Policy number" />
            </div>
            <div>
              <label className={labelClass}>Nominee</label>
              <input className={inputClass} value={form.nominee} onChange={e => set('nominee', e.target.value)} placeholder="Full name & relationship" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Sum Insured (₹)</label>
              <input className={inputClass} type="number" value={form.sum_insured} onChange={e => set('sum_insured', e.target.value)} placeholder="0" min="0" />
            </div>
            <div>
              <label className={labelClass}>Premium Amount (₹)</label>
              <input className={inputClass} type="number" value={form.premium_amount} onChange={e => set('premium_amount', e.target.value)} placeholder="0" min="0" />
            </div>
            <div>
              <label className={labelClass}>Premium Mode</label>
              <select className={inputClass + ' cursor-pointer'} value={form.premium_mode} onChange={e => set('premium_mode', e.target.value)}>
                <option value="yearly">Yearly</option>
                <option value="biennial">2-Year</option>
                <option value="quarterly">Quarterly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Start Date</label>
              <input className={inputClass + ' cursor-pointer'} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{form.type === 'Life' ? 'Maturity Date' : 'Expiry Date'}</label>
              <input className={inputClass + ' cursor-pointer'} type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Next Due Date</label>
              <input className={inputClass + ' cursor-pointer'} type="date" value={form.next_due_date} onChange={e => set('next_due_date', e.target.value)} />
            </div>
          </div>

          {form.type === 'Vehicle' && (
            <div>
              <label className={labelClass}>Vehicle Registration Number</label>
              <input className={inputClass} value={form.vehicle_reg} onChange={e => set('vehicle_reg', e.target.value)} placeholder="e.g. TS08HW0689" />
            </div>
          )}

          <div>
            <label className={labelClass}>Notes</label>
            <textarea className={`${inputClass} resize-none`} rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Reminders…" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="button" 
              onClick={onCancel} 
              className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 py-3.5 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              {policy ? 'Save Changes' : 'Add Policy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
// ── PoliciesView ───────────────────────────────────────────────────────────

function PoliciesView({ policies, onEdit, onDelete, onMarkPaid }: any) {
  const grouped = TYPE_ORDER.reduce((acc: Record<string, any[]>, type) => {
    acc[type] = policies.filter((p: any) => p.type === type);
    return acc;
  }, {});

  if (policies.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">No insurance policies yet</p>
        <p className="text-xs mt-1">Add a policy using the button above</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {TYPE_ORDER.map(type => {
        const list = grouped[type];
        if (!list || list.length === 0) return null;
        const cfg = TYPE_CONFIG[type];
        const TypeIcon = cfg.icon;
        return (
          <div key={type}>
            <div className="flex items-center gap-2 mb-3">
              <TypeIcon className="h-4 w-4" style={{ color: 'var(--ink-muted)' }} />
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-soft)' }}>{type} Insurance</h2>
              <span className="text-xs" style={{ color: 'var(--ink-faint)' }}>({list.length})</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {list.map((policy: any) => (
                <PolicyCard key={policy.id} policy={policy} onEdit={onEdit} onDelete={onDelete} onMarkPaid={onMarkPaid} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Insurance (main page) ──────────────────────────────────────────────────

const Insurance = () => {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'self' | 'family'>('self');

  useEffect(() => { loadPolicies(); }, []);

  const loadPolicies = async () => {
    try {
      const res = await fetch('/api/insurance');
      const data = await res.json();
      setPolicies(data || []);
    } catch (err) {
      console.error('Failed to load insurance policies:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (policy: any) => {
    try {
      await fetch('/api/insurance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(policy) });
      await loadPolicies();
      setShowForm(false);
    } catch (err: any) {
      alert('Failed to add policy: ' + err.message);
    }
  };

  const handleUpdate = async (policy: any) => {
    try {
      await fetch(`/api/insurance/${editingPolicy.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(policy) });
      await loadPolicies();
      setEditingPolicy(null);
      setShowForm(false);
    } catch (err: any) {
      alert('Failed to update policy: ' + err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this policy? This cannot be undone.')) return;
    try {
      await fetch(`/api/insurance/${id}`, { method: 'DELETE' });
      await loadPolicies();
    } catch (err: any) {
      alert('Failed to delete policy: ' + err.message);
    }
  };

  const handleMarkPaid = async (id: number) => {
    try {
      const res = await fetch(`/api/insurance/${id}/pay`, { method: 'POST' });
      const result = await res.json();
      await loadPolicies();
      alert(`Payment recorded. Next due: ${result.newDueDate}`);
    } catch (err: any) {
      alert('Failed to mark as paid: ' + err.message);
    }
  };

  const myPolicies     = policies.filter(p => p.status === 'active' && p.owner !== 'dad');
  const familyPolicies = policies.filter(p => p.status === 'active' && p.owner === 'dad');
  const tabPolicies    = activeTab === 'family' ? familyPolicies : myPolicies;

  const totalAnnualPremium = tabPolicies.reduce((sum, p) => sum + annualPremium(p), 0);
  const totalSumInsured    = tabPolicies.reduce((sum, p) => sum + (p.sum_insured || 0), 0);
  const nomineeWarnings    = tabPolicies.filter(hasNomineeIssue);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gray-100 dark:bg-surface-800" />
              <div className="space-y-2">
                <div className="h-6 w-48 bg-gray-200 dark:bg-surface-800 rounded-lg" />
                <div className="h-3 w-32 bg-gray-100 dark:bg-surface-800 rounded-lg" />
              </div>
            </div>
            <div className="h-10 w-32 bg-gray-100 dark:bg-surface-800 rounded-xl" />
          </div>
          
          <div className="h-10 w-full bg-gray-50 dark:bg-surface-800 rounded-xl mb-5" />

          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-gray-50 dark:bg-surface-800 rounded-xl p-4 space-y-2">
                <div className="h-3 w-16 bg-gray-100 dark:bg-surface-700 rounded" />
                <div className="h-6 w-24 bg-gray-200 dark:bg-surface-700 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* List Skeleton */}
        <div className="space-y-6">
          {[1, 2].map((group) => (
            <div key={group} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 bg-gray-100 dark:bg-surface-800 rounded" />
                <div className="h-4 w-32 bg-gray-200 dark:bg-surface-800 rounded" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[1, 2].map((card) => (
                  <div key={card} className="bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex justify-between">
                      <div className="flex gap-3">
                        <div className="w-9 h-9 bg-gray-100 dark:bg-surface-800 rounded-xl" />
                        <div className="space-y-2">
                          <div className="h-4 w-32 bg-gray-200 dark:bg-surface-800 rounded" />
                          <div className="h-3 w-24 bg-gray-100 dark:bg-surface-800 rounded" />
                        </div>
                      </div>
                      <div className="h-6 w-16 bg-gray-100 dark:bg-surface-800 rounded-full" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {[1, 2, 3, 4].map((j) => (
                        <div key={j} className="space-y-1">
                          <div className="h-3 w-12 bg-gray-100 dark:bg-surface-800 rounded" />
                          <div className="h-4 w-20 bg-gray-200 dark:bg-surface-800 rounded" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {nomineeWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Nominee Not Registered</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {nomineeWarnings.map((p: any) => p.name).join(', ')} — Contact the insurer urgently to register a nominee.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-2xl border p-6" style={{ background: 'var(--pane)', borderColor: 'var(--hairline)' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--ink)' }}>Insurance Policies</h1>
              <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>{myPolicies.length} mine · {familyPolicies.length} family</p>
            </div>
          </div>
          <button
            onClick={() => { setEditingPolicy(null); setShowForm(true); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-all"
          >
            <Plus className="h-4 w-4" />
            Add Policy
          </button>
        </div>

        <div className="flex gap-1 mb-5 rounded-xl p-1" style={{ background: 'var(--bg-tint)' }}>
          <button
            onClick={() => setActiveTab('self')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'self' ? 'shadow-sm' : ''}`}
            style={{ 
              background: activeTab === 'self' ? 'var(--surface-solid)' : 'transparent',
              color: activeTab === 'self' ? 'var(--accent)' : 'var(--ink-muted)'
            }}
          >
            My Policies ({myPolicies.length})
          </button>
          <button
            onClick={() => setActiveTab('family')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'family' ? 'shadow-sm' : ''}`}
            style={{ 
              background: activeTab === 'family' ? 'var(--surface-solid)' : 'transparent',
              color: activeTab === 'family' ? 'var(--accent)' : 'var(--ink-muted)'
            }}
          >
            Family ({familyPolicies.length})
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-tint)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--ink-faint)' }}>Annual Premium</p>
            <p className="text-xl font-bold" style={{ color: 'var(--ink)' }}>{formatCurrencyLocal(totalAnnualPremium)}</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-tint)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--ink-faint)' }}>Total Sum Insured</p>
            <p className="text-xl font-bold" style={{ color: 'var(--ink)' }}>{formatCurrencyLocal(totalSumInsured)}</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--bg-tint)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--ink-faint)' }}>Active Policies</p>
            <p className="text-xl font-bold" style={{ color: 'var(--ink)' }}>{tabPolicies.length}</p>
          </div>
        </div>
      </div>

      <PoliciesView
        policies={tabPolicies}
        onEdit={(p: any) => { setEditingPolicy(p); setShowForm(true); }}
        onDelete={handleDelete}
        onMarkPaid={handleMarkPaid}
      />

      {showForm && (
        <PolicyForm
          policy={editingPolicy}
          onSubmit={editingPolicy ? handleUpdate : handleAdd}
          onCancel={() => { setShowForm(false); setEditingPolicy(null); }}
          defaultOwner={activeTab === 'family' ? 'dad' : 'self'}
        />
      )}
    </div>
  );
};

export default Insurance;
