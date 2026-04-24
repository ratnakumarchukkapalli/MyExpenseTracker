'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Calculator, TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';

type Props = {
  currentMonth: number;
  currentYear: number;
};

type YearlyRow = {
  month: number;
  year: number;
  cash: number;
  fd: number;
  sip: number;
  shares: number;
  nps_pf: number;
  salary: number;
};

function YearEndProjection({ currentMonth, currentYear }: Props) {
  const { chartColors } = useDarkMode();
  const [rows, setRows] = useState<YearlyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/monthly-summary/yearly?year=${currentYear}`);
        const data = await res.json();
        setRows(data ?? []);
      } catch (error) {
        console.error(error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [currentYear]);

  const chartData = useMemo(() => {
    return rows.map((row) => ({
      label: new Date(row.year, row.month - 1, 1).toLocaleDateString('en-IN', { month: 'short' }),
      netWorth: Number(row.cash) + Number(row.fd) + Number(row.sip) + Number(row.shares) + Number(row.nps_pf),
      cash: Number(row.cash),
      investments: Number(row.fd) + Number(row.sip) + Number(row.shares) + Number(row.nps_pf),
    }));
  }, [rows]);

  const current = chartData[currentMonth - 1] ?? chartData[chartData.length - 1];
  const yearEnd = chartData[chartData.length - 1];
  const gap = Math.round((yearEnd?.netWorth ?? 0) - (current?.netWorth ?? 0));

  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="pane rounded-[28px] p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Yearly Net Worth</p>
            <h2 className="mt-2 text-2xl font-semibold">Projected from monthly summary snapshots</h2>
          </div>
          <div className="rounded-2xl border px-4 py-3 text-right" style={{ background: 'var(--surface-solid)', borderColor: 'var(--hairline)' }}>
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Delta to year-end</p>
            <p className="mt-2 text-xl font-semibold text-[var(--accent)]">₹{gap.toLocaleString('en-IN')}</p>
          </div>
        </div>

        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="projectionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColors.pos} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={chartColors.pos} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="rgba(100,100,120,0.14)" />
              <Tooltip
                formatter={(value) => {
                  const amount = typeof value === 'number' ? value : Number(value ?? 0);
                  return [`₹${amount.toLocaleString('en-IN')}`, 'Net Worth'];
                }}
              />
              <Area type="monotone" dataKey="netWorth" stroke={chartColors.pos} strokeWidth={2.5} fill="url(#projectionGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-5">
        <article className="pane rounded-[28px] p-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-[var(--accent)]" />
            <h3 className="text-lg font-semibold">Current snapshot</h3>
          </div>
          {loading ? (
            <p className="mt-4 text-sm text-[var(--ink-muted)]">Loading yearly data…</p>
          ) : (
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl border px-4 py-3" style={{ background: 'var(--surface-solid)', borderColor: 'var(--hairline)' }}>
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Current month net worth</p>
                <p className="mt-2 text-2xl font-semibold">₹{Math.round(current?.netWorth ?? 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="rounded-2xl border px-4 py-3" style={{ background: 'var(--surface-solid)', borderColor: 'var(--hairline)' }}>
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Cash</p>
                <p className="mt-2 text-xl font-semibold">₹{Math.round(current?.cash ?? 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="rounded-2xl border px-4 py-3" style={{ background: 'var(--surface-solid)', borderColor: 'var(--hairline)' }}>
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Investments</p>
                <p className="mt-2 text-xl font-semibold">₹{Math.round(current?.investments ?? 0).toLocaleString('en-IN')}</p>
              </div>
            </div>
          )}
        </article>

        <article className="pane rounded-[28px] p-6">
          <div className="flex items-center gap-3">
            <Calculator className="h-5 w-5 text-[var(--accent)]" />
            <h3 className="text-lg font-semibold">How to read this</h3>
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--ink-muted)]">
            This web version uses the already-migrated `monthly_summary/yearly` API to visualize the same bank-plus-investments
            trend that the Electron projection relied on. It is a good frontend checkpoint while the richer simulation inputs are
            still being ported over.
          </p>
        </article>
      </section>
    </div>
  );
}

export default YearEndProjection;
