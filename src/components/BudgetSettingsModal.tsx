'use client';

import React, { useState, useEffect } from 'react';
import { X, SlidersHorizontal, Check } from 'lucide-react';

const CAT_META = [
  { key: 'HOME Purpose', label: 'HOME',    color: '#8b5cf6' },
  { key: 'LOANS/CC',    label: 'Loans',   color: '#ef4444' },
  { key: 'MonthlyBills',label: 'Bills',   color: '#f59e0b' },
  { key: 'Personal',    label: 'Personal',color: '#3b82f6' },
  { key: 'Savings',     label: 'Savings', color: '#10b981' },
];

interface Props {
  salary: number;
  onClose: () => void;
  onSaved: () => void;
}

function BudgetSettingsModal({ salary, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<Record<string, { budget_type: string; budget_value: number | string }>>({});
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    fetch('/api/category-budgets')
      .then(r => r.json())
      .then((data: any[]) => {
        const map: Record<string, any> = {};
        (data || []).forEach(r => {
          map[r.category] = { budget_type: r.budget_type, budget_value: r.budget_value };
        });
        CAT_META.forEach(c => {
          if (!map[c.key]) map[c.key] = { budget_type: 'percentage', budget_value: 0 };
        });
        setRows(map);
      })
      .catch(console.error);
  }, []);

  const setType = (cat: string, type: string) => {
    setRows(prev => ({ ...prev, [cat]: { ...prev[cat], budget_type: type } }));
  };

  const setValue = (cat: string, val: string) => {
    setRows(prev => ({ ...prev, [cat]: { ...prev[cat], budget_value: val } }));
  };

  const computeAmount = (row: any) => {
    if (!row) return 0;
    if (row.budget_type === 'percentage') return (salary * row.budget_value) / 100;
    return row.budget_value;
  };

  const formatHelperAmount = (amount: number) => {
    if (!amount) return '₹0';
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
    if (amount >= 1000) return `₹${Math.round(amount / 1000)}K`;
    return `₹${Math.round(amount)}`;
  };

  const totalPct = CAT_META.reduce((sum, c) => {
    const r = rows[c.key];
    if (r?.budget_type === 'percentage') return sum + (parseFloat(String(r.budget_value)) || 0);
    return sum;
  }, 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        CAT_META.map(c => {
          const r = rows[c.key];
          if (!r) return Promise.resolve();
          return fetch('/api/category-budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: c.key,
              budget_type: r.budget_type,
              budget_value: parseFloat(String(r.budget_value)) || 0,
            }),
          });
        })
      );
      setSavedFlash(true);
      setTimeout(() => {
        setSavedFlash(false);
        onSaved();
        onClose();
      }, 700);
    } catch (err) {
      console.error('Failed to save budgets:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Light Glass Modal */}
      <div className="relative z-10 w-full max-w-lg bg-white/95 backdrop-blur-2xl border border-white/20 rounded-[24px] shadow-[0_32px_80px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <SlidersHorizontal size={18} className="text-indigo-600" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.12em] mb-1">Configuration</div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Budget Settings</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {CAT_META.map(c => {
            const row = rows[c.key] || { budget_type: 'percentage', budget_value: 0 };
            const helperAmt = computeAmount(row);
            const isPercent = row.budget_type === 'percentage';

            return (
              <div key={c.key} className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 bg-gray-50/50 border border-gray-100 rounded-2xl transition-all hover:bg-gray-50">
                <div className="flex items-center gap-2 sm:gap-3 min-w-[75px] sm:min-w-[100px]">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                  <span className="text-sm font-bold text-gray-700">{c.label}</span>
                </div>

                <div className="flex bg-gray-100 rounded-xl p-1 shrink-0">
                  {['percentage', 'fixed'].map(type => (
                    <button
                      key={type}
                      onClick={() => setType(c.key, type)}
                      className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                        row.budget_type === type 
                          ? 'bg-white text-gray-900 shadow-sm' 
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {type === 'percentage' ? '%' : '₹'}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    step={isPercent ? '1' : '1000'}
                    value={row.budget_value}
                    onChange={e => setValue(c.key, e.target.value)}
                    className="w-full px-2 sm:px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all tabular-nums pr-6 sm:pr-8"
                  />
                  <span className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 pointer-events-none">
                    {isPercent ? '%' : '₹'}
                  </span>
                </div>

                <div className="min-w-[45px] sm:min-w-[60px] text-right">
                  <span className="text-[11px] font-bold text-gray-400 tabular-nums">
                    {isPercent && salary > 0 ? formatHelperAmount(helperAmt) : (isPercent ? '—' : '')}
                  </span>
                </div>
              </div>
            );
          })}

          {CAT_META.some(c => rows[c.key]?.budget_type === 'percentage') && (
            <div className={`text-[11px] font-bold text-right px-1 ${
              totalPct === 100 ? 'text-emerald-600' : totalPct > 100 ? 'text-red-600' : 'text-gray-400'
            }`}>
              {totalPct === 100
                ? 'Percent budgets sum to 100% — perfect.'
                : totalPct > 100
                  ? `Percent budgets total ${totalPct}% — over 100%.`
                  : `Percent budgets total ${totalPct}%.`
              }
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-6 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 py-3.5 rounded-2xl font-bold text-sm shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              savedFlash 
                ? 'bg-emerald-600 text-white shadow-emerald-600/20' 
                : 'bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-700'
            } ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {savedFlash ? <><Check size={16} /> Saved</> : saving ? 'Saving…' : 'Save Budgets'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BudgetSettingsModal;
