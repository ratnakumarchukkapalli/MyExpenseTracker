'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Check } from 'lucide-react';

interface SubscriptionData {
  id?: number;
  name?: string;
  billing_type?: string;
  amount?: number;
  renewal_date?: string;
  comments?: string;
  status?: string;
  category?: string;
  bank_account_id?: number | null;
}

interface BankAccountOption {
  id: number;
  name: string;
}

interface Props {
  subscription?: SubscriptionData | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  bankAccounts?: BankAccountOption[];
}

const CATEGORIES = ['Entertainment', 'Utilities', 'Software', 'Health', 'Finance', 'Shopping', 'Other'];

function SubscriptionForm({ subscription, onSubmit, onCancel, bankAccounts = [] }: Props) {
  const [formData, setFormData] = useState({
    name: '',
    billing_type: 'yearly',
    amount: '',
    renewal_date: '',
    comments: '',
    status: 'active',
    category: 'Other',
    bank_account_id: '' as string,
  });

  useEffect(() => {
    if (subscription) {
      setFormData({
        name: subscription.name || '',
        billing_type: subscription.billing_type || 'yearly',
        amount: subscription.amount?.toString() || '',
        renewal_date: subscription.renewal_date ? subscription.renewal_date.split('T')[0] : '',
        comments: subscription.comments || '',
        status: subscription.status || 'active',
        category: subscription.category || 'Other',
        bank_account_id: subscription.bank_account_id ? String(subscription.bank_account_id) : '',
      });
    }
  }, [subscription]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.amount) {
      alert('Please fill in all required fields');
      return;
    }
    const amount = parseFloat(formData.amount);
    const yearly_cost = formData.billing_type === 'monthly' ? amount * 12 : amount;
    onSubmit({
      ...formData,
      amount,
      yearly_cost,
      bank_account_id: formData.bank_account_id ? Number(formData.bank_account_id) : null,
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-md transition-opacity"
        onClick={onCancel}
      />

      {/* Light Glass Modal */}
      <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-2xl border border-white/20 rounded-[24px] shadow-[0_32px_80px_rgba(0,0,0,0.12)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.12em] mb-1">
              {subscription ? 'Edit record' : 'Quick add'}
            </div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              {subscription ? 'Update Subscription' : 'New Subscription'}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Service Name */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Service Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Netflix, Spotify, AWS"
              required
              autoFocus
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm"
            />
          </div>

          {/* Amount + Billing Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">₹</span>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                  className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Billing Type</label>
              <select
                name="billing_type"
                value={formData.billing_type}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          {/* Renewal Date + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Next Renewal</label>
              <input
                type="date"
                name="renewal_date"
                value={formData.renewal_date}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const active = formData.category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, category: cat }))}
                    className={`
                      px-3 py-1.5 rounded-full text-[11px] font-bold border-2 transition-all flex items-center gap-1.5 cursor-pointer
                      ${active 
                        ? 'border-transparent text-white shadow-sm bg-blue-500' 
                        : 'border-gray-100 text-gray-400 hover:border-gray-200 bg-gray-50'}
                    `}
                  >
                    {active && <Check size={12} />}
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Default bank account */}
          {bankAccounts.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Paid From (default account)</label>
              <select
                name="bank_account_id"
                value={formData.bank_account_id}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm"
              >
                <option value="">No default (won&apos;t debit a specific account)</option>
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Comments</label>
            <textarea
              name="comments"
              value={formData.comments}
              onChange={handleChange}
              placeholder="Any details…"
              rows={2}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3.5 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save size={18} />
              {subscription ? 'Update Subs' : 'Save Subs'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SubscriptionForm;
