'use client';

import React from 'react';
import { X } from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '../constants/categories';

type Expense = {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  category: string | null;
  expenses: Expense[];
};

export default function CategoryDrillDown({ isOpen, onClose, category, expenses }: Props) {
  if (!isOpen || !category) return null;

  const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const sorted = [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const largest = sorted.length > 0 ? Math.max(...sorted.map(e => Number(e.amount || 0))) : 0;
  const Icon = CATEGORY_ICONS[category];
  const catColor = CATEGORY_COLORS[category] || '#6366f1';

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-6" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300" />

      {/* Modal */}
      <div
        className="relative pane-strong w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 shadow-2xl"
        style={{ borderRadius: 'var(--r-xl)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--hairline)]">
          <div className="flex items-center gap-3">
            <div 
              className="h-11 w-11 rounded-xl flex items-center justify-center text-white shadow-sm"
              style={{ background: catColor }}
            >
              {Icon ? <Icon size={24} /> : <span className="text-xl">📁</span>}
            </div>
            <div>
              <h3 className="text-xl font-bold text-[var(--ink)] serif">{category}</h3>
              <p className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--ink-faint)]">
                {sorted.length} transaction{sorted.length !== 1 ? 's' : ''} this month
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="h-9 w-9 rounded-full hover:bg-[var(--accent-bg)] flex items-center justify-center text-[var(--ink-muted)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Summary strip */}
        <div className="flex divide-x divide-[var(--hairline)] bg-[var(--surface)] border-b border-[var(--hairline)]">
          <div className="flex-1 px-5 py-4">
            <p className="eyebrow mb-1">Total spent</p>
            <p className="text-xl font-bold text-[var(--ink)] serif">₹{total.toLocaleString('en-IN')}</p>
          </div>
          <div className="flex-1 px-5 py-4">
            <p className="eyebrow mb-1">Largest</p>
            <p className="text-xl font-bold text-[var(--ink)] serif">₹{largest.toLocaleString('en-IN')}</p>
          </div>
          <div className="flex-1 px-5 py-4 text-right sm:text-left">
            <p className="eyebrow mb-1">Average</p>
            <p className="text-xl font-bold text-[var(--ink)] serif">
              ₹{sorted.length > 0 ? Math.round(total / sorted.length).toLocaleString('en-IN') : 0}
            </p>
          </div>
        </div>

        {/* Transaction list */}
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--hairline)] bg-[var(--bg-tint)]/30">
          {sorted.length === 0 ? (
            <div className="text-center py-16 text-[var(--ink-faint)] serif italic">No transactions for this category.</div>
          ) : (
            sorted.map(expense => {
              const amount = Number(expense.amount || 0);
              const barPct = largest > 0 ? (amount / largest) * 100 : 0;
              return (
                <div key={expense.id} className="px-6 py-5 hover:bg-[var(--surface)] transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-[var(--ink-soft)] text-sm group-hover:text-[var(--accent)] transition-colors">
                        {expense.description}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide font-medium text-[var(--ink-faint)] mt-0.5">
                        {new Date(expense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <span className="font-bold text-[var(--ink)] text-sm serif">₹{amount.toLocaleString('en-IN')}</span>
                  </div>
                  {/* Proportion bar */}
                  <div className="h-1 bg-[var(--hairline)] rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-700 ease-out" 
                      style={{ width: `${barPct}%`, background: catColor }} 
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
