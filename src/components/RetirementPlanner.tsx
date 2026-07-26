'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { PiggyBank, Settings, Plus, Trash2, X, Save, Target } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

type Assumptions = {
  birth_year: number;
  target_age: number;
  life_expectancy_age: number;
  pre_return_rate: number;
  post_return_rate: number;
  inflation_rate: number;
  salary_growth_rate: number;
  annual_bonus_pct: number;
  monthly_surplus_override: number | null;
  annual_salary_override: number | null;
  withdrawal_start_age: number | null;
};

type Milestone = {
  id: number;
  label: string;
  target_year: number;
  amount: number;
};

type ProjectionResult = {
  rows: { age: number; year: number; corpus: number; phase: 'accumulation' | 'withdrawal' }[];
  corpusAtTargetAge: number;
  checkpointThreshold: number;
  checkpointPassed: boolean;
  finalCorpus: number;
  depletionAge: number | null;
  inputs: {
    currentCorpus: number;
    monthlySurplus: number;
    autoMonthlySurplus: number;
    isOverride: boolean;
    currentAnnualSalary: number;
    autoAnnualSalary: number;
    isSalaryOverride: boolean;
    bonusApplied: boolean;
    currentAnnualExpenses: number;
  };
};

function formatINR(amount: number) {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function RetirementPlanner() {
  const { chartColors } = useDarkMode();
  const [assumptions, setAssumptions] = useState<Assumptions | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projection, setProjection] = useState<ProjectionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAssumptionsForm, setShowAssumptionsForm] = useState(false);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [planRes, milestonesRes, projectionRes] = await Promise.all([
        fetch('/api/retirement-plan'),
        fetch('/api/retirement-plan/milestones'),
        fetch('/api/retirement-plan/projection'),
      ]);
      setAssumptions(await planRes.json());
      setMilestones(await milestonesRes.json());
      setProjection(await projectionRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const chartData = useMemo(() => {
    if (!projection) return [];
    return projection.rows.map((r) => ({ age: r.age, corpus: r.corpus }));
  }, [projection]);

  const handleDeleteMilestone = async (id: number) => {
    if (!window.confirm('Delete this milestone?')) return;
    await fetch(`/api/retirement-plan/milestones/${id}`, { method: 'DELETE' });
    void loadAll();
  };

  if (loading && !assumptions) {
    return <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Loading retirement plan…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--ink)' }}>
            <PiggyBank className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            Retirement / FI Corpus Planner
          </h3>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            Projects your investable corpus forward using your real salary, expenses, and EMI schedule — not a hard retirement date, just a safety-net checkpoint.
          </p>
        </div>
        <button
          onClick={() => setShowAssumptionsForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm cursor-pointer"
          style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink-soft)' }}
        >
          <Settings size={16} />
          Assumptions
        </button>
      </div>

      {projection && (
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${assumptions?.withdrawal_start_age ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          <div className="rounded-2xl p-5" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--ink-faint)' }}>Current corpus</p>
            <p className="text-xl font-bold" style={{ color: 'var(--ink)' }}>{formatINR(projection.inputs.currentCorpus)}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>SIP + stocks + bank balances</p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--ink-faint)' }}>
              Monthly surplus {projection.inputs.isOverride ? '(manual override)' : '(trailing 12mo avg)'}
            </p>
            <p className="text-xl font-bold" style={{ color: 'var(--ink)' }}>{formatINR(projection.inputs.monthlySurplus)}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>
              {projection.inputs.isOverride
                ? `Auto-calculated value was ${formatINR(projection.inputs.autoMonthlySurplus)} — override it in Assumptions`
                : 'Salary minus expenses, excluding Savings-category entries — override it in Assumptions'}
            </p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: projection.checkpointPassed ? 'var(--pos-bg)' : 'var(--neg-bg)', border: '1px solid var(--hairline)' }}>
            <p className="text-xs mb-1 flex items-center gap-1" style={{ color: 'var(--ink-faint)' }}>
              <Target size={12} /> Corpus at age {assumptions?.target_age} vs 25× expenses
            </p>
            <p className="text-xl font-bold" style={{ color: projection.checkpointPassed ? 'var(--pos)' : 'var(--neg)' }}>
              {formatINR(projection.corpusAtTargetAge)} / {formatINR(projection.checkpointThreshold)}
            </p>
            <p className="text-xs mt-1 font-semibold" style={{ color: projection.checkpointPassed ? 'var(--pos)' : 'var(--neg)' }}>
              {projection.checkpointPassed ? '✓ Checkpoint passed' : `Short by ${formatINR(projection.checkpointThreshold - projection.corpusAtTargetAge)}`}
            </p>
          </div>
          {assumptions?.withdrawal_start_age != null && (
            <div className="rounded-2xl p-5" style={{ background: projection.depletionAge ? 'var(--neg-bg)' : 'var(--pos-bg)', border: '1px solid var(--hairline)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--ink-faint)' }}>Withdrawal phase from age {assumptions.withdrawal_start_age}</p>
              <p className="text-xl font-bold" style={{ color: projection.depletionAge ? 'var(--neg)' : 'var(--pos)' }}>
                {projection.depletionAge ? `Depletes at age ${projection.depletionAge}` : `Lasts to age ${assumptions.life_expectancy_age}`}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>
                {projection.depletionAge ? 'Corpus runs out before life expectancy at current rates' : '✓ Corpus survives to life expectancy'}
              </p>
            </div>
          )}
        </div>
      )}

      {projection && (
        <p className="text-xs px-1" style={{ color: 'var(--ink-faint)' }}>
          {projection.inputs.bonusApplied
            ? `Annual bonus applied on top of your ₹${Math.round(projection.inputs.currentAnnualSalary).toLocaleString('en-IN')} base salary override.`
            : `Annual bonus not added separately — your ₹${Math.round(projection.inputs.autoAnnualSalary).toLocaleString('en-IN')}/yr auto salary baseline already includes any real bonus paid in the trailing 12 months. Set a base salary override in Assumptions to apply the bonus rate cleanly on top instead.`}
        </p>
      )}

      <div className="rounded-2xl p-6" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
        <p className="eyebrow mb-2" style={{ color: 'var(--ink-faint)' }}>Corpus by age</p>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="retirementGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColors.accent} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={chartColors.accent} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={chartColors.grid} />
              <XAxis dataKey="age" stroke={chartColors.axisText} fontSize={12} tickLine={false} axisLine={false} padding={{ left: 16, right: 16 }} />
              <Tooltip
                formatter={(value) => [formatINR(Number(value ?? 0)), 'Corpus']}
                labelFormatter={(age) => `Age ${age}`}
                contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}` }}
              />
              {assumptions && (
                <ReferenceLine
                  x={assumptions.target_age}
                  stroke={chartColors.amber}
                  strokeDasharray="4 4"
                  label={{ value: `Age ${assumptions.target_age}`, position: 'top', fill: chartColors.amber, fontSize: 12 }}
                />
              )}
              {assumptions?.withdrawal_start_age != null && (
                <ReferenceLine
                  x={assumptions.withdrawal_start_age}
                  stroke={chartColors.red}
                  strokeDasharray="4 4"
                  label={{ value: `Withdrawal (${assumptions.withdrawal_start_age})`, position: 'top', fill: chartColors.red, fontSize: 12 }}
                />
              )}
              <Area type="monotone" dataKey="corpus" stroke={chartColors.accent} strokeWidth={2.5} fill="url(#retirementGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl p-6" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold" style={{ color: 'var(--ink)' }}>Future one-off expenses</h4>
          <button
            onClick={() => { setEditingMilestone(null); setShowMilestoneForm(true); }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            <Plus size={14} />
            Add
          </button>
        </div>
        {milestones.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ink-faint)' }}>
            No milestones yet — add things like &ldquo;Kid 1 college fees&rdquo; with a target year and today&apos;s-rupee amount. It&apos;ll be inflated forward automatically.
          </p>
        ) : (
          <div className="space-y-2">
            {milestones.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)' }}>
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{m.label}</p>
                  <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>{m.target_year} · {formatINR(m.amount)} in today&apos;s rupees</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setEditingMilestone(m); setShowMilestoneForm(true); }}
                    className="p-1.5 rounded-lg cursor-pointer text-xs font-bold"
                    style={{ color: 'var(--ink-faint)' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteMilestone(m.id)}
                    className="p-1.5 rounded-lg cursor-pointer"
                    style={{ color: 'var(--ink-faint)' }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAssumptionsForm && assumptions && (
        <AssumptionsForm
          assumptions={assumptions}
          onCancel={() => setShowAssumptionsForm(false)}
          onSaved={() => { setShowAssumptionsForm(false); void loadAll(); }}
        />
      )}

      {showMilestoneForm && (
        <MilestoneForm
          milestone={editingMilestone}
          onCancel={() => { setShowMilestoneForm(false); setEditingMilestone(null); }}
          onSaved={() => { setShowMilestoneForm(false); setEditingMilestone(null); void loadAll(); }}
        />
      )}
    </div>
  );
}

function AssumptionsForm({ assumptions, onCancel, onSaved }: { assumptions: Assumptions; onCancel: () => void; onSaved: () => void }) {
  const currentYear = new Date().getFullYear();
  const [currentAge, setCurrentAge] = useState(String(currentYear - assumptions.birth_year));
  const [targetAge, setTargetAge] = useState(String(assumptions.target_age));
  const [lifeExpectancyAge, setLifeExpectancyAge] = useState(String(assumptions.life_expectancy_age));
  const [preReturn, setPreReturn] = useState(String(assumptions.pre_return_rate * 100));
  const [postReturn, setPostReturn] = useState(String(assumptions.post_return_rate * 100));
  const [inflation, setInflation] = useState(String(assumptions.inflation_rate * 100));
  const [salaryGrowth, setSalaryGrowth] = useState(String(assumptions.salary_growth_rate * 100));
  const [annualBonus, setAnnualBonus] = useState(String(assumptions.annual_bonus_pct * 100));
  const [surplusOverride, setSurplusOverride] = useState(assumptions.monthly_surplus_override != null ? String(assumptions.monthly_surplus_override) : '');
  const [salaryOverride, setSalaryOverride] = useState(assumptions.annual_salary_override != null ? String(assumptions.annual_salary_override) : '');
  const [withdrawalStartAge, setWithdrawalStartAge] = useState(assumptions.withdrawal_start_age != null ? String(assumptions.withdrawal_start_age) : '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/retirement-plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birth_year: currentYear - parseInt(currentAge, 10),
          target_age: parseInt(targetAge, 10),
          life_expectancy_age: parseInt(lifeExpectancyAge, 10),
          pre_return_rate: parseFloat(preReturn) / 100,
          post_return_rate: parseFloat(postReturn) / 100,
          inflation_rate: parseFloat(inflation) / 100,
          salary_growth_rate: parseFloat(salaryGrowth) / 100,
          annual_bonus_pct: parseFloat(annualBonus) / 100,
          monthly_surplus_override: surplusOverride ? parseFloat(surplusOverride) : null,
          annual_salary_override: salaryOverride ? parseFloat(salaryOverride) : null,
          withdrawal_start_age: withdrawalStartAge ? parseInt(withdrawalStartAge, 10) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.formErrors?.[0] || 'Failed to save assumptions');
      }
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save assumptions');
    } finally {
      setSubmitting(false);
    }
  };

  const fields: Array<{ label: string; value: string; setValue: (v: string) => void; suffix?: string }> = [
    { label: 'Current age', value: currentAge, setValue: setCurrentAge },
    { label: 'Checkpoint age', value: targetAge, setValue: setTargetAge },
    { label: 'Life expectancy age', value: lifeExpectancyAge, setValue: setLifeExpectancyAge },
    { label: 'Pre-checkpoint return', value: preReturn, setValue: setPreReturn, suffix: '%' },
    { label: 'Post-checkpoint return', value: postReturn, setValue: setPostReturn, suffix: '%' },
    { label: 'Inflation rate', value: inflation, setValue: setInflation, suffix: '%' },
    { label: 'Salary growth rate', value: salaryGrowth, setValue: setSalaryGrowth, suffix: '%' },
    { label: 'Annual bonus (% of salary)', value: annualBonus, setValue: setAnnualBonus, suffix: '%' },
  ];

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !submitting && onCancel()} />
      <div className="relative z-10 w-full max-w-md pane-strong p-6 shadow-2xl border border-[var(--hairline)]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>Retirement Assumptions</h3>
          <button onClick={() => !submitting && onCancel()} className="cursor-pointer" style={{ color: 'var(--ink-faint)' }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>
              Monthly surplus override (opt)
            </label>
            <input
              type="number"
              step="0.01"
              value={surplusOverride}
              onChange={(e) => setSurplusOverride(e.target.value)}
              placeholder="Leave blank to auto-calculate from trailing 12mo salary/expenses"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>
              Base annual salary override, excl. bonus (opt)
            </label>
            <input
              type="number"
              step="0.01"
              value={salaryOverride}
              onChange={(e) => setSalaryOverride(e.target.value)}
              placeholder="Leave blank to skip the annual bonus — auto salary already includes any real bonus paid"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>
              Withdrawal start age (opt)
            </label>
            <input
              type="number"
              min="1"
              max="120"
              value={withdrawalStartAge}
              onChange={(e) => setWithdrawalStartAge(e.target.value)}
              placeholder="Leave blank if you don't plan to stop earning — post-checkpoint return stays unused"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.label}>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>{f.label}</label>
                <input
                  type="number"
                  step="0.01"
                  value={f.value}
                  onChange={(e) => f.setValue(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm cursor-pointer"
              style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink-soft)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              <Save size={16} />
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MilestoneForm({ milestone, onCancel, onSaved }: { milestone?: Milestone | null; onCancel: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(milestone?.label ?? '');
  const [targetYear, setTargetYear] = useState(milestone?.target_year?.toString() ?? String(new Date().getFullYear() + 10));
  const [amount, setAmount] = useState(milestone?.amount?.toString() ?? '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !amount) {
      alert('Label and amount are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { label: label.trim(), target_year: parseInt(targetYear, 10), amount: parseFloat(amount) };
      const res = milestone
        ? await fetch(`/api/retirement-plan/milestones/${milestone.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/retirement-plan/milestones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.formErrors?.[0] || 'Failed to save milestone');
      }
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save milestone');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !submitting && onCancel()} />
      <div className="relative z-10 w-full max-w-sm pane-strong p-6 shadow-2xl border border-[var(--hairline)]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{milestone ? 'Edit Milestone' : 'Add Milestone'}</h3>
          <button onClick={() => !submitting && onCancel()} className="cursor-pointer" style={{ color: 'var(--ink-faint)' }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Kid 1 college fees"
              autoFocus
              required
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>Target Year</label>
              <input
                type="number"
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>Amount (today&apos;s ₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm cursor-pointer"
              style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink-soft)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              <Save size={16} />
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RetirementPlanner;
