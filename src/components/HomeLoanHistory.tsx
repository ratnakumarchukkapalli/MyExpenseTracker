'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Home, Info } from 'lucide-react';

interface HistoryRow {
  id: number;
  month: string; // YYYY-MM-01
  lender: string;
  main_emi: number;
  service_charge: number;
  extra_debit: number;
  refund_credit: number;
  note: string | null;
}

interface ContributionRow {
  id: number;
  contributed_date: string;
  source: string;
  amount: number;
  note: string | null;
}

function formatINR(amount: number) {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function formatMonth(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function rowTotal(r: HistoryRow) {
  return r.main_emi + r.service_charge + r.extra_debit;
}

function HomeLoanHistory() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/home-loan-history').then((res) => res.json()),
      fetch('/api/home-loan-contributions').then((res) => res.json()),
    ])
      .then(([historyData, contribData]) => {
        setRows(Array.isArray(historyData) ? historyData : []);
        setContributions(Array.isArray(contribData) ? contribData : []);
      })
      .catch((err) => console.error('Failed to load home loan history:', err))
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    const totalPaid = rows.reduce((sum, r) => sum + rowTotal(r), 0);
    const totalRefund = rows.reduce((sum, r) => sum + r.refund_credit, 0);
    const byLender = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.lender] = (acc[r.lender] || 0) + rowTotal(r);
      return acc;
    }, {});
    const months = new Set(rows.map((r) => r.month)).size;
    return { totalPaid, totalRefund, byLender, months };
  }, [rows]);

  const contribution = useMemo(() => {
    const fromOthers = contributions.reduce((sum, c) => sum + c.amount, 0);
    const ownContribution = summary.totalPaid - fromOthers;
    const ownPct = summary.totalPaid > 0 ? (ownContribution / summary.totalPaid) * 100 : 0;
    const othersPct = 100 - ownPct;
    return { fromOthers, ownContribution, ownPct, othersPct };
  }, [contributions, summary.totalPaid]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 bg-gray-100 dark:bg-surface-800 rounded-2xl animate-pulse" />
        <div className="h-96 bg-gray-100 dark:bg-surface-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-surface-800 flex items-center justify-center flex-shrink-0">
          <Home className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Home Loan Payment History</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Reconstructed from Kotak bank statements, Jan 2023 – Aug 2026. Read-only reference — does not affect
            expenses, monthly totals, or reports.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-2xl p-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Paid</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatINR(summary.totalPaid)}</div>
          <div className="text-xs text-gray-400 mt-1">across {summary.months} months</div>
        </div>
        {Object.entries(summary.byLender).map(([lender, amt]) => (
          <div key={lender} className="bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-2xl p-4">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{lender}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatINR(amt)}</div>
          </div>
        ))}
      </div>

      {summary.totalRefund > 0 && (
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-2xl p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-green-800 dark:text-green-400">
            <span className="font-semibold">{formatINR(summary.totalRefund)}</span> in refunds/credits were received
            back from Tata Capital Housing Finance during the transfer to IDBI Bank (Nov–Dec 2024). These are shown
            per-month below but excluded from the &ldquo;Total Paid&rdquo; figure above.
          </div>
        </div>
      )}

      {/* Contribution breakdown — separate section */}
      <div className="bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Contribution Breakdown</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Krishna Kishore&rsquo;s UPI/NEFT credits received since your first home loan debit (Jan 2023), subtracted
          from total paid to show what you funded yourself.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Paid</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">{formatINR(summary.totalPaid)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">From Krishna Kishore</div>
            <div className="text-xl font-bold text-amber-600 mt-1">{formatINR(contribution.fromOthers)}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Your Own Contribution</div>
            <div className="text-xl font-bold text-green-600 mt-1">{formatINR(contribution.ownContribution)}</div>
          </div>
        </div>
        <div className="h-2.5 w-full rounded-full bg-amber-100 dark:bg-amber-900/30 overflow-hidden flex">
          <div className="h-full bg-green-500" style={{ width: `${contribution.ownPct}%` }} />
          <div className="h-full bg-amber-500" style={{ width: `${contribution.othersPct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1.5">
          <span>You: {contribution.ownPct.toFixed(1)}%</span>
          <span>Krishna Kishore: {contribution.othersPct.toFixed(1)}%</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-surface-800 bg-gray-50/50 dark:bg-surface-800/30 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Lender</th>
                <th className="px-4 py-3 text-right">Main EMI</th>
                <th className="px-4 py-3 text-right">Service / Insurance</th>
                <th className="px-4 py-3 text-right">Extra</th>
                <th className="px-4 py-3 text-right">Refund</th>
                <th className="px-4 py-3 text-right">Total Paid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 dark:border-surface-800/60 last:border-0 align-top">
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                    {formatMonth(r.month)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        r.lender === 'IDBI Bank'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      }`}
                    >
                      {r.lender}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.main_emi ? formatINR(r.main_emi) : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.service_charge ? formatINR(r.service_charge) : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.extra_debit ? formatINR(r.extra_debit) : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-600">
                    {r.refund_credit ? `+${formatINR(r.refund_credit)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-white">
                    {formatINR(rowTotal(r))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Notes footer — only render rows that actually have a note */}
        {rows.some((r) => r.note) && (
          <div className="px-4 py-3 border-t border-gray-100 dark:border-surface-800 bg-gray-50/50 dark:bg-surface-800/30 space-y-1.5">
            {rows
              .filter((r) => r.note)
              .map((r) => (
                <div key={r.id} className="text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{formatMonth(r.month)} ({r.lender}):</span>{' '}
                  {r.note}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default HomeLoanHistory;
