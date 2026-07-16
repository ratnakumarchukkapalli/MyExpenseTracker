'use client';

import React, { useState } from 'react';
import { CreditCard as CardIcon, Plus, Edit2, Trash2, X, Save, IndianRupee } from 'lucide-react';

export interface CreditCardData {
  id: number;
  name: string;
  credit_limit?: number | null;
  current_balance: number;
}

interface BankAccountOption {
  id: number;
  name: string;
}

interface Props {
  cards: CreditCardData[];
  bankAccounts?: BankAccountOption[];
  onChange: () => void;
}

function CreditCards({ cards, bankAccounts = [], onChange }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCardData | null>(null);
  const [payingCard, setPayingCard] = useState<CreditCardData | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payAccountId, setPayAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async (card: CreditCardData) => {
    if (!window.confirm(`Delete ${card.name}? This won't affect past expenses.`)) return;
    await fetch(`/api/credit-cards/${card.id}`, { method: 'DELETE' });
    onChange();
  };

  const handlePay = async () => {
    if (!payingCard) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      alert('Enter a valid amount');
      return;
    }
    if (bankAccounts.length > 0 && !payAccountId) {
      alert('Please select which account this payment came from');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/credit-cards/${payingCard.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, bank_account_id: payAccountId ? Number(payAccountId) : null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to record payment');
      }
      setPayingCard(null);
      setPayAmount('');
      setPayAccountId('');
      onChange();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>Credit Cards</h3>
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>
            Balances here are unpaid card charges — they don&apos;t hit your bank balance until you pay them off
          </p>
        </div>
        <button
          onClick={() => { setEditingCard(null); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm cursor-pointer"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          <Plus size={16} />
          Add Card
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
          <CardIcon className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--ink-faint)' }} />
          <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>No credit cards added yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cards.map((card) => {
            const limit = card.credit_limit ?? null;
            const utilizationPct = limit && limit > 0 ? Math.min(100, Math.round((card.current_balance / limit) * 100)) : null;
            return (
              <div key={card.id} className="rounded-2xl p-5 group" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)' }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                      <CardIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--ink)' }}>{card.name}</p>
                      {limit != null && (
                        <p className="text-xs" style={{ color: 'var(--ink-faint)' }}>Limit ₹{limit.toLocaleString('en-IN')}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingCard(card); setShowForm(true); }}
                      className="p-1.5 rounded-lg cursor-pointer"
                      style={{ color: 'var(--ink-faint)' }}
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(card)}
                      className="p-1.5 rounded-lg cursor-pointer"
                      style={{ color: 'var(--ink-faint)' }}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <p className="text-2xl font-bold mb-1" style={{ color: 'var(--ink)' }}>
                  ₹{card.current_balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs mb-3" style={{ color: 'var(--ink-faint)' }}>Outstanding balance</p>

                {utilizationPct !== null && (
                  <div className="w-full h-1.5 rounded-full mb-4 overflow-hidden" style={{ background: 'var(--hairline)' }} title={`${utilizationPct}% utilized`}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${utilizationPct}%`,
                        background: utilizationPct > 80 ? 'var(--neg)' : utilizationPct > 50 ? 'var(--warn)' : 'var(--pos)',
                      }}
                    />
                  </div>
                )}

                <button
                  onClick={() => { setPayingCard(card); setPayAmount(''); setPayAccountId(''); }}
                  disabled={card.current_balance <= 0}
                  className="w-full py-2 rounded-xl font-bold text-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: 'var(--pos-bg)', color: 'var(--pos)' }}
                >
                  Pay towards this card
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <CreditCardForm
          card={editingCard}
          onCancel={() => { setShowForm(false); setEditingCard(null); }}
          onSaved={() => { setShowForm(false); setEditingCard(null); onChange(); }}
        />
      )}

      {payingCard && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !submitting && setPayingCard(null)} />
          <div className="relative z-10 w-full max-w-sm pane-strong p-6 shadow-2xl border border-[var(--hairline)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>Pay {payingCard.name}</h3>
              <button onClick={() => !submitting && setPayingCard(null)} className="cursor-pointer" style={{ color: 'var(--ink-faint)' }}>
                <X size={18} />
              </button>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--ink-muted)' }}>
              Outstanding: ₹{payingCard.current_balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}. This records a bank expense and reduces the card balance.
            </p>
            <div className="relative mb-4">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--ink-faint)' }} />
              <input
                type="number"
                min="0"
                step="0.01"
                autoFocus
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Amount to pay"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
              />
            </div>
            {bankAccounts.length > 0 && (
              <select
                value={payAccountId}
                onChange={(e) => setPayAccountId(e.target.value)}
                required
                className="w-full mb-4 px-4 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
              >
                <option value="">Paying from which account?</option>
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setPayAmount(String(payingCard.current_balance))}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm cursor-pointer"
                style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink-soft)' }}
              >
                Pay in full
              </button>
              <button
                onClick={handlePay}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                {submitting ? 'Paying…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface FormProps {
  card?: CreditCardData | null;
  onCancel: () => void;
  onSaved: () => void;
}

function CreditCardForm({ card, onCancel, onSaved }: FormProps) {
  const [name, setName] = useState(card?.name ?? '');
  const [creditLimit, setCreditLimit] = useState(card?.credit_limit?.toString() ?? '');
  const [currentBalance, setCurrentBalance] = useState(card?.current_balance?.toString() ?? '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Card name is required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        credit_limit: creditLimit ? parseFloat(creditLimit) : null,
        current_balance: currentBalance ? parseFloat(currentBalance) : 0,
      };
      const res = card
        ? await fetch(`/api/credit-cards/${card.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/credit-cards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.formErrors?.[0] || err.error || 'Failed to save card');
      }
      onSaved();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save card');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !submitting && onCancel()} />
      <div className="relative z-10 w-full max-w-sm pane-strong p-6 shadow-2xl border border-[var(--hairline)]">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{card ? 'Edit Card' : 'Add Credit Card'}</h3>
          <button onClick={() => !submitting && onCancel()} className="cursor-pointer" style={{ color: 'var(--ink-faint)' }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>Card Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Kotak, ICICI RuPay"
              autoFocus
              required
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>Credit Limit (opt)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="₹"
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg-tint)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-faint)' }}>Current Balance</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={currentBalance}
                onChange={(e) => setCurrentBalance(e.target.value)}
                placeholder="₹"
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

export default CreditCards;
