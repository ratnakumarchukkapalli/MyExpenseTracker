'use client';

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface LoanData {
  id?: number;
  name?: string;
  amount?: number;
  due_day?: number;
  start_date?: string;
  end_date?: string;
  category?: string;
  status?: string;
  comments?: string;
  remind_me?: boolean;
  outstanding_balance?: number;
  outstanding_balance_asof?: string;
}

interface Props {
  loan?: LoanData | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

function LoanForm({ loan, onSubmit, onCancel }: Props) {
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    due_day: '1',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    category: 'LOANS/CC',
    status: 'active',
    comments: '',
    remind_me: false,
    outstanding_balance: '',
    outstanding_balance_asof: '',
  });

  const categories = ['LOANS/CC', 'HOME Purpose', 'Personal'];

  useEffect(() => {
    if (loan) {
      setFormData({
        name: loan.name || '',
        amount: loan.amount?.toString() || '',
        due_day: loan.due_day?.toString() || '1',
        start_date: loan.start_date ? loan.start_date.split('T')[0] : '',
        end_date: loan.end_date ? loan.end_date.split('T')[0] : '',
        category: loan.category || 'LOANS/CC',
        status: loan.status || 'active',
        comments: loan.comments || '',
        remind_me: loan.remind_me ?? false,
        outstanding_balance: loan.outstanding_balance?.toString() || '',
        outstanding_balance_asof: loan.outstanding_balance_asof ? loan.outstanding_balance_asof.split('T')[0] : '',
      });
    }
  }, [loan]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.amount || !formData.due_day) {
      alert('Please fill in all required fields');
      return;
    }
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount),
      due_day: parseInt(formData.due_day, 10),
      outstanding_balance: formData.outstanding_balance ? parseFloat(formData.outstanding_balance) : null,
      outstanding_balance_asof: formData.outstanding_balance_asof || null,
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
      return;
    }
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
              {loan ? 'Edit record' : 'Quick add'}
            </div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              {loan ? 'Update Loan/EMI' : 'New Loan/EMI'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Loan Name */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Loan Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Home Loan, Credit Card, Solar"
              required
              autoFocus
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm"
            />
          </div>

          {/* Amount + Due Day */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Monthly EMI (₹) <span className="text-red-500">*</span></label>
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
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Due Day <span className="text-red-500">*</span></label>
              <select
                name="due_day"
                value={formData.due_day}
                onChange={handleChange}
                required
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm cursor-pointer"
              >
                {Array.from({ length: 28 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Outstanding Balance */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Outstanding Balance (opt)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">₹</span>
                <input
                  type="number"
                  name="outstanding_balance"
                  value={formData.outstanding_balance}
                  onChange={handleChange}
                  placeholder="From latest bank statement"
                  min="0"
                  step="0.01"
                  className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Balance As Of</label>
              <input
                type="date"
                name="outstanding_balance_asof"
                value={formData.outstanding_balance_asof}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm cursor-pointer"
              />
            </div>
          </div>

          {/* Start Date + End Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Start Date</label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">End Date (opt)</label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm cursor-pointer"
              />
            </div>
          </div>

          {/* Category Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm cursor-pointer"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm cursor-pointer"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Reminder toggle */}
          <label className="flex items-center gap-3 px-1 cursor-pointer">
            <input
              type="checkbox"
              name="remind_me"
              checked={formData.remind_me}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-sm text-gray-700">Remind me — show due-soon/overdue banner for this EMI</span>
          </label>

          {/* Note */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Comments (optional)</label>
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
              {loan ? 'Update Loan' : 'Save Loan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoanForm;
