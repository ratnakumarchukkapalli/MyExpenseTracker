'use client';

import React, { useState, useMemo } from 'react';
import {
  Edit2, Trash2, Calendar, Search, Filter, ChevronDown, ChevronRight,
  ArrowUpDown, TrendingUp, TrendingDown, Copy, X, Check,
} from 'lucide-react';
import { EXPENSE_CATEGORIES } from '../constants/categories';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface Expense {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  note?: string;
  is_auto_generated?: number;
}

interface Props {
  expenses: Expense[];
  onEdit: (expense: Expense, mode?: 'open-form' | 'save-inline') => void;
  onDelete: (id: number) => void;
  onAdd?: (expense: Partial<Expense>) => void;
  categoryIcons?: Record<string, React.ComponentType<any>>;
}

function ExpenseList({ expenses, onEdit, onDelete, onAdd, categoryIcons = {} }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [editingCell, setEditingCell] = useState<{ id: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const categories = EXPENSE_CATEGORIES;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'HOME Purpose': 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20',
      'LOANS/CC': 'bg-red-50 text-red-700 ring-1 ring-red-600/20',
      'Savings': 'bg-green-50 text-green-700 ring-1 ring-green-600/20',
      'MonthlyBills': 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-600/20',
      'Personal': 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/20',
    };
    return colors[category] || 'bg-gray-50 text-gray-700 ring-1 ring-gray-600/20';
  };

  const getAmountColor = (amount: number) => {
    if (amount < 500) return 'text-green-600';
    if (amount < 2000) return 'text-amber-600';
    return 'text-red-600';
  };

  const filteredExpenses = useMemo(() => {
    let result = [...expenses];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(exp =>
        exp.description.toLowerCase().includes(query) ||
        exp.category.toLowerCase().includes(query)
      );
    }
    if (categoryFilter !== 'all') {
      result = result.filter(exp => exp.category === categoryFilter);
    }
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc': return new Date(b.date).getTime() - new Date(a.date).getTime() || b.id - a.id;
        case 'date-asc': return new Date(a.date).getTime() - new Date(b.date).getTime() || a.id - b.id;
        case 'amount-desc': return b.amount - a.amount;
        case 'amount-asc': return a.amount - b.amount;
        default: return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
    });
    return result;
  }, [expenses, searchQuery, categoryFilter, sortBy]);

  const groupedExpenses = useMemo(() => {
    const groups: Record<string, { date: string; displayDate: string; expenses: Expense[]; total: number }> = {};
    filteredExpenses.forEach(expense => {
      const dateKey = expense.date.split('T')[0];
      if (!groups[dateKey]) {
        groups[dateKey] = { date: dateKey, displayDate: formatDate(expense.date), expenses: [], total: 0 };
      }
      groups[dateKey].expenses.push(expense);
      groups[dateKey].total += expense.amount;
    });
    return Object.values(groups).sort((a, b) =>
      sortBy.includes('asc')
        ? new Date(a.date).getTime() - new Date(b.date).getTime()
        : new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [filteredExpenses, sortBy]);

  const analytics = useMemo(() => {
    const last7Days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const dayExpenses = expenses.filter(e => e.date.split('T')[0] === dateKey);
      const dayTotal = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
      last7Days.push({ day: i === 0 ? 'Today' : i === 1 ? 'Yest' : date.getDate(), amount: dayTotal });
    }
    const todayTotal = last7Days[6].amount;
    const avgDaily = last7Days.slice(0, 6).reduce((sum, d) => sum + d.amount, 0) / 6 || 0;
    const difference = todayTotal - avgDaily;

    const categoryTotals: Record<string, number> = {};
    filteredExpenses.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });
    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, total]) => ({ category, total }));

    return { last7Days, todayTotal, avgDaily, difference, topCategories };
  }, [expenses, filteredExpenses]);

  const toggleDateGroup = (dateKey: string) => {
    setCollapsedDates(prev => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  const startEditing = (expenseId: number, field: string, currentValue: string | number) => {
    setEditingCell({ id: expenseId, field });
    setEditValue(currentValue.toString());
  };

  const saveEdit = (expense: Expense) => {
    if (editingCell) {
      const updated = { ...expense };
      if (editingCell.field === 'amount') {
        updated.amount = parseFloat(editValue) || expense.amount;
      } else if (editingCell.field === 'description') {
        updated.description = editValue || expense.description;
      }
      onEdit(updated, 'save-inline');
      setEditingCell(null);
      setEditValue('');
    }
  };

  const cancelEdit = () => { setEditingCell(null); setEditValue(''); };

  const duplicateExpense = (expense: Expense) => {
    if (onAdd) {
      onAdd({ ...expense, id: undefined, date: new Date().toISOString().split('T')[0] });
    }
  };

  if (expenses.length === 0) {
    return (
      <div className="pane p-12 text-center" style={{ background: 'var(--pane)', borderColor: 'var(--hairline)' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--bg-tint)' }}>
          <Calendar className="h-8 w-8" style={{ color: 'var(--ink-faint)' }} />
        </div>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--ink)' }}>No expenses found</h3>
        <p className="mt-2 max-w-sm mx-auto" style={{ color: 'var(--ink-muted)' }}>
          Get started by adding your first expense to track your spending.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--pane)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid var(--hairline)', borderRadius: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
          {filteredExpenses.length} of {expenses.length}
        </span>

        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--ink-faint)' }} />
          <input
            type="text"
            placeholder="Search expenses…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: 32, paddingRight: searchQuery ? 32 : 12, paddingTop: 7, paddingBottom: 7, background: 'var(--surface-solid)', border: '1px solid var(--hairline)', borderRadius: 10, fontSize: 13, color: 'var(--ink)', outline: 'none', fontFamily: 'inherit' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 0, display: 'flex' }}>
              <X size={13} />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="btn btn-sm cursor-pointer"
          style={categoryFilter !== 'all' ? { background: 'var(--accent-bg)', color: 'var(--accent)', borderColor: 'transparent' } : {}}
        >
          <Filter size={13} />
          Filter
          {categoryFilter !== 'all' && <span style={{ background: 'var(--accent)', color: '#fff', fontSize: 10, padding: '0 5px', borderRadius: 999 }}>1</span>}
        </button>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="btn btn-sm"
          style={{ cursor: 'pointer', appearance: 'none', paddingRight: 10 }}
        >
          <option value="date-desc">Newest</option>
          <option value="date-asc">Oldest</option>
          <option value="amount-desc">Highest</option>
          <option value="amount-asc">Lowest</option>
        </select>
      </div>

      {showFilters && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 14px', background: 'var(--accent-bg)', borderRadius: 12, border: '1px solid var(--hairline)' }}>
          <button onClick={() => setCategoryFilter('all')} className="btn btn-sm" style={categoryFilter === 'all' ? { background: 'var(--ink)', color: 'var(--bg)' } : {}}>All</button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)} className="btn btn-sm" style={categoryFilter === cat ? { background: 'var(--ink)', color: 'var(--bg)' } : {}}>{cat}</button>
          ))}
        </div>
      )}

      {/* Analytics Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 16px', background: 'var(--pane)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid var(--hairline)', borderRadius: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 80, height: 32 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.last7Days}>
                <defs>
                  <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="amount" stroke="var(--accent)" strokeWidth={1.5} fill="url(#sparklineGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <span style={{ fontSize: 11, color: 'var(--ink-faint)', whiteSpace: 'nowrap' }}>
            7d · ₹{analytics.last7Days.reduce((s, d) => s + d.amount, 0).toLocaleString('en-IN')}
          </span>
        </div>

        <div style={{ width: 1, height: 18, background: 'var(--hairline)', flexShrink: 0 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Today</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>₹{analytics.todayTotal.toLocaleString('en-IN')}</span>
          {analytics.difference !== 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 999, background: analytics.difference > 0 ? 'var(--neg-bg)' : 'var(--pos-bg)', color: analytics.difference > 0 ? 'var(--neg)' : 'var(--pos)' }}>
              {analytics.difference > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              ₹{Math.abs(Math.round(analytics.difference)).toLocaleString('en-IN')} {analytics.difference > 0 ? 'above' : 'below'} avg
            </span>
          )}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, color: 'var(--ink-faint)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Top</span>
          {analytics.topCategories.map((cat, i) => {
            const dots = ['var(--accent)', '#a855f7', '#ec4899'];
            return (
              <div key={cat.category} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: dots[i], flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--ink-muted)' }}>{cat.category.split(' ')[0]}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>₹{(cat.total / 1000).toFixed(1)}k</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grouped Expenses */}
      <div className="space-y-3">
        {groupedExpenses.map(group => (
          <div key={group.date} className="rounded-2xl overflow-hidden" style={{ background: 'var(--pane)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow-sm)' }}>
            <button
              onClick={() => toggleDateGroup(group.date)}
              className="w-full flex items-center justify-between px-5 py-3 transition-colors cursor-pointer"
              style={{ background: 'color-mix(in srgb, var(--bg-tint) 40%, transparent)' }}
            >
              <div className="flex items-center gap-3">
                {collapsedDates[group.date] ? (
                  <ChevronRight className="h-4 w-4" style={{ color: 'var(--ink-faint)' }} />
                ) : (
                  <ChevronDown className="h-4 w-4" style={{ color: 'var(--ink-faint)' }} />
                )}
                <span className="font-semibold" style={{ color: 'var(--ink)' }}>{group.displayDate}</span>
                <span className="text-sm" style={{ color: 'var(--ink-muted)' }}>
                  {group.expenses.length} expense{group.expenses.length !== 1 ? 's' : ''}
                </span>
              </div>
              <span className="font-bold" style={{ color: 'var(--ink)' }}>₹{group.total.toLocaleString('en-IN')}</span>
            </button>

            {!collapsedDates[group.date] && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {group.expenses.map((expense, idx) => {
                  const Icon = categoryIcons[expense.category];
                  const isEditingDesc = editingCell?.id === expense.id && editingCell?.field === 'description';
                  const isEditingAmount = editingCell?.id === expense.id && editingCell?.field === 'amount';

                  return (
                    <div 
                      key={expense.id} 
                      className="flex items-center px-5 py-3 transition-colors group"
                      style={{ 
                        borderTop: idx === 0 ? 'none' : '1px solid var(--hairline)',
                        background: 'transparent'
                      }}
                    >
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center mr-4 ${getCategoryColor(expense.category).split(' ')[0]}`}>
                        {Icon ? <Icon className="h-4 w-4 opacity-70" /> : <div className="h-2 w-2 rounded-full bg-current" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        {isEditingDesc ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit(expense);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              className="flex-1 px-2 py-1 border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-sm"
                              autoFocus
                            />
                            <button onClick={() => saveEdit(expense)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                              <Check className="h-4 w-4" />
                            </button>
                            <button onClick={cancelEdit} className="p-1 text-red-600 hover:bg-red-50 rounded">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p
                              className="text-sm font-medium truncate cursor-pointer hover:text-primary-600"
                              style={{ color: 'var(--ink)' }}
                              onClick={() => startEditing(expense.id, 'description', expense.description)}
                              title="Click to edit"
                            >
                              {expense.description}
                            </p>
                            {expense.is_auto_generated === 1 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-700 rounded">
                                Auto
                              </span>
                            )}
                          </div>
                        )}
                        <span className={`inline-flex mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryColor(expense.category)}`}>
                          {expense.category}
                        </span>
                        {expense.note && (
                          <p className="mt-0.5 text-xs italic truncate" style={{ color: 'var(--ink-faint)' }} title={expense.note}>
                            {expense.note}
                          </p>
                        )}
                      </div>

                      <div className="w-28 text-right mr-4">
                        {isEditingAmount ? (
                          <div className="flex items-center gap-1 justify-end">
                            <span className="text-gray-500">₹</span>
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit(expense);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              className="w-20 px-2 py-1 border border-primary-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-sm text-right"
                              autoFocus
                            />
                            <button onClick={() => saveEdit(expense)} className="p-1 hover:bg-green-50 rounded" style={{ color: 'var(--pos)' }}>
                              <Check className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <p
                            className={`text-sm font-bold cursor-pointer hover:opacity-70 ${getAmountColor(expense.amount)}`}
                            onClick={() => startEditing(expense.id, 'amount', expense.amount)}
                            title="Click to edit"
                          >
                            ₹{expense.amount.toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => duplicateExpense(expense)}
                          className="p-1.5 rounded-lg transition-colors cursor-pointer"
                          style={{ color: 'var(--ink-faint)' }}
                          title="Duplicate"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onEdit(expense, 'open-form')}
                          className="p-1.5 rounded-lg transition-colors cursor-pointer"
                          style={{ color: 'var(--ink-faint)' }}
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this expense?')) {
                              onDelete(expense.id);
                            }
                          }}
                          className="p-1.5 rounded-lg transition-colors cursor-pointer"
                          style={{ color: 'var(--ink-faint)' }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Running Total Footer */}
      <div className="sticky bottom-4 rounded-2xl shadow-lg p-4 flex items-center justify-between" style={{ background: 'var(--pane-strong)', backdropFilter: 'blur(12px)', border: '1px solid var(--hairline)' }}>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Total Transactions</p>
            <p className="text-lg font-bold" style={{ color: 'var(--ink)' }}>{filteredExpenses.length}</p>
          </div>
          <div className="h-8 w-px" style={{ background: 'var(--hairline)' }} />
          <div>
            <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Average</p>
            <p className="text-lg font-bold" style={{ color: 'var(--ink)' }}>
              ₹{filteredExpenses.length > 0
                ? Math.round(filteredExpenses.reduce((s, e) => s + e.amount, 0) / filteredExpenses.length).toLocaleString('en-IN')
                : 0}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>Total Amount</p>
          <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
            ₹{filteredExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString('en-IN')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ExpenseList;
