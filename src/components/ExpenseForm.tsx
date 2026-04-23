'use client';

import React, { useState, useEffect } from 'react';
import { EXPENSE_CATEGORIES } from '../constants/categories';
import { X, Check, Save } from 'lucide-react';

interface ExpenseData {
  id?: number;
  date?: string;
  description?: string;
  amount?: number;
  category?: string;
  note?: string;
}

interface Props {
  expense?: ExpenseData | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'HOME Purpose': '#7C3AED',
  'LOANS/CC':    '#DC2626',
  MonthlyBills:  '#D97706',
  Personal:      '#2563EB',
  Savings:       '#059669',
};

function ExpenseForm({ expense, onSubmit, onCancel }: Props) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    category: 'Personal',
    note: '',
  });

  useEffect(() => {
    if (expense) {
      setFormData({
        date: expense.date ? expense.date.split('T')[0] : new Date().toISOString().split('T')[0],
        description: expense.description || '',
        amount: expense.amount?.toString() || '',
        category: expense.category || 'Personal',
        note: expense.note || '',
      });
    }
  }, [expense]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim() || !formData.amount) {
      alert('Please enter a description and amount');
      return;
    }
    onSubmit({ ...formData, amount: parseFloat(formData.amount) });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-md transition-opacity"
        onClick={onCancel}
      />

      {/* Light Glass Modal */}
      <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-2xl border border-white/20 rounded-[24px] shadow-[0_32px_80px_rgba(0,0,0,0.12)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.12em] mb-1">
              {expense ? 'Edit record' : 'Quick add'}
            </div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              {expense ? 'Update Expense' : 'New Expense'}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Description */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="What did you spend on?"
              required
              autoFocus
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm"
            />
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">₹</span>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                  className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm"
              />
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Category</label>
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
                      px-3 py-1.5 rounded-full text-[11px] font-bold border-2 transition-all flex items-center gap-1.5
                      ${active 
                        ? 'border-transparent text-white shadow-sm' 
                        : 'border-gray-100 text-gray-400 hover:border-gray-200'}
                    `}
                    style={{ 
                      backgroundColor: active ? color : '#F9FAFB'
                    }}
                  >
                    {active && <Check size={12} />}
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>


          {/* Note */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Note (optional)</label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData((p) => ({ ...p, note: e.target.value }))}
              placeholder="Any details…"
              rows={2}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3.5 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
            >
              <Save size={18} />
              {expense ? 'Update Expense' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ExpenseForm;
