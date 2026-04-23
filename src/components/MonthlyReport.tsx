'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Brain, RefreshCw } from 'lucide-react';

type Props = {
  currentMonth: number;
  currentYear: number;
};

type ReportShape = {
  summary?: {
    headline?: string;
  };
  textInsights?: string[];
  analysis?: Record<string, unknown>;
  predictions?: Record<string, unknown>;
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return value.toLocaleString('en-IN');
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function MonthlyReport({ currentMonth, currentYear }: Props) {
  const [report, setReport] = useState<ReportShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${currentMonth}/${currentYear}`);
      if (!res.ok) throw new Error('Unable to load stored report');
      setReport(await res.json());
    } catch (loadError) {
      console.error(loadError);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, [currentMonth, currentYear]);

  const analysisEntries = useMemo(() => {
    if (!report?.analysis) return [];
    return Object.entries(report.analysis).slice(0, 6);
  }, [report]);

  const predictionEntries = useMemo(() => {
    if (!report?.predictions) return [];
    return Object.entries(report.predictions).slice(0, 6);
  }, [report]);

  if (loading) {
    return (
      <div className="pane rounded-[28px] p-8 text-sm text-[var(--ink-muted)]">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading saved monthly report
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pane rounded-[28px] p-8">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--neg)]" />
          <div>
            <h3 className="text-lg font-semibold">Unable to load report</h3>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="pane rounded-[28px] p-8">
        <div className="flex items-start gap-3">
          <Brain className="mt-0.5 h-5 w-5 text-[var(--accent)]" />
          <div>
            <h3 className="text-lg font-semibold">No stored report yet</h3>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              The report route is wired up, but this month does not have a generated report record in `monthly_reports` yet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="pane rounded-[28px] p-6">
        <p className="eyebrow">Narrative</p>
        <h2 className="mt-2 text-2xl font-semibold">
          {report.summary?.headline ?? 'Stored monthly report'}
        </h2>

        {Array.isArray(report.textInsights) && report.textInsights.length > 0 ? (
          <div className="mt-5 space-y-3">
            {report.textInsights.slice(0, 8).map((insight, index) => {
              const text = typeof insight === 'string' ? insight : (typeof insight === 'object' && insight !== null && 'text' in insight ? String((insight as any).text) : JSON.stringify(insight));
              return (
                <div key={index} className="rounded-2xl border border-[var(--hairline)] bg-white/60 px-4 py-3 text-sm text-[var(--ink-soft)]">
                  {text}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 text-sm text-[var(--ink-muted)]">No freeform insights were stored with this report.</p>
        )}
      </section>

      <section className="space-y-5">
        <article className="pane rounded-[28px] p-6">
          <p className="eyebrow">Analysis Snapshot</p>
          <div className="mt-4 space-y-3">
            {analysisEntries.length === 0 && <p className="text-sm text-[var(--ink-muted)]">No structured analysis keys were stored.</p>}
            {analysisEntries.map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-[var(--hairline)] bg-white/55 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">{key}</p>
                <pre className="mt-2 whitespace-pre-wrap text-sm text-[var(--ink-soft)]">{formatValue(value)}</pre>
              </div>
            ))}
          </div>
        </article>

        <article className="pane rounded-[28px] p-6">
          <p className="eyebrow">Predictions</p>
          <div className="mt-4 space-y-3">
            {predictionEntries.length === 0 && <p className="text-sm text-[var(--ink-muted)]">No prediction payload was stored.</p>}
            {predictionEntries.map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-[var(--hairline)] bg-white/55 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">{key}</p>
                <pre className="mt-2 whitespace-pre-wrap text-sm text-[var(--ink-soft)]">{formatValue(value)}</pre>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

export default MonthlyReport;
