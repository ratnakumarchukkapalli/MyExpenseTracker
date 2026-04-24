'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, DollarSign, Calendar, Clock, AlertCircle,
  CheckCircle, Landmark,
} from 'lucide-react';

interface Loan {
  id: number;
  name: string;
  amount: number;
  due_day: number;
  start_date?: string;
  end_date?: string;
  category?: string;
  status: string;
  comments?: string;
}

interface Props {
  onShowForm: () => void;
  onEdit: (loan: Loan) => void;
  refreshKey: number;
  currentMonth: number;
  currentYear: number;
}

function Loans({ onShowForm, onEdit, refreshKey, currentMonth, currentYear }: Props) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadLoans(); }, [refreshKey]);

  const loadLoans = async () => {
    try {
      const res = await fetch('/api/loans');
      const data = await res.json();
      setLoans(data || []);
    } catch (error) {
      console.error('Failed to load loans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (window.confirm(`Delete ${name}?`)) {
      try {
        await fetch(`/api/loans/${id}`, { method: 'DELETE' });
        loadLoans();
      } catch (error) {
        console.error('Failed to delete loan:', error);
      }
    }
  };

  const selectedPeriod = (currentYear || new Date().getFullYear()) * 12 + ((currentMonth || new Date().getMonth() + 1));

  const visibleLoans = useMemo(() => loans.filter(l => {
    if (l.status !== 'active') return false;
    if (!l.end_date) return true;
    const end = new Date(l.end_date);
    const endPeriod = end.getFullYear() * 12 + (end.getMonth() + 1);
    return endPeriod >= selectedPeriod;
  }), [loans, selectedPeriod]);

  const activeLoans = useMemo(() => loans.filter(l => l.status === 'active'), [loans]);
  const totalMonthlyEMI = useMemo(() => visibleLoans.reduce((sum, l) => sum + (l.amount || 0), 0), [visibleLoans]);
  const totalYearlyEMI = totalMonthlyEMI * 12;

  const getMonthsRemaining = (endDate?: string) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const endPeriod = end.getFullYear() * 12 + (end.getMonth() + 1);
    return Math.max(0, endPeriod - selectedPeriod);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-gray-200 dark:bg-surface-800 rounded-lg" />
            <div className="h-4 w-64 bg-gray-100 dark:bg-surface-800 rounded-lg" />
          </div>
          <div className="h-10 w-32 bg-gray-100 dark:bg-surface-800 rounded-xl" />
        </div>

        {/* Summary Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-100 dark:bg-surface-800 rounded-lg" />
                <div className="h-4 w-20 bg-gray-100 dark:bg-surface-800 rounded" />
              </div>
              <div className="h-8 w-32 bg-gray-200 dark:bg-surface-800 rounded-lg" />
            </div>
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="bg-white dark:bg-surface-900 border border-gray-100 dark:border-surface-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-surface-800 bg-gray-50/50 dark:bg-surface-800/30">
            <div className="grid grid-cols-7 gap-4">
              {[1, 2, 3, 4, 5, 6, 7].map(i => (
                <div key={i} className="h-3 bg-gray-200 dark:bg-surface-800 rounded w-16" />
              ))}
            </div>
          </div>
          <div className="p-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="grid grid-cols-7 gap-4 items-center">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-gray-100 dark:bg-surface-800 rounded-xl" />
                  <div className="space-y-1">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-surface-800 rounded" />
                    <div className="h-3 w-16 bg-gray-100 dark:bg-surface-800 rounded" />
                  </div>
                </div>
                <div className="h-4 bg-gray-200 dark:bg-surface-800 rounded w-20 justify-self-end" />
                <div className="h-6 bg-gray-100 dark:bg-surface-800 rounded w-16 justify-self-center" />
                <div className="h-4 bg-gray-100 dark:bg-surface-800 rounded w-32 justify-self-center" />
                <div className="h-6 bg-gray-100 dark:bg-surface-800 rounded w-20 justify-self-center" />
                <div className="h-5 bg-gray-100 dark:bg-surface-800 rounded w-16 justify-self-center" />
                <div className="h-8 w-8 bg-gray-100 dark:bg-surface-800 rounded-lg justify-self-end" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Loans & EMIs</h2>
          <p className="text-sm text-gray-500">Track your fixed monthly payments</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onShowForm}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-xl font-medium shadow-lg shadow-primary-600/20 cursor-pointer"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Loan
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-blue-100 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg"><DollarSign className="h-5 w-5 text-blue-600" /></div>
            <p className="text-sm font-medium text-blue-900">Monthly EMI</p>
          </div>
          <p className="text-2xl font-bold text-blue-900">₹{totalMonthlyEMI.toLocaleString()}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-white rounded-2xl border border-purple-100 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg"><Calendar className="h-5 w-5 text-purple-600" /></div>
            <p className="text-sm font-medium text-purple-900">Yearly EMI</p>
          </div>
          <p className="text-2xl font-bold text-purple-900">₹{totalYearlyEMI.toLocaleString()}</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-white rounded-2xl border border-green-100 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="h-5 w-5 text-green-600" /></div>
            <p className="text-sm font-medium text-green-900">Active Loans</p>
          </div>
          <p className="text-2xl font-bold text-green-900">{activeLoans.length}</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-white rounded-2xl border border-orange-100 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 rounded-lg"><Clock className="h-5 w-5 text-orange-600" /></div>
            <p className="text-sm font-medium text-orange-900">Total Loans</p>
          </div>
          <p className="text-2xl font-bold text-orange-900">{loans.length}</p>
        </div>
      </div>

      {/* Loans Table */}
      {visibleLoans.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <Landmark className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No loans yet</h3>
          <p className="mt-2 text-gray-500">Add your loans and EMIs to track them automatically.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Loan</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">EMI</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Due Day</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Duration</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Remaining</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleLoans.map((loan) => {
                  const monthsRemaining = getMonthsRemaining(loan.end_date);
                  return (
                    <tr key={loan.id} className="hover:bg-gray-50 group">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                            <Landmark className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{loan.name}</p>
                            <p className="text-xs text-gray-500">{loan.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="font-bold text-gray-900">₹{loan.amount.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg">
                          {loan.due_day}
                          <span className="text-xs text-gray-500 ml-1">of month</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-600">
                        {formatDate(loan.start_date)} - {loan.end_date ? formatDate(loan.end_date) : 'Ongoing'}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {monthsRemaining !== null ? (
                          monthsRemaining === 0 ? (
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-lg bg-amber-100 text-amber-700">
                              Last month
                            </span>
                          ) : (
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-lg ${
                              monthsRemaining <= 3 ? 'bg-green-100 text-green-700' :
                              monthsRemaining <= 12 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {monthsRemaining} months
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          loan.status === 'active' ? 'bg-green-100 text-green-700' :
                          loan.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {loan.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onEdit(loan)}
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(loan.id, loan.name)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">How it works</p>
          <p>Loan expenses are auto-generated monthly. Add a loan and it will appear in your expenses each month until the end date.</p>
        </div>
      </div>
    </div>
  );
}

export default Loans;
