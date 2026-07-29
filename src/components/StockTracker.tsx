'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Plus, Trash2, X, Edit2, Check,
  RefreshCw, AlertCircle, CheckCircle, BarChart2, Undo2, IndianRupee,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { computeDelta, fetchWealthDeltas, type WealthDeltasResponse } from '@/lib/wealth-delta';

// ── Types ──────────────────────────────────────────────────────────────────

interface StockHolding {
  id: number;
  ticker: string;
  company_name: string;
  shares: number;
  buy_price: number;
  buy_date?: string | null;
  current_price?: number | null;
  prev_close?: number | null;
  last_updated?: string | null;
  notes?: string | null;
  av_symbol?: string | null;
}

interface ChartDatum {
  ticker: string;
  company: string;
  invested: number;
  currentValue: number | null;
  gain: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const gainClass = (val: number) =>
  val >= 0 ? 'text-[var(--pos)]' : 'text-[var(--neg)]';

const gainBg = (val: number) =>
  val >= 0 ? 'bg-[var(--pos-bg)]' : 'bg-[var(--neg-bg)]';

const holdingPeriod = (buyDate?: string | null) => {
  if (!buyDate) return null;
  const start = new Date(buyDate);
  const now = new Date();
  const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  return months > 0 ? `${years}y ${months}mo` : `${years}y`;
};

// ── Add Stock Modal ─────────────────────────────────────────────────────────

interface AddStockModalProps {
  onClose: () => void;
  onAdd: () => void;
  currentMonth: number;
  currentYear: number;
}

const AddStockModal = ({ onClose, onAdd, currentMonth, currentYear }: AddStockModalProps) => {
  const [form, setForm] = useState({
    ticker: '',
    company_name: '',
    shares: '',
    buy_price: '',
    buy_date: new Date().toISOString().split('T')[0],
    current_price: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.ticker.trim()) { setError('Ticker symbol is required'); return; }
    if (!form.company_name.trim()) { setError('Company name is required'); return; }
    if (!form.shares || isNaN(parseFloat(form.shares)) || parseFloat(form.shares) <= 0) {
      setError('Enter a valid number of shares'); return;
    }
    if (!form.buy_price || isNaN(parseFloat(form.buy_price)) || parseFloat(form.buy_price) <= 0) {
      setError('Enter a valid buy price'); return;
    }

    setSaving(true);
    try {
      await fetch(`/api/stocks?month=${currentMonth}&year=${currentYear}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker:        form.ticker.trim().toUpperCase(),
          company_name:  form.company_name.trim(),
          shares:        parseFloat(form.shares),
          buy_price:     parseFloat(form.buy_price),
          buy_date:      form.buy_date || null,
          current_price: form.current_price ? parseFloat(form.current_price) : null,
          notes:         form.notes.trim() || null,
        }),
      });
      onAdd();
      onClose();
    } catch (err) {
      setError('Failed to save: ' + String(err));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none";

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-md transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Premium Glass Modal */}
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-surface-900/90 backdrop-blur-2xl border border-gray-100 dark:border-surface-800 rounded-[32px] shadow-[0_32px_80px_rgba(0,0,0,0.15)] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 dark:border-surface-800 bg-gray-50/50 dark:bg-surface-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
              <TrendingUp size={18} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.12em] mb-1">Portfolio</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight serif">Add Stock Holding</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-surface-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-surface-700 hover:text-gray-900 dark:hover:text-gray-100 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-2xl text-sm text-red-600 dark:text-red-400 animate-in slide-in-from-top-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Ticker Symbol *</label>
              <input 
                type="text" 
                value={form.ticker} 
                onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
                placeholder="e.g. LAURUS" 
                className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-2xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all text-sm uppercase font-bold" 
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Buy Date</label>
              <input 
                type="date" 
                value={form.buy_date} 
                onChange={e => setForm(f => ({ ...f, buy_date: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-2xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all text-sm cursor-pointer" 
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Company Name *</label>
            <input 
              type="text" 
              value={form.company_name} 
              onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
              placeholder="e.g. Laurus Labs" 
              className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-2xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all text-sm" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Shares *</label>
              <input 
                type="number" 
                value={form.shares} 
                onChange={e => setForm(f => ({ ...f, shares: e.target.value }))}
                placeholder="0" 
                min="0" 
                step="any" 
                className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-2xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all text-sm font-bold tabular-nums" 
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Avg Buy Price (₹) *</label>
              <input 
                type="number" 
                value={form.buy_price} 
                onChange={e => setForm(f => ({ ...f, buy_price: e.target.value }))}
                placeholder="0.00" 
                min="0" 
                step="any" 
                className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-2xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all text-sm font-bold tabular-nums" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Current Price (₹)</label>
              <input 
                type="number" 
                value={form.current_price} 
                onChange={e => setForm(f => ({ ...f, current_price: e.target.value }))}
                placeholder="Optional" 
                min="0" 
                step="any" 
                className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-2xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all text-sm font-bold tabular-nums" 
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Notes</label>
              <input 
                type="text" 
                value={form.notes} 
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional" 
                className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-2xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all text-sm" 
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-4 rounded-2xl border border-gray-200 dark:border-surface-700 text-gray-600 dark:text-gray-400 font-bold text-sm hover:bg-gray-50 dark:hover:bg-surface-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={saving}
              className="flex-1 py-4 rounded-2xl bg-primary-600 text-white font-bold text-sm shadow-xl shadow-primary-600/20 hover:bg-primary-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
            >
              {saving ? 'Saving...' : 'Add Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Edit Stock Modal ────────────────────────────────────────────────────────

interface EditStockModalProps {
  holding: StockHolding;
  onClose: () => void;
  onSave: () => void;
  currentMonth: number;
  currentYear: number;
}

const EditStockModal = ({ holding, onClose, onSave, currentMonth, currentYear }: EditStockModalProps) => {
  const [form, setForm] = useState({
    ticker:       holding.ticker || '',
    company_name: holding.company_name || '',
    shares:       holding.shares?.toString() || '',
    buy_price:    holding.buy_price?.toString() || '',
    buy_date:     holding.buy_date || '',
    notes:        holding.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.ticker.trim()) { setError('Ticker symbol is required'); return; }
    if (!form.company_name.trim()) { setError('Company name is required'); return; }
    if (!form.shares || isNaN(parseFloat(form.shares)) || parseFloat(form.shares) <= 0) {
      setError('Enter a valid number of shares'); return;
    }
    if (!form.buy_price || isNaN(parseFloat(form.buy_price)) || parseFloat(form.buy_price) <= 0) {
      setError('Enter a valid buy price'); return;
    }

    setSaving(true);
    try {
      await fetch(`/api/stocks/${holding.id}?month=${currentMonth}&year=${currentYear}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker:       form.ticker.trim().toUpperCase(),
          company_name: form.company_name.trim(),
          shares:       parseFloat(form.shares),
          buy_price:    parseFloat(form.buy_price),
          buy_date:     form.buy_date || null,
          notes:        form.notes.trim() || null,
        }),
      });
      onSave();
      onClose();
    } catch (err) {
      setError('Failed to save: ' + String(err));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 outline-none";

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-md transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Premium Glass Modal */}
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-surface-900/90 backdrop-blur-2xl border border-gray-100 dark:border-surface-800 rounded-[32px] shadow-[0_32px_80px_rgba(0,0,0,0.15)] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100 dark:border-surface-800 bg-gray-50/50 dark:bg-surface-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
              <TrendingUp size={18} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.12em] mb-1">Portfolio</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight serif">Update Stock</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-surface-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-surface-700 hover:text-gray-900 dark:hover:text-gray-100 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-2xl text-sm text-red-600 dark:text-red-400 animate-in slide-in-from-top-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Ticker Symbol *</label>
              <input 
                type="text" 
                value={form.ticker} 
                onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
                placeholder="e.g. LAURUS" 
                className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-2xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all text-sm uppercase font-bold" 
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Buy Date</label>
              <input 
                type="date" 
                value={form.buy_date} 
                onChange={e => setForm(f => ({ ...f, buy_date: e.target.value }))}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-2xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all text-sm cursor-pointer" 
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Company Name *</label>
            <input 
              type="text" 
              value={form.company_name} 
              onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
              placeholder="e.g. Laurus Labs" 
              className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-2xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all text-sm" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Shares *</label>
              <input 
                type="number" 
                value={form.shares} 
                onChange={e => setForm(f => ({ ...f, shares: e.target.value }))}
                placeholder="0" 
                min="0" 
                step="any" 
                className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-2xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all text-sm font-bold tabular-nums" 
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Avg Buy Price (₹) *</label>
              <input 
                type="number" 
                value={form.buy_price} 
                onChange={e => setForm(f => ({ ...f, buy_price: e.target.value }))}
                placeholder="0.00" 
                min="0" 
                step="any" 
                className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-2xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all text-sm font-bold tabular-nums" 
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Notes</label>
            <input 
              type="text" 
              value={form.notes} 
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional" 
              className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-2xl text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all text-sm" 
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-4 rounded-2xl border border-gray-200 dark:border-surface-700 text-gray-600 dark:text-gray-400 font-bold text-sm hover:bg-gray-50 dark:hover:bg-surface-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={saving}
              className="flex-1 py-4 rounded-2xl bg-primary-600 text-white font-bold text-sm shadow-xl shadow-primary-600/20 hover:bg-primary-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
            >
              {saving ? 'Saving...' : 'Update Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Inline Price Editor ─────────────────────────────────────────────────────

interface PriceEditorProps {
  holding: StockHolding;
  onPriceUpdate: () => void;
  currentMonth: number;
  currentYear: number;
  isCurrentMonth: boolean;
}

const PriceEditor = ({ holding, onPriceUpdate, currentMonth, currentYear, isCurrentMonth }: PriceEditorProps) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!isCurrentMonth) return;
    const price = parseFloat(value);
    if (isNaN(price) || price <= 0) return;
    setSaving(true);
    try {
      await fetch(`/api/stocks/${holding.id}/price?month=${currentMonth}&year=${currentYear}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price }),
      });
      onPriceUpdate();
    } catch (err) {
      console.error('Price update failed:', err);
    } finally {
      setSaving(false);
      setEditing(false);
      setValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setEditing(false); setValue(''); }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={holding.current_price?.toFixed(2) || '0.00'}
          min="0"
          step="any"
          className="w-24 px-2 py-1 text-xs rounded-lg border border-primary-300 dark:border-primary-700 bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-primary-500 outline-none"
        />
        <button onClick={handleSave} disabled={saving}
          className="p-1 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all disabled:opacity-50">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => { setEditing(false); setValue(''); }}
          className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700 transition-all">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { if (isCurrentMonth) { setEditing(true); setValue(holding.current_price?.toString() || ''); } }}
      disabled={!isCurrentMonth}
      className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors group disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:text-gray-700 dark:disabled:hover:text-gray-300"
      title={isCurrentMonth ? "Click to update price" : "Price editing is only available for the current month"}
    >
      <span className="num font-medium">
        {holding.current_price != null ? `₹${holding.current_price.toFixed(2)}` : 'Set price'}
      </span>
      {isCurrentMonth && <Edit2 className="h-3 w-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" />}
    </button>
  );
};

// ── Sell Stock Modal ────────────────────────────────────────────────────────

interface BankOption { id: number; name: string; }
interface FundOption { id: number; fund_name: string; current_nav: number | null; }

interface AllocationRow { key: number; target: string; amount: string; }

interface SellStockModalProps {
  holding: StockHolding;
  onClose: () => void;
  onSold: () => void;
}

// Net proceeds are matched to allocations at paise precision; anything inside
// half a paisa is float noise, not a real shortfall.
const ALLOC_EPSILON = 0.005;

const SellStockModal = ({ holding, onClose, onSold }: SellStockModalProps) => {
  const [qty, setQty] = useState(String(holding.shares));
  const [price, setPrice] = useState(holding.current_price?.toFixed(2) ?? '');
  const [sellDate, setSellDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [charges, setCharges] = useState('');
  const [broker, setBroker] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<AllocationRow[]>([{ key: 1, target: '', amount: '' }]);
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [funds, setFunds] = useState<FundOption[]>([]);
  const [activeMonth, setActiveMonth] = useState<{ month: number; year: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const nextKey = useRef(2);

  useEffect(() => {
    Promise.all([
      fetch('/api/bank-accounts').then(r => r.ok ? r.json() : []),
      fetch('/api/sip/funds').then(r => r.ok ? r.json() : []),
      fetch('/api/stocks/sell').then(r => r.ok ? r.json() : null),
    ]).then(([b, f, s]) => {
      setBanks(Array.isArray(b) ? b : []);
      setFunds(Array.isArray(f) ? f : []);
      if (s?.active_month) setActiveMonth(s.active_month);
    }).catch(() => {});
  }, []);

  const qtyNum     = parseFloat(qty) || 0;
  const priceNum   = parseFloat(price) || 0;
  const chargesNum = parseFloat(charges) || 0;
  const gross      = qtyNum * priceNum;
  const net        = gross - chargesNum;
  const realized   = (priceNum - holding.buy_price) * qtyNum - chargesNum;
  const allocated  = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const unallocated = net - allocated;

  const fundsWithNav = funds.filter(f => f.current_nav != null && f.current_nav > 0);
  const targetLabel = (target: string) => {
    const [kind, rawId] = target.split(':');
    const id = Number(rawId);
    return kind === 'bank'
      ? banks.find(b => b.id === id)?.name ?? ''
      : funds.find(f => f.id === id)?.fund_name ?? '';
  };

  const saleMonth = Number(sellDate.split('-')[1]);
  const saleYear  = Number(sellDate.split('-')[0]);
  const monthMismatch = activeMonth != null && sellDate.length === 10 &&
    (saleMonth !== activeMonth.month || saleYear !== activeMonth.year);

  const canSave =
    qtyNum > 0 && qtyNum <= holding.shares &&
    priceNum > 0 && net > 0 &&
    rows.every(r => r.target && (parseFloat(r.amount) || 0) > 0) &&
    Math.abs(unallocated) < ALLOC_EPSILON;

  const updateRow = (key: number, patch: Partial<AllocationRow>) =>
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));

  const sellAllInto = (target: string) => {
    if (!target) return;
    setRows([{ key: nextKey.current++, target, amount: net.toFixed(2) }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const allocations = rows.map(r => {
        const [kind, rawId] = r.target.split(':');
        const amount = parseFloat(r.amount);
        return kind === 'bank'
          ? { destination: 'bank' as const, bank_account_id: Number(rawId), amount }
          : { destination: 'sip'  as const, sip_fund_id:     Number(rawId), amount };
      });
      const res = await fetch('/api/stocks/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holding_id:  holding.id,
          shares_sold: qtyNum,
          sell_price:  priceNum,
          sell_date:   sellDate,
          charges:     chargesNum,
          broker:      broker.trim() || null,
          notes:       notes.trim() || null,
          allocations,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`);
      }
      onSold();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none";
  const labelCls = "block text-xs font-medium mb-1";

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl" style={{ background: 'var(--pane)', borderColor: 'var(--hairline)' }}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--hairline)' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>
              Sell {holding.ticker}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>
              {holding.company_name} · {holding.shares} shares held · avg buy ₹{holding.buy_price.toFixed(2)}
              {holding.current_price != null && ` · last ₹${holding.current_price.toFixed(2)}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700 transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className={labelCls} style={{ color: 'var(--ink-soft)' }}>Quantity *</label>
              <input type="number" value={qty} onChange={e => setQty(e.target.value)}
                min="0" max={holding.shares} step="any" className={inputCls} required />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--ink-soft)' }}>Sell price *</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                min="0" step="any" className={inputCls} required />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--ink-soft)' }}>Sell date *</label>
              <input type="date" value={sellDate} onChange={e => setSellDate(e.target.value)}
                className={inputCls} required />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--ink-soft)' }}>Charges</label>
              <input type="number" value={charges} onChange={e => setCharges(e.target.value)}
                min="0" step="any" placeholder="0.00" className={inputCls} />
            </div>
          </div>

          {qtyNum > holding.shares && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Only {holding.shares} shares held.
            </p>
          )}

          {monthMismatch && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>
                This sale is dated outside the active budget month
                ({new Date(activeMonth!.year, activeMonth!.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}).
                Closed months keep their frozen portfolio snapshot, so that month&apos;s figures won&apos;t move — only the
                active month and later will reflect it.
              </span>
            </div>
          )}

          {/* Live readout */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-2xl" style={{ background: 'var(--accent-bg)' }}>
            <div>
              <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Gross</p>
              <p className="text-sm font-semibold num" style={{ color: 'var(--ink)' }}>{formatCurrency(gross)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Charges</p>
              <p className="text-sm font-semibold num" style={{ color: 'var(--ink)' }}>−{formatCurrency(chargesNum)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Net proceeds</p>
              <p className="text-sm font-bold num" style={{ color: 'var(--ink)' }}>{formatCurrency(net)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Realized P&amp;L</p>
              <p className={`text-sm font-bold num ${gainClass(realized)}`}>
                {realized >= 0 ? '+' : '−'}{formatCurrency(Math.abs(realized))}
              </p>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>
            Realized P&amp;L is recorded for tax reporting only — it is not added to net worth, because it was
            already counted there as unrealized gain.
          </p>

          {/* Allocations */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                Route proceeds to
              </label>
              <div className="flex items-center gap-2">
                <select
                  value=""
                  onChange={e => sellAllInto(e.target.value)}
                  disabled={net <= 0}
                  className="px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-gray-600 dark:text-gray-400 outline-none disabled:opacity-50"
                >
                  <option value="">Sell all → …</option>
                  {banks.map(b => <option key={`b${b.id}`} value={`bank:${b.id}`}>{b.name}</option>)}
                  {fundsWithNav.map(f => <option key={`f${f.id}`} value={`sip:${f.id}`}>{f.fund_name}</option>)}
                </select>
                <button type="button"
                  onClick={() => setRows(rs => [...rs, { key: nextKey.current++, target: '', amount: '' }])}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all">
                  <Plus className="h-3 w-3" /> Add destination
                </button>
              </div>
            </div>

            {rows.map(row => (
              <div key={row.key} className="flex items-center gap-2">
                <select
                  value={row.target}
                  onChange={e => updateRow(row.key, { target: e.target.value })}
                  className={`${inputCls} flex-1`}
                >
                  <option value="">Select destination…</option>
                  <optgroup label="Bank accounts">
                    {banks.map(b => <option key={`b${b.id}`} value={`bank:${b.id}`}>{b.name}</option>)}
                  </optgroup>
                  <optgroup label="SIP funds">
                    {funds.map(f => (
                      <option key={`f${f.id}`} value={`sip:${f.id}`}
                        disabled={f.current_nav == null || f.current_nav <= 0}>
                        {f.fund_name}
                        {f.current_nav != null && f.current_nav > 0
                          ? ` · NAV ₹${Number(f.current_nav).toFixed(2)}`
                          : ' · refresh NAV first'}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <input
                  type="number" value={row.amount} min="0" step="any" placeholder="Amount"
                  onChange={e => updateRow(row.key, { amount: e.target.value })}
                  className={`${inputCls} w-36`}
                />
                <button type="button"
                  onClick={() => setRows(rs => rs.length > 1 ? rs.filter(r => r.key !== row.key) : rs)}
                  disabled={rows.length === 1}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all disabled:opacity-30">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <div className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium ${
              Math.abs(unallocated) < ALLOC_EPSILON
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
            }`}>
              <span>{Math.abs(unallocated) < ALLOC_EPSILON ? 'Fully allocated' : 'Unallocated'}</span>
              <span className="num font-bold">
                {Math.abs(unallocated) < ALLOC_EPSILON
                  ? formatCurrency(0)
                  : `${unallocated > 0 ? '' : '−'}${formatCurrency(Math.abs(unallocated))}`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: 'var(--ink-soft)' }}>Broker</label>
              <input type="text" value={broker} onChange={e => setBroker(e.target.value)}
                placeholder="Groww" maxLength={100} className={inputCls} />
            </div>
            <div>
              <label className={labelCls} style={{ color: 'var(--ink-soft)' }}>Notes</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                maxLength={500} className={inputCls} />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-2xl border font-semibold text-sm transition-all"
              style={{ borderColor: 'var(--hairline)', color: 'var(--ink-soft)' }}>
              Cancel
            </button>
            <button type="submit" disabled={!canSave || saving}
              className="flex-1 py-3 rounded-2xl bg-primary-600 text-white font-bold text-sm shadow-xl shadow-primary-600/20 hover:bg-primary-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]">
              {saving ? 'Selling…' : 'Confirm sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Realized Gains Panel ────────────────────────────────────────────────────

interface SaleAllocation {
  id: number;
  destination: 'bank' | 'sip';
  amount: number;
  label: string;
}

interface StockSale {
  id: number;
  ticker: string;
  company_name: string | null;
  shares_sold: number;
  sell_price: number;
  sell_date: string;
  avg_buy_price: number;
  gross_proceeds: number;
  charges: number;
  net_proceeds: number;
  realized_pnl: number;
  broker: string | null;
  allocations: SaleAllocation[];
}

// Indian financial year: Apr 1 – Mar 31, labelled by its start year (FY2026-27).
const financialYear = (isoDate: string) => {
  const [y, m] = isoDate.split('-').map(Number);
  const startYear = m >= 4 ? y : y - 1;
  return `FY${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
};

const RealizedGainsPanel = ({ sales, onUndo }: { sales: StockSale[]; onUndo: (id: number) => void }) => {
  if (sales.length === 0) return null;

  const byFY = new Map<string, number>();
  for (const s of sales) {
    const fy = financialYear(s.sell_date);
    byFY.set(fy, (byFY.get(fy) ?? 0) + Number(s.realized_pnl));
  }
  const fyRows = [...byFY.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: 'var(--pane)', borderColor: 'var(--hairline)' }}>
      <div className="flex items-center justify-between p-5 pb-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Realized Gains</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--ink-muted)' }}>
            Booked P&amp;L on sold shares · reporting only, not counted in net worth
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {fyRows.map(([fy, total]) => (
            <div key={fy} className="px-3 py-1.5 rounded-xl text-right" style={{ background: total >= 0 ? 'var(--pos-bg)' : 'var(--neg-bg)' }}>
              <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>{fy}</p>
              <p className={`text-sm font-bold num ${gainClass(total)}`}>
                {total >= 0 ? '+' : '−'}{formatCurrency(Math.abs(total))}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: 'var(--ink-muted)' }}>
              <th className="text-left font-medium px-5 py-2">Stock</th>
              <th className="text-right font-medium px-3 py-2">Qty</th>
              <th className="text-right font-medium px-3 py-2">Buy → Sell</th>
              <th className="text-right font-medium px-3 py-2">Net proceeds</th>
              <th className="text-right font-medium px-3 py-2">Realized P&amp;L</th>
              <th className="text-left font-medium px-3 py-2">Routed to</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {sales.map(s => (
              <tr key={s.id} className="border-t" style={{ borderColor: 'var(--hairline)' }}>
                <td className="px-5 py-3">
                  <span className="font-semibold" style={{ color: 'var(--ink)' }}>{s.ticker}</span>
                  <span className="block" style={{ color: 'var(--ink-faint)' }}>{s.sell_date}</span>
                </td>
                <td className="px-3 py-3 text-right num" style={{ color: 'var(--ink-soft)' }}>{s.shares_sold}</td>
                <td className="px-3 py-3 text-right num" style={{ color: 'var(--ink-soft)' }}>
                  ₹{Number(s.avg_buy_price).toFixed(2)} → ₹{Number(s.sell_price).toFixed(2)}
                </td>
                <td className="px-3 py-3 text-right num font-medium" style={{ color: 'var(--ink)' }}>
                  {formatCurrency(Number(s.net_proceeds))}
                </td>
                <td className={`px-3 py-3 text-right num font-bold ${gainClass(Number(s.realized_pnl))}`}>
                  {Number(s.realized_pnl) >= 0 ? '+' : '−'}{formatCurrency(Math.abs(Number(s.realized_pnl)))}
                </td>
                <td className="px-3 py-3" style={{ color: 'var(--ink-soft)' }}>
                  {s.allocations.map(a => (
                    <span key={a.id} className="block whitespace-nowrap">
                      {a.label} · <span className="num">{formatCurrency(Number(a.amount))}</span>
                    </span>
                  ))}
                </td>
                <td className="px-3 py-3 text-right">
                  <button onClick={() => onUndo(s.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    title="Undo this sale">
                    <Undo2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Stock Card ──────────────────────────────────────────────────────────────

interface StockCardProps {
  holding: StockHolding;
  onDelete: (id: number) => void;
  onEdit: (h: StockHolding) => void;
  onSell: (h: StockHolding) => void;
  onPriceUpdate: () => void;
  currentMonth: number;
  currentYear: number;
  isCurrentMonth: boolean;
}

const StockCard = ({ holding, onDelete, onEdit, onSell, onPriceUpdate, currentMonth, currentYear, isCurrentMonth }: StockCardProps) => {
  const invested = holding.shares * holding.buy_price;
  const currentValue = holding.current_price != null ? holding.shares * holding.current_price : null;
  const gainAmt = currentValue != null ? currentValue - invested : null;
  const gainPct = (gainAmt != null && invested > 0) ? (gainAmt / invested) * 100 : null;
  const period = holdingPeriod(holding.buy_date);

  const dayChange = (holding.current_price != null && holding.prev_close != null)
    ? holding.current_price - holding.prev_close
    : null;
  const dayChangePct = (dayChange != null && holding.prev_close! > 0)
    ? (dayChange / holding.prev_close!) * 100
    : null;
  const dayChangeAmt = dayChange != null ? holding.shares * dayChange : null;

  return (
    <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: 'var(--pane)', borderColor: 'var(--hairline)' }}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex px-2.5 py-1 text-sm font-bold rounded-xl tracking-wide" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                {holding.ticker}
              </span>
              <h3 className="text-sm font-semibold leading-tight truncate" style={{ color: 'var(--ink)' }}>
                {holding.company_name}
              </h3>
              {gainAmt != null && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full" style={{ background: gainAmt >= 0 ? 'var(--pos-bg)' : 'var(--neg-bg)', color: gainAmt >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                  {gainAmt >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {gainPct != null ? `${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(2)}%` : '—'}
                </span>
              )}
              {dayChangePct != null && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border" style={{ background: dayChange! >= 0 ? 'var(--pos-bg)' : 'var(--neg-bg)', color: dayChange! >= 0 ? 'var(--pos)' : 'var(--neg)', borderColor: dayChange! >= 0 ? 'var(--pos-soft)' : 'var(--neg-soft)' }}>
                  {dayChange! >= 0 ? '▲' : '▼'} {dayChangePct >= 0 ? '+' : ''}{dayChangePct.toFixed(2)}% today
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {holding.shares} shares
              {holding.buy_date && ` · Bought ${holding.buy_date}`}
              {period && ` · Held ${period}`}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => onSell(holding)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all"
              style={{ borderColor: 'var(--hairline)', color: 'var(--ink-soft)' }}
              title="Sell shares and route the proceeds">
              <IndianRupee className="h-3 w-3" />
              Sell
            </button>
            <button onClick={() => onEdit(holding)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
              title="Edit holding">
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onDelete(holding.id)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
              title="Delete holding">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <div>
            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Invested</p>
            <p className="text-sm font-semibold num" style={{ color: 'var(--ink-soft)' }}>{formatCurrency(invested)}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Current Value</p>
            <p className="text-sm font-semibold num" style={{ color: 'var(--ink-soft)' }}>
              {currentValue != null ? formatCurrency(currentValue) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Gain / Loss</p>
            <p className={`text-sm font-semibold num ${gainAmt != null ? gainClass(gainAmt) : ''}`} style={!gainAmt ? { color: 'var(--ink-faint)' } : {}}>
              {gainAmt != null ? `${gainAmt >= 0 ? '+' : ''}${formatCurrency(Math.abs(gainAmt))}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Today&apos;s Change</p>
            {dayChangeAmt != null && dayChangePct != null ? (
              <p className={`text-sm font-semibold num ${gainClass(dayChangeAmt)}`}>
                {dayChangeAmt >= 0 ? '+' : ''}{formatCurrency(Math.abs(dayChangeAmt))}
                <span className="text-xs font-normal ml-1">({dayChangePct >= 0 ? '+' : ''}{dayChangePct.toFixed(2)}%)</span>
              </p>
            ) : (
              <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>—</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Buy / Current Price</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-gray-500 dark:text-gray-400 num">₹{holding.buy_price.toFixed(2)}</span>
              <span className="text-gray-300 dark:text-gray-600 text-xs">→</span>
              <PriceEditor
                holding={holding}
                onPriceUpdate={onPriceUpdate}
                currentMonth={currentMonth}
                currentYear={currentYear}
                isCurrentMonth={isCurrentMonth}
              />
            </div>
          </div>
        </div>

        {gainAmt != null && (
          <div className={`mt-3 px-3 py-2 rounded-xl text-xs flex items-center gap-2 ${gainBg(gainAmt)} ${gainClass(gainAmt)}`}>
            {gainAmt >= 0
              ? <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
              : <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            }
            {gainAmt >= 0
              ? `In profit · Current ₹${holding.current_price!.toFixed(2)} vs Buy ₹${holding.buy_price.toFixed(2)}`
              : `In loss · Needs ${Math.abs(gainPct!).toFixed(1)}% rise to break even (₹${(holding.buy_price - holding.current_price!).toFixed(2)}/share gap)`
            }
            {holding.last_updated && (
              <span className="ml-auto text-gray-400 dark:text-gray-500 font-normal">
                Updated {holding.last_updated}
              </span>
            )}
          </div>
        )}

        {holding.notes && (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500 italic">{holding.notes}</p>
        )}
      </div>
    </div>
  );
};

// ── Custom Tooltip ──────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
}

const ChartTooltip = ({ active, payload }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-900 dark:text-gray-100">{d.ticker}</p>
      <p className="text-gray-500 mt-0.5">{d.company}</p>
      <p className="mt-1">Invested: <span className="font-medium num">{formatCurrency(d.invested)}</span></p>
      {d.currentValue != null && (
        <p>Current: <span className={`font-medium num ${gainClass(d.gain)}`}>{formatCurrency(d.currentValue)}</span></p>
      )}
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────

interface StockTrackerProps {
  currentMonth?: number;
  currentYear?: number;
  onPortfolioUpdate?: () => void;
  onPricesRefreshed?: () => void;
  frozenShares?: number;
  activeBudgetMonth?: { month: number; year: number } | null;
}

const StockTracker = ({ currentMonth = new Date().getMonth() + 1, currentYear = new Date().getFullYear(), onPortfolioUpdate, onPricesRefreshed, frozenShares, activeBudgetMonth }: StockTrackerProps) => {
  const { chartColors } = useDarkMode();
  // "The month that owns live values" — the active budget month, matching Dashboard.
  // NOT the calendar month: the two diverge for the last week of every month under
  // the 25th-salary workflow, and on 29 Jul 2026 that made closed July show the live
  // post-sale total (1,99,960) while its own frozen snapshot — which still includes
  // the Laurus Labs position July held at close — reads 3,78,553.80.
  const isCurrentMonth = activeBudgetMonth
    ? currentMonth === activeBudgetMonth.month && currentYear === activeBudgetMonth.year
    : currentMonth === new Date().getMonth() + 1 && currentYear === new Date().getFullYear();
  const [holdings, setHoldings] = useState<StockHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHolding, setEditingHolding] = useState<StockHolding | null>(null);
  const [sellingHolding, setSellingHolding] = useState<StockHolding | null>(null);
  const [sales, setSales] = useState<StockSale[]>([]);
  const [showChart, setShowChart] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<{
    updatedCount?: number; total?: number;
    errors?: { ticker: string }[]; error?: string;
  } | null>(null);
  const autoRefreshedRef = useRef(false);
  const [wealthDeltas, setWealthDeltas] = useState<WealthDeltasResponse | null>(null);

  const loadHoldings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stocks');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setHoldings(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load stocks';
      setError(msg);
      setHoldings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSales = useCallback(async () => {
    try {
      const res = await fetch('/api/stocks/sell');
      if (!res.ok) return;
      const data = await res.json();
      setSales(Array.isArray(data?.sales) ? data.sales : []);
    } catch {
      // Sale history is supplementary — a failure here must not blank the page.
    }
  }, []);

  useEffect(() => {
    loadHoldings();
    loadSales();
  }, [loadHoldings, loadSales]);

  useEffect(() => {
    fetchWealthDeltas(currentMonth, currentYear).then(setWealthDeltas);
  }, [currentMonth, currentYear]);

  useEffect(() => {
    if (loading || holdings.length === 0) return;
    if (!isCurrentMonth) return; // don't auto-refresh live prices while browsing history
    if (autoRefreshedRef.current) return;
    const today = new Date().toISOString().split('T')[0];
    const lastScrape = localStorage.getItem('lastStockScrapeTime');
    const lastScrapeDay = lastScrape ? new Date(parseInt(lastScrape)).toISOString().split('T')[0] : null;
    if (lastScrapeDay === today) return;
    const hasStale = holdings.some(h => h.last_updated !== today);
    if (hasStale) {
      autoRefreshedRef.current = true;
      handleRefreshPrices();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isCurrentMonth]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this stock holding?')) return;
    try {
      await fetch(`/api/stocks/${id}?month=${currentMonth}&year=${currentYear}`, { method: 'DELETE' });
      loadHoldings();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleSold = () => {
    loadHoldings();
    loadSales();
    onPortfolioUpdate?.();
  };

  const handleUndoSale = async (saleId: number) => {
    if (!window.confirm('Undo this sale? Shares are restored and the proceeds are pulled back out of every destination.')) return;
    try {
      const res = await fetch(`/api/stocks/sell/${saleId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`);
      }
      handleSold();
    } catch (err) {
      console.error('Undo failed:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleRefreshPrices = async () => {
    if (!isCurrentMonth) return;
    setRefreshing(true);
    setRefreshStatus(null);
    try {
      const res = await fetch('/api/stocks/refresh-prices', { method: 'POST' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const result = await res.json();
      setRefreshStatus({
        updatedCount: result.updatedCount,
        total:        result.results.length,
        errors:       result.results.filter((r: { success: boolean }) => !r.success),
      });
      localStorage.setItem('lastStockScrapeTime', String(Date.now()));
      loadHoldings();
      onPricesRefreshed?.();
    } catch (err) {
      setRefreshStatus({ error: String(err) });
    } finally {
      setRefreshing(false);
    }
  };

  // totalInvested has no historical snapshot (only the aggregate current-value total is frozen
  // per month), so it stays live for all months — same tradeoff Dashboard already accepts.
  const totalInvested = holdings.reduce((sum, h) => sum + h.shares * h.buy_price, 0);
  const priced = holdings.filter(h => h.current_price != null);
  const liveCurrentValue = priced.reduce((sum, h) => sum + h.shares * h.current_price!, 0);
  const totalCurrentValue = (isCurrentMonth || frozenShares == null) ? liveCurrentValue : frozenShares;
  const totalInvestedPriced = priced.reduce((sum, h) => sum + h.shares * h.buy_price, 0);
  const totalGain = totalCurrentValue - totalInvestedPriced;
  const totalGainPct = totalInvestedPriced > 0 ? (totalGain / totalInvestedPriced) * 100 : 0;
  const unpricedCount = holdings.length - priced.length;
  const stocksMoM = computeDelta(totalCurrentValue, wealthDeltas?.stocks.prevMonth);
  const stocksYoY = computeDelta(totalCurrentValue, wealthDeltas?.stocks.prevYear);

  // Day-change is inherently a "today" concept — meaningless for a past month.
  const dayChangePriced = isCurrentMonth ? priced.filter(h => h.prev_close != null) : [];
  const totalDayChange = dayChangePriced.reduce((sum, h) => sum + h.shares * (h.current_price! - h.prev_close!), 0);
  const totalDayChangePct = dayChangePriced.length > 0
    ? (totalDayChange / dayChangePriced.reduce((sum, h) => sum + h.shares * h.prev_close!, 0)) * 100
    : null;

  const chartData: ChartDatum[] = holdings.map(h => ({
    ticker:       h.ticker,
    company:      h.company_name,
    invested:     h.shares * h.buy_price,
    currentValue: h.current_price != null ? h.shares * h.current_price : null,
    gain:         h.current_price != null ? (h.shares * h.current_price) - (h.shares * h.buy_price) : 0,
  }));

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-gray-200 dark:bg-surface-800 rounded-lg" />
            <div className="h-4 w-32 bg-gray-100 dark:bg-surface-800 rounded-lg" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-24 bg-gray-100 dark:bg-surface-800 rounded-xl" />
            <div className="h-10 w-32 bg-gray-100 dark:bg-surface-800 rounded-xl" />
            <div className="h-10 w-32 bg-gray-100 dark:bg-surface-800 rounded-xl" />
          </div>
        </div>

        {/* Summary Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-2xl p-5 shadow-sm">
              <div className="h-3 w-20 bg-gray-100 dark:bg-surface-800 rounded mb-2" />
              <div className="h-7 w-32 bg-gray-200 dark:bg-surface-800 rounded" />
              <div className="h-3 w-24 bg-gray-50 dark:bg-surface-800 rounded mt-2" />
            </div>
          ))}
        </div>

        {/* Stocks List Skeleton */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-20 bg-primary-100 dark:bg-primary-900/20 rounded-xl" />
                  <div className="h-5 w-40 bg-gray-200 dark:bg-surface-800 rounded" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-8 bg-gray-100 dark:bg-surface-800 rounded-lg" />
                  <div className="h-8 w-8 bg-gray-100 dark:bg-surface-800 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="space-y-1">
                    <div className="h-3 w-16 bg-gray-100 dark:bg-surface-800 rounded" />
                    <div className="h-4 w-24 bg-gray-200 dark:bg-surface-800 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 text-sm font-medium">Failed to load stocks</p>
          <p className="text-gray-400 text-xs mt-1">{error}</p>
          <button
            onClick={() => loadHoldings()}
            className="mt-4 px-4 py-2 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>Stock Holdings</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ink-muted)' }}>
            Direct equity portfolio · {holdings.length} stock{holdings.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {holdings.length > 0 && (
            <button
              onClick={() => setShowChart(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border transition-colors cursor-pointer ${
                showChart
                  ? 'bg-primary-100 text-primary-700 border-primary-200 dark:bg-primary-900/30 dark:text-primary-400 dark:border-primary-800'
                  : 'bg-white dark:bg-surface-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-surface-700 hover:border-primary-300'
              }`}
            >
              <BarChart2 className="h-4 w-4" />
              Chart
            </button>
          )}
          <button
            onClick={handleRefreshPrices}
            disabled={refreshing || holdings.length === 0 || !isCurrentMonth}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-xl hover:border-primary-300 disabled:opacity-50 transition-colors cursor-pointer"
            title={isCurrentMonth ? "Fetch live NSE prices" : "Price refresh is only available for the current month"}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Fetching...' : 'Refresh Prices'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Stock
          </button>
        </div>
      </div>

      {/* Refresh Status Banner */}
      {refreshStatus && !refreshStatus.error && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
          (refreshStatus.errors?.length ?? 0) > 0
            ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
            : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
        }`}>
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span>
            Updated {refreshStatus.updatedCount}/{refreshStatus.total} prices via Yahoo Finance
            {(refreshStatus.errors?.length ?? 0) > 0 && (
              <span className="ml-1 text-yellow-600 dark:text-yellow-400">
                · {refreshStatus.errors?.map(e => e.ticker).join(', ')} not found — check ticker symbol
              </span>
            )}
          </span>
          <button onClick={() => setRefreshStatus(null)} className="ml-auto text-gray-400 hover:text-gray-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {refreshStatus?.error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Failed to fetch prices: {refreshStatus.error}
          <button onClick={() => setRefreshStatus(null)} className="ml-auto text-gray-400 hover:text-gray-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Past-month snapshot notice */}
      {!isCurrentMonth && holdings.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl text-blue-700 dark:text-blue-400">
          <AlertCircle size={14} />
          <span className="text-xs font-medium">
            Viewing {new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}.
            Total Invested, Current Value and Today&apos;s P&amp;L above reflect the frozen month-end snapshot. Individual holding prices below are today&apos;s live prices for reference only.
          </span>
        </div>
      )}

      {/* Summary Cards */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl border shadow-sm p-5" style={{ background: 'var(--pane)', borderColor: 'var(--hairline)' }}>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>Total Invested</p>
            <p className="text-2xl font-bold mt-1 num" style={{ color: 'var(--ink)' }}>{formatCurrency(totalInvested)}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>{holdings.length} holdings</p>
          </div>
          <div className="rounded-2xl border shadow-sm p-5" style={{ background: 'var(--pane)', borderColor: 'var(--hairline)' }}>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>Current Value</p>
            <p className="text-2xl font-bold mt-1 num" style={{ color: 'var(--ink)' }}>
              {priced.length > 0 ? formatCurrency(totalCurrentValue) : '—'}
            </p>
            {unpricedCount > 0 && isCurrentMonth && (
              <p className="text-xs mt-1" style={{ color: 'var(--warn)' }}>
                {unpricedCount} stock{unpricedCount !== 1 ? 's' : ''} missing price
              </p>
            )}
            {!isCurrentMonth && (
              <p className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>Frozen · month-end</p>
            )}
            {(stocksMoM || stocksYoY) && (
              <div className="flex gap-2 mt-1">
                {stocksMoM && (
                  <span className="text-xs font-semibold" style={{ color: stocksMoM.pct >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                    {stocksMoM.pct >= 0 ? '↑' : '↓'}{Math.abs(stocksMoM.pct).toFixed(1)}% MoM
                  </span>
                )}
                {stocksYoY && (
                  <span className="text-xs font-semibold" style={{ color: stocksYoY.pct >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                    {stocksYoY.pct >= 0 ? '↑' : '↓'}{Math.abs(stocksYoY.pct).toFixed(1)}% YoY
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="rounded-2xl border shadow-sm p-5" style={{
            background: priced.length > 0 ? (totalGain >= 0 ? 'var(--pos-bg)' : 'var(--neg-bg)') : 'var(--pane)',
            borderColor: priced.length > 0 ? (totalGain >= 0 ? 'var(--pos-soft)' : 'var(--neg-soft)') : 'var(--hairline)',
            opacity: priced.length > 0 ? 1 : 0.6
          }}>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>Total Gain / Loss</p>
            <p className={`text-2xl font-bold mt-1 num ${priced.length > 0 ? gainClass(totalGain) : ''}`} style={priced.length === 0 ? { color: 'var(--ink-faint)' } : {}}>
              {priced.length > 0
                ? `${totalGain >= 0 ? '+' : ''}${formatCurrency(Math.abs(totalGain))}`
                : '—'}
            </p>
            {priced.length > 0 && (
              <p className={`text-sm font-medium mt-0.5 ${gainClass(totalGainPct)}`}>
                {totalGainPct >= 0 ? '+' : ''}{totalGainPct.toFixed(2)}%
                <span className="ml-1 text-sm"> on priced holdings</span>
              </p>
            )}
          </div>
          <div className="rounded-2xl border shadow-sm p-5" style={{
            background: dayChangePriced.length > 0 ? (totalDayChange >= 0 ? 'var(--pos-bg)' : 'var(--neg-bg)') : 'var(--pane)',
            borderColor: dayChangePriced.length > 0 ? (totalDayChange >= 0 ? 'var(--pos-soft)' : 'var(--neg-soft)') : 'var(--hairline)',
            opacity: dayChangePriced.length > 0 ? 1 : 0.5,
          }}>
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--ink-muted)' }}>Today&apos;s P&amp;L</p>
            <p className={`text-2xl font-bold mt-1 num ${dayChangePriced.length > 0 ? gainClass(totalDayChange) : ''}`} style={dayChangePriced.length === 0 ? { color: 'var(--ink-faint)' } : {}}>
              {dayChangePriced.length > 0
                ? `${totalDayChange >= 0 ? '+' : ''}${formatCurrency(Math.abs(totalDayChange))}`
                : '—'}
            </p>
            {totalDayChangePct != null && (
              <p className={`text-sm font-medium mt-0.5 ${gainClass(totalDayChangePct)}`}>
                {totalDayChangePct >= 0 ? '+' : ''}{totalDayChangePct.toFixed(2)}% vs prev close
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bar Chart */}
      {showChart && holdings.length > 0 && (
        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-gray-100 dark:border-surface-800 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Portfolio Value by Stock</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="30%">
              <XAxis dataKey="ticker" tick={{ fontSize: 11, fill: chartColors.axisText }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: chartColors.axisText }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="invested" name="Invested" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill={chartColors.barInvested} />)}
              </Bar>
              <Bar dataKey="currentValue" name="Current" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.gain >= 0 ? chartColors.barGain : chartColors.barLoss} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-center text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-200 inline-block" />Invested</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-300 inline-block" />Gain</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-300 inline-block" />Loss</span>
          </div>
        </div>
      )}

      {/* Holdings List */}
      {holdings.length === 0 ? (
        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-gray-100 dark:border-surface-800 shadow-sm p-12 text-center">
          <div className="w-14 h-14 bg-primary-50 dark:bg-primary-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="h-7 w-7 text-primary-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">No stocks yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Add your first stock holding to track your direct equity portfolio.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add First Stock
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {holdings.map(h => (
            <StockCard
              key={h.id}
              holding={h}
              onDelete={handleDelete}
              onEdit={setEditingHolding}
              onSell={setSellingHolding}
              onPriceUpdate={() => { loadHoldings(); onPortfolioUpdate?.(); }}
              currentMonth={currentMonth}
              currentYear={currentYear}
              isCurrentMonth={isCurrentMonth}
            />
          ))}
        </div>
      )}

      <RealizedGainsPanel sales={sales} onUndo={handleUndoSale} />

      {/* Modals */}
      {showAddModal && (
        <AddStockModal
          onClose={() => setShowAddModal(false)}
          onAdd={loadHoldings}
          currentMonth={currentMonth}
          currentYear={currentYear}
        />
      )}
      {editingHolding && (
        <EditStockModal
          holding={editingHolding}
          onClose={() => setEditingHolding(null)}
          onSave={loadHoldings}
          currentMonth={currentMonth}
          currentYear={currentYear}
        />
      )}
      {sellingHolding && (
        <SellStockModal
          holding={sellingHolding}
          onClose={() => setSellingHolding(null)}
          onSold={handleSold}
        />
      )}
    </div>
  );
};

export default StockTracker;
