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
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--surface-solid, #fff)',
          borderRadius: 20,
          boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
          width: '100%',
          maxWidth: 520,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '18px 22px 16px',
          borderBottom: '1px solid var(--hairline, #e5e7eb)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'color-mix(in oklch, var(--accent, #6366f1) 12%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <SlidersHorizontal size={16} color="var(--accent, #6366f1)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Budget Settings</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 1 }}>
              Set monthly budget per category — as % of salary or fixed amount
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--surface-hover, #f3f4f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={14} color="var(--ink-muted)" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {CAT_META.map(c => {
            const row = rows[c.key] || { budget_type: 'percentage', budget_value: 0 };
            const helperAmt = computeAmount(row);
            const isPercent = row.budget_type === 'percentage';

            return (
              <div key={c.key} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '10px 14px',
                borderRadius: 12,
                background: 'var(--surface, rgba(255,255,255,0.6))',
                border: '1px solid var(--hairline, #e5e7eb)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 80 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{c.label}</span>
                </div>

                <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--hairline, #e5e7eb)', flexShrink: 0 }}>
                  {['percentage', 'fixed'].map(type => (
                    <button
                      key={type}
                      onClick={() => setType(c.key, type)}
                      style={{
                        padding: '4px 10px', border: 'none', cursor: 'pointer',
                        fontSize: 11, fontWeight: 600,
                        background: row.budget_type === type ? c.color : 'transparent',
                        color: row.budget_type === type ? '#fff' : 'var(--ink-muted)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {type === 'percentage' ? '%' : '₹'}
                    </button>
                  ))}
                </div>

                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="number"
                    min="0"
                    step={isPercent ? '1' : '1000'}
                    value={row.budget_value}
                    onChange={e => setValue(c.key, e.target.value)}
                    style={{
                      width: '100%', border: '1px solid var(--hairline, #e5e7eb)',
                      borderRadius: 8, padding: '5px 36px 5px 10px',
                      fontSize: 13, background: 'transparent',
                      color: 'var(--ink)', outline: 'none',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                  <span style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 11, color: 'var(--ink-faint)', pointerEvents: 'none',
                  }}>
                    {isPercent ? '%' : '₹'}
                  </span>
                </div>

                <div style={{ minWidth: 52, textAlign: 'right' }}>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-muted)', fontVariantNumeric: 'tabular-nums' }}>
                    {isPercent && salary > 0 ? formatHelperAmount(helperAmt) : (isPercent ? '—' : '')}
                  </span>
                </div>
              </div>
            );
          })}

          {CAT_META.some(c => rows[c.key]?.budget_type === 'percentage') && (
            <div style={{
              fontSize: 11.5,
              color: totalPct === 100 ? '#10b981' : totalPct > 100 ? '#ef4444' : 'var(--ink-muted)',
              textAlign: 'right', paddingRight: 4,
            }}>
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
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          padding: '14px 22px',
          borderTop: '1px solid var(--hairline, #e5e7eb)',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px', borderRadius: 10, border: '1px solid var(--hairline, #e5e7eb)',
              background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              color: 'var(--ink-muted)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 22px', borderRadius: 10, border: 'none',
              background: savedFlash ? '#10b981' : 'var(--accent, #6366f1)',
              color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'background 0.2s',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {savedFlash ? <><Check size={14} /> Saved</> : saving ? 'Saving…' : 'Save Budgets'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BudgetSettingsModal;
