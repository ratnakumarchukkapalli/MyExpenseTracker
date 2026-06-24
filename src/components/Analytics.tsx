'use client';

import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, PieChart, Pie, Legend,
} from 'recharts';
import { CATEGORY_COLORS } from '../constants/categories';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type YearlyRow = {
  month: number;
  year: number;
  cash: number;
  fd: number;
  sip: number;
  shares: number;
  nps_pf: number;
  salary: number;
  savings?: number;
};

type Expense = {
  date: string;
  amount: number;
  category: string;
};

interface Props {
  expenses: Expense[];
  yearlyRows: YearlyRow[];
  currentMonth: number;
  currentYear: number;
  privacyMode?: boolean;
}

const fmt = (v: number) =>
  v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${Math.round(v / 1000)}K` : `₹${Math.round(v)}`;

function Analytics({ expenses, yearlyRows, currentMonth, currentYear, privacyMode }: Props) {
  // Category donut — current month
  const categoryData = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach((e) => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // 6-month bar chart — past months only (exclude future carry-forward rows)
  const last6 = useMemo(() => {
    const sorted = [...yearlyRows]
      .filter((r) => r.year < currentYear || (r.year === currentYear && r.month <= currentMonth))
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
    return sorted.slice(-6).map((r) => ({
      label: MONTHS_SHORT[r.month - 1],
      networth: Math.round(r.cash + r.fd + r.sip + r.shares + r.nps_pf),
      savings: Math.round(r.savings ?? 0),
    }));
  }, [yearlyRows, currentMonth, currentYear]);

  // Year view — past months only for currentYear
  const yearRows = useMemo(() => {
    return yearlyRows
      .filter((r) => r.year === currentYear && r.month <= currentMonth)
      .sort((a, b) => a.month - b.month)
      .map((r) => {
        const networth = r.cash + r.fd + r.sip + r.shares + r.nps_pf;
        const savingsRate = r.salary > 0 ? ((r.savings ?? 0) / r.salary) * 100 : null;
        return { ...r, networth, savingsRate };
      });
  }, [yearlyRows, currentYear]);

  const MASK = '••••';

  return (
    <div className="fade-in" style={{ paddingBottom: 48 }}>
      {/* Header */}
      <div className="dash-hero" style={{ paddingBottom: 24 }}>
        <div className="dash-hero-left">
          <div className="eyebrow">Analytics · {currentYear}</div>
          <div className="dash-hero-number serif" style={{ fontSize: 32 }}>Spending Insights</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Category Donut */}
        <div className="pane" style={{ padding: '20px 24px' }}>
          <div className="eyebrow mb-1">This month</div>
          <div className="serif mb-4" style={{ fontSize: 18, color: 'var(--ink)' }}>Spend by Category</div>
          {categoryData.length === 0 ? (
            <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>No expenses this month.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {categoryData.map((entry) => (
                    <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] || '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => privacyMode ? MASK : fmt(Number(value))}
                  contentStyle={{ background: 'var(--pane)', border: '1px solid var(--hairline)', borderRadius: 8, fontSize: 12 }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* 6-month Net Worth trend */}
        <div className="pane" style={{ padding: '20px 24px' }}>
          <div className="eyebrow mb-1">Last 6 months</div>
          <div className="serif mb-4" style={{ fontSize: 18, color: 'var(--ink)' }}>Net Worth Trend</div>
          {last6.length === 0 ? (
            <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>Not enough history yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={last6} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--ink-faint)' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => privacyMode ? '' : fmt(v)} tick={{ fontSize: 10, fill: 'var(--ink-faint)' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  formatter={(value) => privacyMode ? MASK : fmt(Number(value))}
                  contentStyle={{ background: 'var(--pane)', border: '1px solid var(--hairline)', borderRadius: 8, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="networth" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--accent)' }} name="Net Worth" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Savings bar chart */}
      <div className="pane mb-6" style={{ padding: '20px 24px' }}>
        <div className="eyebrow mb-1">Last 6 months</div>
        <div className="serif mb-4" style={{ fontSize: 18, color: 'var(--ink)' }}>Monthly Savings</div>
        {last6.length === 0 ? (
          <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>Not enough history yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={last6} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barSize={32}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--ink-faint)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => privacyMode ? '' : fmt(v)} tick={{ fontSize: 10, fill: 'var(--ink-faint)' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                formatter={(value) => privacyMode ? MASK : fmt(Number(value))}
                contentStyle={{ background: 'var(--pane)', border: '1px solid var(--hairline)', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="savings" fill="#10b981" radius={[4, 4, 0, 0]} name="Savings" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Year table */}
      <div className="pane" style={{ padding: '20px 24px' }}>
        <div className="eyebrow mb-1">{currentYear} overview</div>
        <div className="serif mb-4" style={{ fontSize: 18, color: 'var(--ink)' }}>Year at a Glance</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
                {['Month', 'Income', 'Savings', 'Rate', 'Net Worth'].map((h) => (
                  <th key={h} style={{ padding: '6px 12px', textAlign: h === 'Month' ? 'left' : 'right', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-faint)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yearRows.map((r) => {
                const isCurrent = r.month === currentMonth;
                return (
                  <tr
                    key={r.month}
                    style={{
                      borderBottom: '1px solid var(--hairline)',
                      background: isCurrent ? 'var(--accent-bg)' : undefined,
                      fontWeight: isCurrent ? 600 : 400,
                    }}
                  >
                    <td style={{ padding: '8px 12px', color: 'var(--ink)' }}>{MONTHS_SHORT[r.month - 1]}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{privacyMode ? MASK : fmt(r.salary)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>{privacyMode ? MASK : fmt(r.savings ?? 0)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: r.savingsRate !== null && r.savingsRate >= 20 ? '#10b981' : 'var(--ink-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {r.savingsRate !== null ? `${r.savingsRate.toFixed(0)}%` : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{privacyMode ? MASK : fmt(r.networth)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {yearRows.length === 0 && <p style={{ color: 'var(--ink-faint)', fontSize: 13, marginTop: 8 }}>No data for {currentYear} yet.</p>}
        </div>
      </div>
    </div>
  );
}

export default Analytics;
