'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import {
  TrendingUp, RefreshCw, Plus, Trash2, X,
  Upload, ChevronDown, ChevronUp, Target, AlertCircle,
  CheckCircle, BarChart2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

// ── ML via Python FastAPI ──────────────────────────────────────────────────
const mlAnalyze = async (endpoint: string, payload: unknown) => {
  try {
    const res = await fetch(`http://127.0.0.1:8765/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch {
    return { error: 'Python API unavailable' };
  }
};

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

interface NavHistoryPoint {
  nav_date: string;
  nav_value: number;
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

interface MlChartPoint {
  nav_date: string;
  nav_value: number;
  sma30?: number;
  sma90?: number;
}

// ── HELPERS ───────────────────────────────────────────────────────────────

const RISK_CLASSES: Record<string, string> = {
  Low:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  High:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const convertNavDate = (d: string) => {
  const parts = d.split('-');
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return d;
};

const AMFI_URL = 'https://portal.amfiindia.com/spages/NAVAll.txt';
const AMFI_MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

const convertAmfiDate = (d: string) => {
  const [day, mon, year] = d.trim().split('-');
  return `${year}-${AMFI_MONTHS[mon]}-${day.padStart(2, '0')}`;
};

const fetchAmfiNavMap = async (schemeCodes: string[]) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const res = await fetch(AMFI_URL, { signal: controller.signal });
  clearTimeout(timeout);
  const text = await res.text();
  const map: Record<string, { nav: number; date: string }> = {};
  for (const line of text.split('\n')) {
    const parts = line.split(';');
    if (parts.length < 6) continue;
    const code = parts[0].trim();
    if (!schemeCodes.includes(code)) continue;
    const nav = parseFloat(parts[4]);
    const date = convertAmfiDate(parts[5]);
    if (!isNaN(nav) && date) map[code] = { nav, date };
  }
  return map;
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
  const [expanded, setExpanded] = useState(false);
  const [mlOpen, setMlOpen] = useState(false);
  const [transactions, setTransactions] = useState<SipTransaction[]>([]);
  const [navHistory, setNavHistory] = useState<NavHistoryPoint[]>([]);
  const [loadingTxn, setLoadingTxn] = useState(false);
  const [loadingNav, setLoadingNav] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [chartData, setChartData] = useState<Record<string, unknown>[]>([]);
  const [regression, setRegression] = useState<{
    slope: number; intercept: number; dataPoints: number;
    predictedNav: number; trend: string; daysToBreakeven?: number | null; slopePerYear: number;
  } | null>(null);
  const [volatility, setVolatility] = useState<{ vol: number; risk: string } | null>(null);
  const [xirr, setXirr] = useState<number | null>(null);

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

  const loadNavHistory = async () => {
    if (!fund.scheme_code || navHistory.length > 0) return;
    setLoadingNav(true);
    const res = await fetch(`/api/sip/nav-history?schemeCode=${fund.scheme_code}`);
    const data = await res.json();
    setNavHistory(Array.isArray(data) ? data : []);
    setLoadingNav(false);
  };

  const handleExpand = () => {
    setExpanded(e => !e);
    if (!expanded) loadTransactions();
  };

  const handleMlOpen = () => {
    setMlOpen(m => !m);
    if (!mlOpen) loadNavHistory();
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
        setNavHistory([]);
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

  useEffect(() => {
    if (!navHistory.length) return;
    const nav_data = navHistory.map(h => ({ nav_date: h.nav_date, nav_value: h.nav_value }));
    Promise.all([
      mlAnalyze('sma', { nav_data }),
      mlAnalyze('regression', { nav_data, breakeven_nav: breakevenNav }),
      mlAnalyze('volatility', { nav_data }),
    ]).then(([smaRes, regRes, volRes]) => {
      const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      setChartData((smaRes.data || []).map((d: MlChartPoint) => {
        const [yr, mo] = (d.nav_date || '').split('-');
        const label = yr && mo ? `${MONTHS[parseInt(mo) - 1]} '${yr.slice(2)}` : d.nav_date;
        return { date: label, fullDate: d.nav_date, nav: d.nav_value, sma30: d.sma30 ?? null, sma90: d.sma90 ?? null };
      }));
      if (!regRes.error) setRegression({
        slope:           regRes.slope,
        intercept:       regRes.intercept,
        dataPoints:      regRes.data_points,
        predictedNav:    regRes.predicted_nav_180d,
        trend:           regRes.trend === 'Recovering' ? 'Recovering ↑' : regRes.trend === 'Declining' ? 'Declining ↓' : 'Sideways →',
        daysToBreakeven: regRes.days_to_breakeven,
        slopePerYear:    regRes.slope_per_year,
      });
      if (!volRes.error) setVolatility({ vol: volRes.volatility_pct, risk: volRes.risk });
    }).catch(console.error);
  }, [navHistory, breakevenNav]);

  useEffect(() => {
    if (!transactions.length) return;
    const cash_flows = [
      ...transactions.map(t => ({ date: t.transaction_date, amount: -t.amount })),
      { date: new Date().toISOString().split('T')[0], amount: currentValue },
    ];
    mlAnalyze('xirr', { cash_flows })
      .then(res => setXirr(res.xirr_pct ?? null))
      .catch(console.error);
  }, [transactions, currentValue]);

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
              {volatility && (
                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${RISK_CLASSES[volatility.risk]}`}>
                  {volatility.risk} Risk
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
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">XIRR</p>
            <p className={`text-sm font-semibold num ${xirr != null ? gainClass(xirr) : 'text-gray-400'}`}>
              {xirr != null ? `${xirr >= 0 ? '+' : ''}${xirr}%` : '—'}
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
            {regression?.daysToBreakeven != null && gainAmt < 0 && (
              <span className="ml-auto font-semibold">~{regression.daysToBreakeven}d at current trend</span>
            )}
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
              onClick={handleMlOpen}
              className="text-xs flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline"
            >
              <BarChart2 className="h-3 w-3" />
              ML Analysis {mlOpen ? '▲' : '▼'}
            </button>
            <button
              onClick={handleExpand}
              className="text-xs flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-primary-600"
            >
              Installments {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>

      {mlOpen && (
        <div className="border-t border-gray-100 dark:border-surface-800 p-5 bg-purple-50/40 dark:bg-purple-950/20">
          <h4 className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wide mb-3">
            ML Analysis
          </h4>
          {loadingNav && <p className="text-xs text-gray-400">Loading NAV history…</p>}
          {!fund.scheme_code && (
            <p className="text-xs text-amber-600">No scheme code — Refresh NAV to enable ML analysis.</p>
          )}
          {navHistory.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-surface-800 rounded-xl p-3">
                  <p className="text-xs text-gray-500">Trend (Regression)</p>
                  <p className={`text-sm font-bold mt-1 ${regression?.slope && regression.slope > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {regression?.trend || '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    slope: {regression ? (regression.slope * 252).toFixed(3) + '/yr' : '—'}
                  </p>
                </div>
                <div className="bg-white dark:bg-surface-800 rounded-xl p-3">
                  <p className="text-xs text-gray-500">6-Month NAV Forecast</p>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-1">
                    ₹{regression?.predictedNav?.toFixed(2) || '—'}
                  </p>
                  <p className={`text-xs mt-0.5 ${regression && regression.predictedNav > (fund.current_nav ?? 0) ? 'text-green-500' : 'text-red-500'}`}>
                    {regression && fund.current_nav
                      ? `${((regression.predictedNav - fund.current_nav) / fund.current_nav * 100).toFixed(1)}% from now`
                      : ''}
                  </p>
                </div>
                <div className="bg-white dark:bg-surface-800 rounded-xl p-3">
                  <p className="text-xs text-gray-500">Volatility (Risk)</p>
                  {volatility ? (
                    <>
                      <p className={`text-sm font-bold mt-1 ${volatility.risk === 'Low' ? 'text-green-600' : 'text-red-600'}`}>
                        {volatility.vol}% · {volatility.risk}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">annualized std dev</p>
                    </>
                  ) : <p className="text-sm text-gray-400 mt-1">Need 30+ days</p>}
                </div>
              </div>

              {(() => {
                const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                const futurePoints: Record<string, unknown>[] = [];
                if (regression?.slope && regression?.intercept != null) {
                  const n = regression.dataPoints || chartData.length;
                  for (let offset = 30; offset <= 180; offset += 30) {
                    const nav = parseFloat((regression.slope * (n + offset) + regression.intercept).toFixed(2));
                    const d = new Date();
                    d.setDate(d.getDate() + Math.round(offset * 1.4));
                    const label = `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
                    futurePoints.push({ date: label, predicted: nav });
                  }
                }
                const fullData = [...chartData, ...futurePoints];
                const todayLabel = chartData[chartData.length - 1]?.date as string | undefined;

                return (
                  <div>
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                      NAV History · 30d SMA (blue) · 90d SMA (orange) · Prediction (green dashed) · Breakeven (red)
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart data={fullData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={Math.floor(fullData.length / 7)} />
                        <YAxis domain={['auto', 'auto']} tick={{ fontSize: 9 }} width={50} tickFormatter={(v: number) => `₹${v}`} />
                        <Tooltip
                          formatter={(v: unknown) => v != null ? `₹${parseFloat(String(v)).toFixed(2)}` : null}
                          contentStyle={{ fontSize: 11 }}
                        />
                        <Area type="monotone" dataKey="nav" fill="#e0e7ff" stroke="#6366f1" strokeWidth={1} dot={false} name="NAV" />
                        <Line type="monotone" dataKey="sma30" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="30d SMA" connectNulls />
                        <Line type="monotone" dataKey="sma90" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="90d SMA" connectNulls />
                        <Line type="monotone" dataKey="predicted" stroke="#10b981" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: '#10b981' }} name="Predicted" connectNulls />
                        {breakevenNav > 0 && (
                          <ReferenceLine y={breakevenNav} stroke="#ef4444" strokeDasharray="4 3"
                            label={{ value: `Breakeven ₹${breakevenNav.toFixed(2)}`, fontSize: 9, fill: '#ef4444', position: 'insideTopRight' }} />
                        )}
                        {todayLabel && (
                          <ReferenceLine x={todayLabel} stroke="#9ca3af" strokeDasharray="3 3"
                            label={{ value: 'Today', fontSize: 9, fill: '#9ca3af', position: 'insideTopLeft' }} />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-gray-400 mt-1 italic">
                      30d SMA = avg of last 30 NAVs. Green dashed = linear regression forecast (slope {regression ? `₹${regression.slopePerYear}/yr` : '—'}).
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
          {fund.scheme_code && navHistory.length === 0 && !loadingNav && (
            <p className="text-xs text-gray-500">
              No NAV history yet. Click Refresh NAV to fetch 365 days of data.
            </p>
          )}
        </div>
      )}

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
      const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`);
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
      const res = await fetch(`https://api.mfapi.in/mf/${selectedFund.scheme_code}`);
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

  const DARK = {
    bg: '#16121f', surface: '#1e1830', border: 'rgba(255,255,255,0.10)',
    ink: '#f0eeff', muted: '#8b869a', input: '#120f1c',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 13px', border: `1px solid ${DARK.border}`,
    borderRadius: 10, fontSize: 14, background: DARK.input, color: DARK.ink,
    outline: 'none', boxSizing: 'border-box', colorScheme: 'dark',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 10, fontWeight: 700, color: DARK.muted,
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.60)', backdropFilter: 'blur(6px)' }} onClick={onCancel} />
      <div style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 480, margin: 16,
        background: DARK.bg, border: `1px solid ${DARK.border}`, borderRadius: 20,
        padding: '24px 28px', boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: DARK.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>SIP Tracker</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: DARK.ink, fontFamily: 'Georgia, serif' }}>Log Monthly SIP</div>
            <div style={{ fontSize: 12, color: DARK.muted, marginTop: 2 }}>Pick the date your SIP was debited, then fetch NAV</div>
          </div>
          <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: DARK.muted, fontSize: 16, width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Fund */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Fund</label>
          <select value={selectedFundId} onChange={e => setSelectedFundId(e.target.value)}
            style={{ ...inputStyle, fontWeight: 600 }}>
            {activeFunds.map(f => <option key={f.id} value={f.id} style={{ background: DARK.bg }}>{f.fund_name}</option>)}
          </select>
          {selectedFund && (
            <div style={{ marginTop: 5, fontSize: 12, color: DARK.muted }}>
              SIP amount: <span style={{ fontWeight: 700, color: '#a78bfa' }}>₹{(selectedFund.sip_amount || 0).toLocaleString()}/mo</span>
              {selectedFund.folio_number && <span style={{ marginLeft: 8 }}>· Folio {selectedFund.folio_number}</span>}
            </div>
          )}
        </div>

        {/* SIP Date + Fetch NAV */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>SIP Date</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={fetchNavForDate} disabled={loading || !selectedFund?.scheme_code}
              style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: '#7c6fff', color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: (loading || !selectedFund?.scheme_code) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              <RefreshCw style={{ width: 14, height: 14, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              {loading ? 'Fetching…' : 'Fetch NAV'}
            </button>
          </div>
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Amount (₹)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="e.g. 5000" style={{ ...inputStyle, fontSize: 16, fontWeight: 600 }} />
        </div>

        {/* NAV + Units */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>NAV (₹)</label>
            <input type="number" value={nav} step="0.0001" onChange={e => setNav(e.target.value)}
              placeholder="Auto-fetched" style={{ ...inputStyle, borderColor: nav ? '#34d399' : DARK.border }} />
          </div>
          <div>
            <label style={labelStyle}>Units Allotted</label>
            <input type="number" value={units} step="0.0001" readOnly
              placeholder="Calculated" style={{ ...inputStyle, opacity: 0.6, cursor: 'default' }} />
          </div>
        </div>

        {nav && amount && units && (
          <div style={{ background: 'rgba(124,111,255,0.10)', border: `1px solid rgba(124,111,255,0.25)`, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: DARK.muted }}>
              <span style={{ fontWeight: 700, color: DARK.ink }}>₹{parseFloat(amount).toLocaleString()}</span>
              <span style={{ margin: '0 6px' }}>÷</span>
              <span style={{ fontWeight: 700, color: DARK.ink }}>₹{parseFloat(nav).toFixed(4)}</span>
              <span style={{ margin: '0 6px' }}>=</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa' }}>{parseFloat(units).toFixed(4)} units</div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onCancel}
            style={{ padding: '9px 20px', borderRadius: 10, border: `1px solid ${DARK.border}`, background: 'transparent', color: DARK.muted, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!selectedFundId || !date || !amount || !nav}
            style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: '#7c6fff', color: '#fff', fontSize: 13, fontWeight: 700, cursor: (!selectedFundId || !date || !amount || !nav) ? 'not-allowed' : 'pointer', opacity: (!selectedFundId || !date || !amount || !nav) ? 0.5 : 1, boxShadow: '0 4px 16px rgba(124,111,255,0.35)' }}>
            Log SIP
          </button>
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
            <XAxis dataKey="month" tick={{ fontSize: 9 }} interval={3} />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v: number) => `₹${v}L`} width={42} />
            <Tooltip formatter={(v: unknown) => `₹${v}L`} contentStyle={{ fontSize: 11 }} />
            <Bar dataKey="value" fill="#6366f1" radius={[3, 3, 0, 0]} name="Portfolio" />
            {targetAmt > 0 && (
              <ReferenceLine y={targetAmt / 100000} stroke="#10b981" strokeDasharray="4 3"
                label={{ value: `Target ₹${target}L`, fontSize: 9, fill: '#10b981', position: 'insideTopRight' }} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ── MAIN COMPONENT ────────────────────────────────────────────────────────

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
  const [importing, setImporting] = useState(false);

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

  useEffect(() => {
    loadFunds();
  }, [loadFunds]);

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

  const activeFunds = funds.filter(f => f.fund_type === 'active');
  const histFunds = funds.filter(f => f.fund_type === 'historical');
  const totalInvested = funds.reduce((s, f) => s + (f.invested_value ?? 0), 0);
  const totalCurrent = funds.reduce((s, f) => s + (f.units * (f.current_nav ?? 0)), 0);
  const totalGain = totalCurrent - totalInvested;
  const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const monthlySIP = activeFunds.reduce((s, f) => s + (f.sip_amount ?? 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading SIP Tracker…</div>
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

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleImportHoldings}
          disabled={importing}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-surface-900 border border-gray-200 dark:border-surface-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-surface-800 transition-all"
        >
          <Upload className="h-4 w-4 text-primary-600" />
          Import Holdings
        </button>
        <button
          onClick={handleImportCapitalGains}
          disabled={importing}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-surface-900 border border-gray-200 dark:border-surface-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-surface-800 transition-all"
        >
          <Upload className="h-4 w-4 text-amber-600" />
          Import Capital Gains
        </button>
        {activeFunds.length > 0 && (
          <button
            onClick={() => setShowLogSIP(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm transition-all"
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
              className={`bg-gradient-to-br from-${color}-50 to-white dark:from-${color}-950/30 dark:to-surface-900 rounded-2xl border border-${color}-100 dark:border-${color}-900/30 p-4`}
            >
              <p className={`text-xs font-semibold text-${color}-700 dark:text-${color}-400 uppercase tracking-wide`}>{label}</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1 num">{value}</p>
              {sub && <p className={`text-xs text-${color}-600 dark:text-${color}-500 mt-0.5`}>{sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      {funds.length > 0 && (
        <div className="flex gap-1 bg-gray-100 dark:bg-surface-800 p-1 rounded-xl w-fit">
          {[
            { id: 'active' as const, label: `Active SIPs (${activeFunds.length})` },
            { id: 'historical' as const, label: `Historical (${histFunds.length})` },
            { id: 'goals' as const, label: 'Goal Tracker' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-surface-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
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
    </div>
  );
};

export default SIPTracker;
