'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Plus, Trash2, X, Edit2, Check,
  RefreshCw, AlertCircle, CheckCircle, BarChart2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

// ── Types ──────────────────────────────────────────────────────────────────

interface StockHolding {
  id: number;
  ticker: string;
  company_name: string;
  shares: number;
  buy_price: number;
  buy_date?: string | null;
  current_price?: number | null;
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
  val >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

const gainBg = (val: number) =>
  val >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20';

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
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
}

const PriceEditor = ({ holding, onPriceUpdate, currentMonth, currentYear }: PriceEditorProps) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
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
      onClick={() => { setEditing(true); setValue(holding.current_price?.toString() || ''); }}
      className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors group"
      title="Click to update price"
    >
      <span className="num font-medium">
        {holding.current_price != null ? `₹${holding.current_price.toFixed(2)}` : 'Set price'}
      </span>
      <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
};

// ── Stock Card ──────────────────────────────────────────────────────────────

interface StockCardProps {
  holding: StockHolding;
  onDelete: (id: number) => void;
  onEdit: (h: StockHolding) => void;
  onPriceUpdate: () => void;
  currentMonth: number;
  currentYear: number;
}

const StockCard = ({ holding, onDelete, onEdit, onPriceUpdate, currentMonth, currentYear }: StockCardProps) => {
  const invested = holding.shares * holding.buy_price;
  const currentValue = holding.current_price != null ? holding.shares * holding.current_price : null;
  const gainAmt = currentValue != null ? currentValue - invested : null;
  const gainPct = (gainAmt != null && invested > 0) ? (gainAmt / invested) * 100 : null;
  const period = holdingPeriod(holding.buy_date);

  return (
    <div className="bg-white dark:bg-surface-900 rounded-2xl border border-gray-100 dark:border-surface-800 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex px-2.5 py-1 text-sm font-bold rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 tracking-wide">
                {holding.ticker}
              </span>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate">
                {holding.company_name}
              </h3>
              {gainAmt != null && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${gainAmt >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                  {gainAmt >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {gainPct != null ? `${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(2)}%` : '—'}
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Invested</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 num">{formatCurrency(invested)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Current Value</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 num">
              {currentValue != null ? formatCurrency(currentValue) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Gain / Loss</p>
            <p className={`text-sm font-semibold num ${gainAmt != null ? gainClass(gainAmt) : 'text-gray-400 dark:text-gray-500'}`}>
              {gainAmt != null ? `${gainAmt >= 0 ? '+' : ''}${formatCurrency(Math.abs(gainAmt))}` : '—'}
            </p>
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
}

const StockTracker = ({ currentMonth: _currentMonth, currentYear: _currentYear, onPortfolioUpdate }: StockTrackerProps) => {
  const [holdings, setHoldings] = useState<StockHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingHolding, setEditingHolding] = useState<StockHolding | null>(null);
  const [showChart, setShowChart] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<{
    updatedCount?: number; total?: number;
    errors?: { ticker: string }[]; error?: string;
  } | null>(null);

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

  useEffect(() => {
    loadHoldings();
  }, [loadHoldings]);

  useEffect(() => {
    if (loading || holdings.length === 0) return;
    const today = new Date().toISOString().split('T')[0];
    const hasStale = holdings.some(h => h.last_updated !== today);
    if (hasStale) handleRefreshPrices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this stock holding?')) return;
    try {
      await fetch(`/api/stocks/${id}?month=${currentMonth}&year=${currentYear}`, { method: 'DELETE' });
      loadHoldings();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleRefreshPrices = async () => {
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
      loadHoldings();
    } catch (err) {
      setRefreshStatus({ error: String(err) });
    } finally {
      setRefreshing(false);
    }
  };

  const totalInvested = holdings.reduce((sum, h) => sum + h.shares * h.buy_price, 0);
  const priced = holdings.filter(h => h.current_price != null);
  const totalCurrentValue = priced.reduce((sum, h) => sum + h.shares * h.current_price!, 0);
  const totalInvestedPriced = priced.reduce((sum, h) => sum + h.shares * h.buy_price, 0);
  const totalGain = totalCurrentValue - totalInvestedPriced;
  const totalGainPct = totalInvestedPriced > 0 ? (totalGain / totalInvestedPriced) * 100 : 0;
  const unpricedCount = holdings.length - priced.length;

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Stock Holdings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
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
            disabled={refreshing || holdings.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-xl hover:border-primary-300 disabled:opacity-50 transition-colors cursor-pointer"
            title="Fetch live NSE prices"
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

      {/* Summary Cards */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-gray-100 dark:border-surface-800 shadow-sm p-5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Invested</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1 num">{formatCurrency(totalInvested)}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{holdings.length} holdings</p>
          </div>
          <div className="bg-white dark:bg-surface-900 rounded-2xl border border-gray-100 dark:border-surface-800 shadow-sm p-5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Current Value</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1 num">
              {priced.length > 0 ? formatCurrency(totalCurrentValue) : '—'}
            </p>
            {unpricedCount > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {unpricedCount} stock{unpricedCount !== 1 ? 's' : ''} missing price
              </p>
            )}
          </div>
          <div className={`rounded-2xl border shadow-sm p-5 ${
            priced.length > 0
              ? totalGain >= 0
                ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30'
                : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30'
              : 'bg-white dark:bg-surface-900 border-gray-100 dark:border-surface-800'
          }`}>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Gain / Loss</p>
            <p className={`text-2xl font-bold mt-1 num ${priced.length > 0 ? gainClass(totalGain) : 'text-gray-400'}`}>
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
        </div>
      )}

      {/* Bar Chart */}
      {showChart && holdings.length > 0 && (
        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-gray-100 dark:border-surface-800 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Portfolio Value by Stock</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="30%">
              <XAxis dataKey="ticker" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="invested" name="Invested" radius={[4, 4, 0, 0]}>
                {chartData.map((_, i) => <Cell key={i} fill="#c7d2fe" />)}
              </Bar>
              <Bar dataKey="currentValue" name="Current" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.gain >= 0 ? '#86efac' : '#fca5a5'} />
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
              onPriceUpdate={() => { loadHoldings(); onPortfolioUpdate?.(); }}
              currentMonth={currentMonth}
              currentYear={currentYear}
            />
          ))}
        </div>
      )}

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
    </div>
  );
};

export default StockTracker;
