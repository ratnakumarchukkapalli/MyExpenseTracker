'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';
import {
  XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import {
  TrendingUp, RefreshCw, Plus, Trash2, X,
  Upload, ChevronDown, ChevronUp, Target, AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

// ── Types ─────────────────────────────────────────────────────────────────

interface SipFund {
  id: number;
  fund_name: string;
  scheme_code?: string | null;
  folio_number?: string | null;
  fund_type: string;
  sip_amount: number;
  units: number;
  invested_value: number;
  current_nav?: number | null;
  last_nav_update?: string | null;
}

interface SipTransaction {
  id: number;
  fund_id: number;
  transaction_date: string;
  units: number;
  purchase_nav: number;
  amount: number;
  transaction_type: string;
}

interface HoldingsImportFund {
  fundName: string;
  amc: string;
  category: string;
  folio: string;
  units: number;
  investedValue: number;
  currentValue: number;
  schemeCode: string | null;
  schemeCodeDisplay?: string;
  searchResults?: SchemeResult[];
  searching?: boolean;
}

interface SchemeResult {
  schemeCode: number;
  schemeName: string;
}

// ── HELPERS ───────────────────────────────────────────────────────────────

const convertNavDate = (d: string) => {
  const parts = d.split('-');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return d;
};

const fetchAmfiNavMap = async (schemeCodes: string[]) => {
  try {
    const res = await fetch('/api/sip/amfi-nav', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemeCodes }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('AMFI fetch error:', err);
    return {};
  }
};

const gainClass = (val: number) =>
  val >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

// ── FUND CARD ─────────────────────────────────────────────────────────────

interface FundCardProps {
  fund: SipFund;
  onDelete: (id: number) => void;
  onRefreshNav: () => void;
}

const FundCard = ({ fund, onDelete, onRefreshNav }: FundCardProps) => {
  const { chartColors } = useDarkMode();
  const [expanded, setExpanded] = useState(false);
  const [transactions, setTransactions] = useState<SipTransaction[]>([]);
  const [loadingTxn, setLoadingTxn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const currentNav = fund.current_nav ?? 0;
  const currentValue = fund.units * currentNav;
  const invested = fund.invested_value ?? 0;
  const gainAmt = currentValue - invested;
  const gainPct = invested > 0 ? (gainAmt / invested) * 100 : 0;
  const breakevenNav = fund.units > 0 ? invested / fund.units : 0;
  const navGapPct = currentNav > 0 ? ((breakevenNav - currentNav) / currentNav) * 100 : 0;

  const loadTransactions = async () => {
    if (loadingTxn || transactions.length > 0) return;
    setLoadingTxn(true);
    const res = await fetch(`/api/sip/transactions?fundId=${fund.id}`);
    const data = await res.json();
    setTransactions(Array.isArray(data) ? data : []);
    setLoadingTxn(false);
  };

  const handleExpand = () => {
    setExpanded(e => !e);
    if (!expanded) loadTransactions();
  };

  const handleRefresh = async () => {
    if (!fund.scheme_code || refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch('/api/sip/amfi-nav', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemeCodes: [fund.scheme_code] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const navMap = await res.json();
      const entry = navMap[fund.scheme_code];
      if (entry) {
        const updateRes = await fetch(`/api/sip/funds/${fund.id}/nav`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentNav: entry.nav, lastNavUpdate: entry.date }),
        });
        if (!updateRes.ok) throw new Error('Failed to update NAV');

        await fetch('/api/sip/nav-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schemeCode: fund.scheme_code,
            navData: [{ date: entry.date, nav: String(entry.nav) }],
          }),
        });
        onRefreshNav();
      } else {
        throw new Error('No NAV data found for this scheme code');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      console.error('NAV refresh failed:', msg);
      alert(`NAV refresh failed: ${msg}`);
    }
    setRefreshing(false);
  };

  return (
    <div className="bg-white dark:bg-surface-900 rounded-2xl border border-gray-100 dark:border-surface-800 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                {fund.fund_name}
              </h3>
              {fund.fund_type === 'active' && (
                <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                  Active SIP
                </span>
              )}
              {fund.fund_type === 'historical' && (
                <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-surface-700 dark:text-gray-400">
                  Historical
                </span>
              )}
            </div>
            {fund.folio_number && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Folio: {fund.folio_number} {fund.scheme_code ? `· Code: ${fund.scheme_code}` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {fund.scheme_code && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                title="Refresh NAV from AMFI"
                className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={() => onDelete(fund.id)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Invested</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 num">
              {formatCurrency(invested)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Current Value</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 num">
              {currentNav > 0 ? formatCurrency(currentValue) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Gain / Loss</p>
            <p className={`text-sm font-semibold num ${gainClass(gainAmt)}`}>
              {currentNav > 0
                ? `${gainAmt >= 0 ? '+' : ''}${formatCurrency(Math.abs(gainAmt))} (${gainPct.toFixed(2)}%)`
                : '—'}
            </p>
          </div>
        </div>

        {currentNav > 0 && breakevenNav > 0 && (
          <div className={`mt-3 px-3 py-2 rounded-xl text-xs flex items-center gap-2 ${
            gainAmt >= 0
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
          }`}>
            {gainAmt >= 0
              ? <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
              : <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            }
            {gainAmt >= 0
              ? `In profit · Breakeven was ₹${breakevenNav.toFixed(2)}, Current NAV ₹${currentNav.toFixed(2)}`
              : `NAV needs to rise ${navGapPct.toFixed(1)}% to break even (from ₹${currentNav.toFixed(2)} → ₹${breakevenNav.toFixed(2)})`
            }
          </div>
        )}

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
            {fund.current_nav && (
              <span>NAV: ₹{fund.current_nav.toFixed(4)} · Updated: {fund.last_nav_update || 'never'}</span>
            )}
            {fund.sip_amount > 0 && (
              <span className="text-primary-600 dark:text-primary-400 font-medium">
                SIP: {formatCurrency(fund.sip_amount)}/mo
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExpand}
              className="text-xs flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-primary-600"
            >
              Installments {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-surface-800 overflow-x-auto">
          {loadingTxn ? (
            <p className="text-xs text-gray-400 p-4">Loading…</p>
          ) : transactions.length === 0 ? (
            <p className="text-xs text-gray-400 p-4">
              No installment transactions yet. Use &quot;Log Monthly SIP&quot; to add each month&apos;s investment.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-gray-50/80 dark:bg-surface-800">
                <tr>
                  {['Date', 'Amount', 'Units', 'Buy NAV', 'Curr NAV', 'Value', 'Gain', 'Type'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-gray-500 dark:text-gray-400 font-semibold uppercase text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => {
                  const val = t.units * currentNav;
                  const g = val - t.amount;
                  const gPct = t.amount > 0 ? (g / t.amount) * 100 : 0;
                  return (
                    <tr key={t.id} className="border-t border-gray-50 dark:border-surface-800 hover:bg-gray-50/50 dark:hover:bg-surface-800/50">
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{t.transaction_date}</td>
                      <td className="px-3 py-2 num text-gray-700 dark:text-gray-300">{formatCurrency(t.amount)}</td>
                      <td className="px-3 py-2 num text-gray-600 dark:text-gray-400">{t.units.toFixed(4)}</td>
                      <td className="px-3 py-2 num text-gray-600 dark:text-gray-400">₹{t.purchase_nav.toFixed(4)}</td>
                      <td className="px-3 py-2 num text-gray-600 dark:text-gray-400">
                        {currentNav > 0 ? `₹${currentNav.toFixed(4)}` : '—'}
                      </td>
                      <td className="px-3 py-2 num text-gray-700 dark:text-gray-300">
                        {currentNav > 0 ? formatCurrency(parseFloat(val.toFixed(2))) : '—'}
                      </td>
                      <td className={`px-3 py-2 num font-medium ${gainClass(g)}`}>
                        {currentNav > 0 ? `${gPct >= 0 ? '+' : ''}${gPct.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-500">{t.transaction_type}</td>
                    </tr>
                  );
                })}
                {currentNav > 0 && (
                  <tr className="border-t-2 border-gray-200 dark:border-surface-700 bg-gray-50 dark:bg-surface-800 font-semibold">
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">Total</td>
                    <td className="px-3 py-2 num text-gray-800 dark:text-gray-200">{formatCurrency(transactions.reduce((s, t) => s + t.amount, 0))}</td>
                    <td className="px-3 py-2 num text-gray-800 dark:text-gray-200">{transactions.reduce((s, t) => s + t.units, 0).toFixed(4)}</td>
                    <td colSpan={2} />
                    <td className="px-3 py-2 num text-gray-800 dark:text-gray-200">{formatCurrency(parseFloat(currentValue.toFixed(2)))}</td>
                    <td className={`px-3 py-2 num ${gainClass(gainAmt)}`}>{gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%</td>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

// ── HOLDINGS IMPORT MODAL ────────────────────────────────────────────────

interface HoldingsImportModalProps {
  funds: HoldingsImportFund[];
  onConfirm: (mapped: HoldingsImportFund[]) => void;
  onCancel: () => void;
}

const HoldingsImportModal = ({ funds, onConfirm, onCancel }: HoldingsImportModalProps) => {
  const [mapped, setMapped] = useState<HoldingsImportFund[]>(
    funds.map(f => ({ ...f, schemeCode: null, searchResults: [], searching: false }))
  );

  const searchFund = async (idx: number, q: string) => {
    if (!q || q.length < 3) return;
    setMapped(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], searching: true };
      return next;
    });
    try {
      const path = `mf/search?q=${encodeURIComponent(q)}`;
      const res = await fetch(`/api/sip/mfapi?path=${encodeURIComponent(path)}`);
      const data: SchemeResult[] = await res.json();
      setMapped(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], searchResults: (data || []).slice(0, 6), searching: false };
        return next;
      });
    } catch {
      setMapped(prev => { const n = [...prev]; n[idx] = { ...n[idx], searching: false }; return n; });
    }
  };

  const pickScheme = (idx: number, scheme: SchemeResult) => {
    setMapped(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], schemeCode: String(scheme.schemeCode), schemeCodeDisplay: scheme.schemeName, searchResults: [] };
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-surface-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Import Holdings</h2>
            <p className="text-xs text-gray-500 mt-0.5">Match each fund to its scheme code for live NAV</p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {mapped.map((f, idx) => (
            <div key={idx} className="bg-gray-50 dark:bg-surface-800 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{f.fundName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Folio: {f.folio} · Units: {f.units.toFixed(4)} · Invested: {formatCurrency(f.investedValue)}
                  </p>
                </div>
              </div>
              {f.schemeCode ? (
                <div className="mt-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-xs text-green-700 dark:text-green-400">{f.schemeCodeDisplay} (Code: {f.schemeCode})</span>
                  <button onClick={() => setMapped(prev => { const n = [...prev]; n[idx] = { ...n[idx], schemeCode: null, searchResults: [] }; return n; })}
                    className="text-xs text-gray-400 hover:text-red-500 ml-auto">change</button>
                </div>
              ) : (
                <div className="mt-2 relative">
                  <input
                    type="text"
                    placeholder="Search fund on mfapi.in…"
                    defaultValue={f.fundName.split(' ').slice(0, 4).join(' ')}
                    onKeyDown={e => { if (e.key === 'Enter') searchFund(idx, (e.target as HTMLInputElement).value); }}
                    onBlur={e => searchFund(idx, e.target.value)}
                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                  {f.searching && <p className="text-xs text-gray-400 mt-1">Searching…</p>}
                  {f.searchResults && f.searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                      {f.searchResults.map(s => (
                        <button key={s.schemeCode} onClick={() => pickScheme(idx, s)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-surface-700 text-gray-700 dark:text-gray-300">
                          <span className="font-medium">{s.schemeName}</span>
                          <span className="text-gray-400 ml-1">(#{s.schemeCode})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 dark:border-surface-800 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">Cancel</button>
          <button
            onClick={() => onConfirm(mapped)}
            className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl"
          >
            Import {mapped.length} Funds
          </button>
        </div>
      </div>
    </div>
  );
};

// ── LOG SIP MODAL ─────────────────────────────────────────────────────────

interface LogSIPModalProps {
  funds: SipFund[];
  onLog: (txn: { fundId: number; date: string; amount: number; nav: number; units: number; type: string }) => void;
  onCancel: () => void;
}

const LogSIPModal = ({ funds, onLog, onCancel }: LogSIPModalProps) => {
  const activeFunds = funds.filter(f => f.fund_type === 'active' && f.scheme_code);
  const [selectedFundId, setSelectedFundId] = useState(String(activeFunds[0]?.id || ''));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [nav, setNav] = useState('');
  const [units, setUnits] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedFund = activeFunds.find(f => f.id === parseInt(selectedFundId, 10));

  useEffect(() => {
    if (selectedFund) setAmount(String(selectedFund.sip_amount || ''));
  }, [selectedFundId, selectedFund]);

  const fetchNavForDate = async () => {
    if (!selectedFund?.scheme_code || !date) return;
    setLoading(true);
    try {
      const path = `mf/${selectedFund.scheme_code}`;
      const res = await fetch(`/api/sip/mfapi?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (!data?.data?.length) { setLoading(false); return; }

      const navByDate: Record<string, number> = {};
      data.data.forEach((d: { date: string; nav: string }) => {
        navByDate[convertNavDate(d.date)] = parseFloat(d.nav);
      });

      let found: { date: string; nav: number } | null = null;
      for (let offset = 0; offset <= 5; offset++) {
        const d = new Date(date);
        d.setDate(d.getDate() - offset);
        const key = d.toISOString().split('T')[0];
        if (navByDate[key]) { found = { date: key, nav: navByDate[key] }; break; }
      }

      if (found) {
        setNav(String(found.nav.toFixed(4)));
        if (amount) setUnits((parseFloat(amount) / found.nav).toFixed(4));
        const navData = data.data.slice(0, 365)
          .map((d: { date: string; nav: string }) => ({ date: convertNavDate(d.date), nav: d.nav }))
          .filter((d: { date: string; nav: string }) => d.date && !isNaN(parseFloat(d.nav)));
        try {
          await fetch('/api/sip/nav-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schemeCode: selectedFund.scheme_code, navData }),
          });
        } catch {
          // silently fail — NAV history is optional
        }
      } else {
        alert('No NAV data found for this date range. Market may have been closed.');
      }
    } catch (e) { console.error('Fetch NAV error:', e); }
    setLoading(false);
  };

  useEffect(() => {
    if (nav && amount) setUnits((parseFloat(amount) / parseFloat(nav)).toFixed(4));
  }, [nav, amount]);

  const handleSubmit = () => {
    if (!selectedFundId || !date || !amount || !nav) return;
    onLog({
      fundId: parseInt(selectedFundId, 10),
      date,
      amount: parseFloat(amount),
      nav: parseFloat(nav),
      units: parseFloat(units),
      type: 'SIP',
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-md transition-opacity cursor-pointer"
        onClick={onCancel}
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
              <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.12em] mb-1">SIP Tracker</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight serif">Log Monthly SIP</h2>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-surface-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-surface-700 hover:text-gray-900 dark:hover:text-gray-100 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {/* Fund Selection */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Fund Selection</label>
            <select
              value={selectedFundId}
              onChange={e => setSelectedFundId(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-2xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all text-sm cursor-pointer"
            >
              {activeFunds.map(f => (
                <option key={f.id} value={f.id}>{f.fund_name}</option>
              ))}
            </select>
            {selectedFund && (
              <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-400 font-medium px-1 flex justify-between">
                <span>SIP: <span className="text-primary-600 dark:text-primary-400 font-bold">₹{(selectedFund.sip_amount || 0).toLocaleString()}</span></span>
                {selectedFund.folio_number && <span className="opacity-60">Folio {selectedFund.folio_number}</span>}
              </div>
            )}
          </div>

          {/* SIP Date + Fetch NAV */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">SIP Date</label>
            <div className="flex gap-3">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="flex-1 px-4 py-3 bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-2xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all text-sm cursor-pointer"
              />
              <button
                onClick={fetchNavForDate}
                disabled={loading || !selectedFund?.scheme_code}
                className="px-5 py-3 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-2xl font-bold text-xs flex items-center gap-2 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Fetching...' : 'Fetch NAV'}
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Amount (₹)</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</div>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-surface-700 rounded-2xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all text-sm font-bold tabular-nums"
              />
            </div>
          </div>

          {/* NAV + Units */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">NAV (₹)</label>
              <input
                type="number"
                value={nav}
                step="0.0001"
                onChange={e => setNav(e.target.value)}
                placeholder="Auto-fetched"
                className={`w-full px-4 py-3 bg-gray-50 dark:bg-surface-800 border ${nav ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-gray-200 dark:border-surface-700'} rounded-2xl text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-4 focus:ring-primary-500/5 focus:border-primary-500 transition-all text-sm tabular-nums`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Units Allotted</label>
              <input
                type="number"
                value={units}
                step="0.0001"
                readOnly
                placeholder="Calculated"
                className="w-full px-4 py-3 bg-gray-100 dark:bg-surface-900/50 border border-gray-200 dark:border-surface-700 rounded-2xl text-gray-400 dark:text-gray-500 text-sm cursor-not-allowed tabular-nums"
              />
            </div>
          </div>

          {nav && amount && units && (
            <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/50 rounded-[20px] p-5 flex items-center justify-between animate-in zoom-in-95 duration-300">
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-primary-900/40 dark:text-primary-400/40 uppercase tracking-wider">Calculation</div>
                <div className="text-sm font-bold text-primary-900 dark:text-primary-100 tabular-nums">
                  ₹{parseFloat(amount).toLocaleString()} <span className="mx-1 opacity-20">/</span> ₹{parseFloat(nav).toFixed(4)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold text-primary-900/40 dark:text-primary-400/40 uppercase tracking-wider">Total Units</div>
                <div className="text-lg font-bold text-primary-600 dark:text-primary-400 tabular-nums leading-none mt-0.5">{parseFloat(units).toFixed(4)}</div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-4 rounded-2xl border border-gray-200 dark:border-surface-700 text-gray-600 dark:text-gray-400 font-bold text-sm hover:bg-gray-50 dark:hover:bg-surface-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedFundId || !date || !amount || !nav}
              className="flex-1 py-4 rounded-2xl bg-primary-600 text-white font-bold text-sm shadow-xl shadow-primary-600/20 hover:bg-primary-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
            >
              Log SIP Transaction
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── GOAL TRACKER ─────────────────────────────────────────────────────────

interface GoalTrackerProps {
  totalCurrent: number;
  totalInvested: number;
  monthlyRSIP: number;
}

const GoalTracker = ({ totalCurrent, monthlyRSIP }: GoalTrackerProps) => {
  const { chartColors } = useDarkMode();
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const targetAmt = parseFloat(target) * 100000 || 0;
  const progress = targetAmt > 0 ? Math.min((totalCurrent / targetAmt) * 100, 100) : 0;

  const avgMonthlyReturn = 0.008;
  const projectionData: { month: string; value: number }[] = [];
  let portfolioVal = totalCurrent;
  for (let m = 1; m <= 24; m++) {
    portfolioVal = portfolioVal * (1 + avgMonthlyReturn) + monthlyRSIP;
    const d = new Date();
    d.setMonth(d.getMonth() + m);
    projectionData.push({
      month: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      value: Math.round(portfolioVal / 100000 * 10) / 10,
    });
  }

  const monthsToTarget = targetAmt > totalCurrent
    ? projectionData.findIndex(d => d.value * 100000 >= targetAmt) + 1
    : 0;

  return (
    <div className="bg-white dark:bg-surface-900 rounded-2xl border border-gray-100 dark:border-surface-800 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-4 w-4 text-primary-600" />
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Goal Tracker</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">Target Corpus (₹ Lakhs)</label>
          <input type="number" value={target} onChange={e => setTarget(e.target.value)}
            placeholder="e.g. 25 for ₹25L"
            className="mt-1 w-full text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">Target Date (optional)</label>
          <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)}
            className="mt-1 w-full text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
      </div>

      {targetAmt > 0 && (
        <>
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{formatCurrency(parseFloat(totalCurrent.toFixed(2)))} current</span>
              <span>{formatCurrency(targetAmt)} target</span>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-surface-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1 text-right">{progress.toFixed(1)}% achieved</p>
          </div>
          {monthsToTarget > 0 && monthsToTarget <= 24 && (
            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl px-3 py-2 text-xs text-primary-700 dark:text-primary-400 mb-4">
              At 10% annual return + {formatCurrency(monthlyRSIP)}/month SIP →
              <span className="font-bold"> reach target in ~{monthsToTarget} months</span>
            </div>
          )}
        </>
      )}

      <div>
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
          24-Month Portfolio Projection (₹L) · Assumes 10% annual return
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={projectionData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: chartColors.axisText }} interval={3} />
            <YAxis tick={{ fontSize: 9, fill: chartColors.axisText }} tickFormatter={(v: number) => `₹${v}L`} width={42} />
            <Tooltip formatter={(v: unknown) => `₹${v}L`} contentStyle={{ fontSize: 11, background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}` }} />
            <Bar dataKey="value" fill={chartColors.accent} radius={[3, 3, 0, 0]} name="Portfolio" />
            {targetAmt > 0 && (
              <ReferenceLine y={targetAmt / 100000} stroke={chartColors.emerald} strokeDasharray="4 3"
                label={{ value: `Target ₹${target}L`, fontSize: 9, fill: chartColors.emerald, position: 'insideTopRight' }} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────

// ── AddFundModal ───────────────────────────────────────────────────────────

const EMPTY_FUND_FORM = {
  fund_name: '', fund_type: 'active', scheme_code: '',
  folio_number: '', units: '', invested_value: '', current_nav: '', sip_amount: '',
};

function AddFundModal({ onSubmit, onCancel }: { onSubmit: (data: object) => Promise<void>; onCancel: () => void }) {
  const [form, setForm] = useState(EMPTY_FUND_FORM);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fund_name.trim()) { alert('Fund name is required'); return; }
    setSaving(true);
    await onSubmit({
      fund_name: form.fund_name.trim(),
      fund_type: form.fund_type,
      scheme_code: form.scheme_code.trim() || null,
      folio_number: form.folio_number.trim() || null,
      units: parseFloat(form.units) || 0,
      invested_value: parseFloat(form.invested_value) || 0,
      current_nav: form.current_nav ? parseFloat(form.current_nav) : null,
      sip_amount: form.sip_amount ? parseFloat(form.sip_amount) : null,
    });
    setSaving(false);
  };

  const inp = 'w-full px-3 py-2.5 bg-gray-50 dark:bg-surface-800 border border-gray-200 dark:border-surface-600 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all';
  const lbl = 'block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-md" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-surface-900 rounded-[24px] shadow-xl border border-gray-100 dark:border-surface-700 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-surface-700">
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.12em] mb-1">SIP Tracker</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Add SIP Fund</h2>
          </div>
          <button onClick={onCancel} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 dark:bg-surface-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-surface-600 transition-all">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className={lbl}>Fund Name *</label>
            <input className={inp} value={form.fund_name} onChange={e => set('fund_name', e.target.value)} placeholder="e.g. Parag Parikh Flexi Cap Fund" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Status</label>
              <select className={inp + ' cursor-pointer'} value={form.fund_type} onChange={e => set('fund_type', e.target.value)}>
                <option value="active">Active SIP</option>
                <option value="historical">Historical</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Monthly SIP (₹)</label>
              <input className={inp} type="number" min="0" step="0.01" value={form.sip_amount} onChange={e => set('sip_amount', e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Units Held</label>
              <input className={inp} type="number" min="0" step="0.0001" value={form.units} onChange={e => set('units', e.target.value)} placeholder="0.0000" />
            </div>
            <div>
              <label className={lbl}>Invested Value (₹)</label>
              <input className={inp} type="number" min="0" step="0.01" value={form.invested_value} onChange={e => set('invested_value', e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Current NAV (₹)</label>
              <input className={inp} type="number" min="0" step="0.0001" value={form.current_nav} onChange={e => set('current_nav', e.target.value)} placeholder="optional" />
            </div>
            <div>
              <label className={lbl}>AMFI Scheme Code</label>
              <input className={inp} value={form.scheme_code} onChange={e => set('scheme_code', e.target.value)} placeholder="e.g. 122639 (for NAV sync)" />
            </div>
          </div>

          <div>
            <label className={lbl}>Folio Number</label>
            <input className={inp} value={form.folio_number} onChange={e => set('folio_number', e.target.value)} placeholder="optional" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-3 rounded-2xl border border-gray-200 dark:border-surface-600 text-gray-600 dark:text-gray-400 font-bold text-sm hover:bg-gray-50 dark:hover:bg-surface-800 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60">
              <Plus size={16} />
              {saving ? 'Adding…' : 'Add Fund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface SIPTrackerProps {
  currentMonth?: number;
  currentYear?: number;
  onPortfolioUpdate?: () => void;
}

const SIPTracker = ({ currentMonth: _currentMonth, currentYear: _currentYear, onPortfolioUpdate }: SIPTrackerProps) => {
  const [funds, setFunds] = useState<SipFund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'historical' | 'goals'>('active');
  const [showHoldingsModal, setShowHoldingsModal] = useState(false);
  const [holdingsPreview, setHoldingsPreview] = useState<HoldingsImportFund[] | null>(null);
  const [showLogSIP, setShowLogSIP] = useState(false);
  const [showAddFund, setShowAddFund] = useState(false);
  const [importing, setImporting] = useState(false);
  const [autoRefreshing, setAutoRefreshing] = useState(false);

  const holdingsFileRef = useRef<HTMLInputElement>(null);
  const capitalGainsFileRef = useRef<HTMLInputElement>(null);

  const loadFunds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sip/funds');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const result = Array.isArray(data) ? data : [];
      setFunds(result);
      return result as SipFund[];
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load funds';
      setError(msg);
      setFunds([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const autoRefreshAllNavs = useCallback(async (fundsToRefresh: SipFund[]) => {
    const codes = fundsToRefresh
      .map(f => f.scheme_code)
      .filter(Boolean) as string[];
    
    if (codes.length === 0) return;
    
    setAutoRefreshing(true);
    try {
      const navMap = await fetchAmfiNavMap(codes);
      const updates = [];
      
      for (const fund of fundsToRefresh) {
        if (!fund.scheme_code) continue;
        const entry = navMap[fund.scheme_code];
        if (entry) {
          // Update fund NAV
          updates.push(fetch(`/api/sip/funds/${fund.id}/nav`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentNav: entry.nav, lastNavUpdate: entry.date }),
          }));
          
          // Update NAV history
          updates.push(fetch('/api/sip/nav-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              schemeCode: fund.scheme_code,
              navData: [{ date: entry.date, nav: String(entry.nav) }],
            }),
          }));
        }
      }
      
      if (updates.length > 0) {
        await Promise.all(updates);
        // Reload funds to reflect new NAVs
        const res = await fetch('/api/sip/funds');
        if (res.ok) {
          const data = await res.json();
          setFunds(Array.isArray(data) ? data : []);
        }
        if (onPortfolioUpdate) onPortfolioUpdate();
      }
      
      localStorage.setItem('lastSipRefreshDate', new Date().toDateString());
    } catch (e) {
      console.error('Auto-refresh failed:', e);
    } finally {
      setAutoRefreshing(false);
    }
  }, [onPortfolioUpdate]);

  useEffect(() => {
    loadFunds().then(loadedFunds => {
      if (loadedFunds && loadedFunds.length > 0) {
        const lastRefresh = localStorage.getItem('lastSipRefreshDate');
        const today = new Date().toDateString();
        if (lastRefresh !== today) {
          void autoRefreshAllNavs(loadedFunds);
        }
      }
    });
  }, [loadFunds, autoRefreshAllNavs]);

  const handleImportHoldings = () => holdingsFileRef.current?.click();

  const handleHoldingsFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/sip/import/holdings', { method: 'POST', body: formData });
      const result = await res.json();
      if (result.error) { alert(result.error); return; }
      setHoldingsPreview(result.funds);
      setShowHoldingsModal(true);
    } catch (e) {
      alert('Failed to parse file: ' + String(e));
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleImportCapitalGains = () => capitalGainsFileRef.current?.click();

  const handleCapitalGainsFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/sip/import/capital-gains', { method: 'POST', body: formData });
      const result = await res.json();
      if (result.error) { alert(result.error); return; }
      const confirmRes = await fetch('/api/sip/import/confirm-capital-gains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: result.transactions }),
      });
      const confirmed = await confirmRes.json();
      await loadFunds();
      alert(`Imported ${confirmed.saved ?? result.transactions.length} historical transactions.`);
    } catch (e) {
      alert('Failed to import capital gains: ' + String(e));
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleConfirmHoldings = async (mapped: HoldingsImportFund[]) => {
    await fetch('/api/sip/import/confirm-holdings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funds: mapped }),
    });
    setShowHoldingsModal(false);
    setHoldingsPreview(null);
    await loadFunds();
  };

  const handleLogSIP = async (txn: { fundId: number; date: string; amount: number; nav: number; units: number; type: string }) => {
    await fetch('/api/sip/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(txn),
    });
    setShowLogSIP(false);
    await loadFunds();
  };

  const handleDelete = async (fundId: number) => {
    if (!window.confirm('Delete this fund and all its data?')) return;
    await fetch(`/api/sip/funds/${fundId}`, { method: 'DELETE' });
    await loadFunds();
  };

  const handleAddFund = async (data: object) => {
    const res = await fetch('/api/sip/funds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert('Failed to add fund: ' + (err.error ?? res.statusText));
      return;
    }
    setShowAddFund(false);
    await loadFunds();
    onPortfolioUpdate?.();
  };

  const activeFunds = funds.filter(f => f.fund_type === 'active');
  const histFunds = funds.filter(f => f.fund_type === 'historical');
  const totalInvested = funds.reduce((s, f) => s + (f.invested_value ?? 0), 0);
  const totalCurrent = funds.reduce((s, f) => s + (f.units * (f.current_nav ?? 0)), 0);
  const totalGain = totalCurrent - totalInvested;
  const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const monthlySIP = activeFunds.reduce((s, f) => s + (f.sip_amount ?? 0), 0);

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-2xl p-5 shadow-sm">
              <div className="h-3 w-20 bg-gray-100 dark:bg-surface-800 rounded mb-2" />
              <div className="h-6 w-28 bg-gray-200 dark:bg-surface-800 rounded" />
            </div>
          ))}
        </div>

        {/* Funds List Skeleton */}
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between mb-4">
                <div className="space-y-2">
                  <div className="h-5 w-48 bg-gray-200 dark:bg-surface-800 rounded" />
                  <div className="h-3 w-32 bg-gray-100 dark:bg-surface-800 rounded" />
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
                    <div className="h-4 w-20 bg-gray-200 dark:bg-surface-800 rounded" />
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
          <p className="text-red-600 text-sm font-medium">Failed to load SIP Tracker</p>
          <p className="text-gray-400 text-xs mt-1">{error}</p>
          <button
            onClick={() => loadFunds()}
            className="mt-4 px-4 py-2 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hidden file inputs */}
      <input ref={holdingsFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleHoldingsFileChange} />
      <input ref={capitalGainsFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleCapitalGainsFileChange} />

      {autoRefreshing && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary-50 dark:bg-primary-950/30 border border-primary-100 dark:border-primary-900/30 rounded-xl text-primary-700 dark:text-primary-400 animate-pulse">
          <RefreshCw size={14} className="animate-spin" />
          <span className="text-xs font-medium">Auto-refreshing live NAV prices…</span>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowAddFund(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Fund
        </button>
        <button
          onClick={handleImportHoldings}
          disabled={importing}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-surface-900 border border-gray-200 dark:border-surface-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-surface-800 transition-all cursor-pointer"
        >
          <Upload className="h-4 w-4 text-primary-600" />
          Import Holdings
        </button>
        <button
          onClick={handleImportCapitalGains}
          disabled={importing}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-surface-900 border border-gray-200 dark:border-surface-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-surface-800 transition-all cursor-pointer"
        >
          <Upload className="h-4 w-4 text-amber-600" />
          Import Capital Gains
        </button>
        {activeFunds.length > 0 && (
          <button
            onClick={() => setShowLogSIP(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-surface-900 border border-gray-200 dark:border-surface-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-surface-800 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Log Monthly SIP
          </button>
        )}
        {importing && <span className="text-xs text-gray-400">Importing…</span>}
      </div>

      {/* Empty state */}
      {funds.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-surface-900 rounded-2xl border border-gray-100 dark:border-surface-800">
          <TrendingUp className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">No funds yet</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
            Click &quot;Import Holdings&quot; and select your Groww Holdings Excel to get started
          </p>
        </div>
      )}

      {/* Portfolio Summary */}
      {funds.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total Invested', value: formatCurrency(totalInvested), sub: `${funds.length} holdings`, color: 'blue' },
            { label: 'Current Value', value: totalCurrent > 0 ? formatCurrency(parseFloat(totalCurrent.toFixed(2))) : '—', sub: 'All holdings', color: 'indigo' },
            { label: 'P & L', value: totalCurrent > 0 ? `${totalGain >= 0 ? '+' : ''}${formatCurrency(parseFloat(Math.abs(totalGain).toFixed(2)))}` : '—',
              sub: totalGainPct !== 0 ? `${totalGainPct.toFixed(1)}%` : '', color: totalGain >= 0 ? 'green' : 'red' },
            { label: 'Monthly SIP', value: formatCurrency(monthlySIP), sub: `${activeFunds.length} active funds`, color: 'purple' },
            { label: 'Funds', value: String(activeFunds.length), sub: `+ ${histFunds.length} historical`, color: 'orange' },
          ].map(({ label, value, sub, color }) => (
            <div key={label}
              className="rounded-2xl border p-4"
              style={{ background: 'var(--pane)', borderColor: 'var(--hairline)' }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: `var(--ink-muted)` }}>{label}</p>
              <p className="text-xl font-bold mt-1 num" style={{ color: 'var(--ink)' }}>{value}</p>
              {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>{sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      {funds.length > 0 && (
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'var(--hairline)' }}>
          {[
            { id: 'active' as const, label: `Active SIPs (${activeFunds.length})` },
            { id: 'historical' as const, label: `Historical (${histFunds.length})` },
            { id: 'goals' as const, label: 'Goal Tracker' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'shadow-sm'
                  : ''
              }`}
              style={{
                background: activeTab === tab.id ? 'var(--surface-solid)' : 'transparent',
                color: activeTab === tab.id ? 'var(--ink)' : 'var(--ink-muted)'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'active' && (
        <div className="space-y-4">
          {activeFunds.length === 0
            ? <p className="text-sm text-gray-400 dark:text-gray-500">No active SIP funds. Import your Holdings Excel to get started.</p>
            : activeFunds.map(f => <FundCard key={f.id} fund={f} onDelete={handleDelete} onRefreshNav={loadFunds} />)
          }
        </div>
      )}

      {activeTab === 'historical' && (
        <div className="space-y-4">
          {histFunds.length === 0
            ? <p className="text-sm text-gray-400 dark:text-gray-500">No historical data. Import a Capital Gains Excel to see past investments.</p>
            : histFunds.map(f => <FundCard key={f.id} fund={f} onDelete={handleDelete} onRefreshNav={loadFunds} />)
          }
        </div>
      )}

      {activeTab === 'goals' && (
        <GoalTracker
          totalCurrent={totalCurrent}
          totalInvested={totalInvested}
          monthlyRSIP={monthlySIP || 15100}
        />
      )}

      {showHoldingsModal && holdingsPreview && (
        <HoldingsImportModal
          funds={holdingsPreview}
          onConfirm={handleConfirmHoldings}
          onCancel={() => { setShowHoldingsModal(false); setHoldingsPreview(null); }}
        />
      )}
      {showLogSIP && (
        <LogSIPModal
          funds={funds}
          onLog={handleLogSIP}
          onCancel={() => setShowLogSIP(false)}
        />
      )}
      {showAddFund && (
        <AddFundModal
          onSubmit={handleAddFund}
          onCancel={() => setShowAddFund(false)}
        />
      )}
    </div>
  );
};

export default SIPTracker;
