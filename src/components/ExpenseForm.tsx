'use client';

import React, { useState, useEffect } from 'react';
import { EXPENSE_CATEGORIES, CATEGORY_COLORS } from '../constants/categories';
import { X, Check, Save } from 'lucide-react';

interface ExpenseData {
  id?: number;
  date?: string;
  description?: string;
  amount?: number;
  category?: string;
  note?: string;
  tag?: string;
  payment_source?: string;
}

interface Props {
  expense?: ExpenseData | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  defaultDate?: string;
}



const LAST_PAYMENT_SOURCE_KEY = 'met_last_payment_source';

function ExpenseForm({ expense, onSubmit, onCancel, defaultDate }: Props) {
  const lastSource = (typeof window !== 'undefined'
    ? (localStorage.getItem(LAST_PAYMENT_SOURCE_KEY) as 'bank' | 'sodexo' | 'savings' | 'credit_card' | null)
    : null) ?? 'bank';

  const [formData, setFormData] = useState({
    date: defaultDate ?? new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    category: 'Personal',
    note: '',
    tag: '',
    payment_source: lastSource,
  });

  useEffect(() => {
    if (expense) {
      setFormData({
        date: expense.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0],
        description: expense.description || '',
        amount: expense.amount?.toString() || '',
        category: expense.category || 'Personal',
        note: expense.note || '',
        tag: expense.tag || '',
        payment_source: (expense.payment_source || 'bank') as 'bank' | 'sodexo' | 'savings' | 'credit_card',
      });
    }
  }, [expense]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim() || !formData.amount || isSubmitting) {
      if (!formData.description.trim() || !formData.amount) alert('Please enter a description and amount');
      return;
    }
    setIsSubmitting(true);
    try {
      if (!expense) {
        localStorage.setItem(LAST_PAYMENT_SOURCE_KEY, formData.payment_source);
      }
      await onSubmit({ ...formData, amount: parseFloat(formData.amount) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-md transition-opacity"
        onClick={onCancel}
      />

      {/* Light Glass Modal */}
      <div className="relative z-10 w-full max-w-md rounded-[24px] shadow-[0_32px_80px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col max-h-[90dvh]" style={{ background: 'var(--pane-strong)', backdropFilter: 'blur(32px)', border: '1px solid var(--hairline)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b shrink-0" style={{ borderColor: 'var(--hairline)', background: 'var(--accent-bg)' }}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] mb-1" style={{ color: 'var(--ink-faint)' }}>
              {expense ? 'Edit record' : 'Quick add'}
            </div>
            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
              {expense ? 'Update Expense' : 'New Expense'}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-all cursor-pointer"
            style={{ background: 'var(--hairline)', color: 'var(--ink-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* Description */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="What did you spend on?"
              required
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm"
              style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
            />
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-medium text-sm" style={{ color: 'var(--ink-muted)' }}>₹</span>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm"
                  style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                required
                className="w-full px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm"
                style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
              />
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--ink-faint)' }}>Category</label>
            <div className="flex flex-wrap gap-2">
              {EXPENSE_CATEGORIES.map((cat) => {
                const active = formData.category === cat;
                const color = CATEGORY_COLORS[cat] || '#3B82F6';
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, category: cat }))}
                    className={`
                      px-3 py-1.5 rounded-full text-[11px] font-bold border-2 transition-all flex items-center gap-1.5 cursor-pointer
                      ${active
                        ? 'border-transparent text-white shadow-sm'
                        : 'text-gray-400 hover:border-gray-200'}
                    `}
                    style={{
                      backgroundColor: active ? color : 'var(--bg-tint)',
                      borderColor: active ? 'transparent' : 'var(--hairline)',
                      color: active ? 'white' : 'var(--ink-muted)'
                    }}
                  >
                    {active && <Check size={12} />}
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>


          {/* Payment Source */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>Paid from</label>
            <div className="flex flex-wrap gap-2">
              {(['bank', 'sodexo', 'savings', 'credit_card'] as const).map((src) => {
                const active = formData.payment_source === src;
                const colors: Record<string, string> = {
                  bank: 'var(--accent)',
                  sodexo: '#f97316',
                  savings: '#16a34a',
                  credit_card: '#4f46e5',
                };
                const labels: Record<string, string> = {
                  bank: 'Bank',
                  sodexo: 'Sodexo',
                  savings: 'Savings',
                  credit_card: 'Credit Card',
                };
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, payment_source: src }))}
                    className="px-4 py-2 rounded-full text-[11px] font-bold border-2 transition-all cursor-pointer"
                    style={{
                      backgroundColor: active ? colors[src] : 'var(--bg-tint)',
                      borderColor: active ? 'transparent' : 'var(--hairline)',
                      color: active ? 'white' : 'var(--ink-muted)',
                    }}
                  >
                    {labels[src]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tag */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>Tag (optional)</label>
            <input
              type="text"
              value={formData.tag}
              onChange={(e) => setFormData((p) => ({ ...p, tag: e.target.value }))}
              placeholder="e.g. Goa Trip"
              className="w-full px-4 py-2.5 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm"
              style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>Note (optional)</label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData((p) => ({ ...p, note: e.target.value }))}
              placeholder="Any details…"
              rows={2}
              className="w-full px-4 py-3 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none"
              style={{ background: 'var(--surface-solid)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
            />
          </div>

        </div>

          {/* Actions */}
          <div className="flex items-center gap-3 px-6 py-4 border-t shrink-0" style={{ borderColor: 'var(--hairline)' }}>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all cursor-pointer"
              style={{ background: 'var(--hairline)', color: 'var(--ink-muted)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 py-3.5 rounded-2xl text-white font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isSubmitting ? 'bg-blue-400 cursor-not-allowed shadow-none' : 'bg-blue-600 shadow-blue-600/20 hover:bg-blue-700'
              }`}
            >
              <Save size={18} />
              {isSubmitting ? 'Saving...' : (expense ? 'Update Expense' : 'Save Expense')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ExpenseForm;
