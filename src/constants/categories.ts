import { Home, Landmark, Receipt, User, TrendingUp } from 'lucide-react';

export const EXPENSE_CATEGORIES = ['HOME Purpose', 'LOANS/CC', 'Savings', 'MonthlyBills', 'Personal'] as const;

export type Category = typeof EXPENSE_CATEGORIES[number];

export const CATEGORY_COLORS: Record<string, string> = {
  'HOME Purpose': '#8b5cf6',
  'LOANS/CC': '#ef4444',
  'MonthlyBills': '#f59e0b',
  'Personal': '#3b82f6',
  'Savings': '#10b981',
};

export const CATEGORY_ICONS: Record<string, any> = {
  'HOME Purpose': Home,
  'LOANS/CC': Landmark,
  'MonthlyBills': Receipt,
  'Personal': User,
  'Savings': TrendingUp,
};
