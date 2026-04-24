'use client';

import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Receipt, 
  Plus, 
  TrendingUp, 
  BarChart2, 
  MoreHorizontal,
  X,
  Calendar,
  Landmark,
  Shield,
  FileText
} from 'lucide-react';

interface MobileNavProps {
  currentView: string;
  onViewChange: (view: any) => void;
  onQuickAdd: () => void;
}

const MobileNav: React.FC<MobileNavProps> = ({ currentView, onViewChange, onQuickAdd }) => {
  const [showMore, setShowMore] = useState(false);

  const mainItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'expenses', label: 'Expenses', icon: Receipt },
    { id: 'sip', label: 'SIP', icon: TrendingUp },
    { id: 'stocks', label: 'Stocks', icon: BarChart2 },
  ];

  const moreItems = [
    { id: 'subscriptions', label: 'Subscriptions', icon: Calendar },
    { id: 'loans', label: 'Loans & EMIs', icon: Landmark },
    { id: 'insurance', label: 'Insurance', icon: Shield },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'projection', label: 'Projection', icon: TrendingUp },
  ];

  return (
    <>
      {/* Floating Action Button */}
      <button 
        className="glass-fab md:hidden" 
        onClick={onQuickAdd}
        aria-label="Add expense"
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      {/* Bottom Tab Bar */}
      <nav className="glass-tab-bar md:hidden">
        {mainItems.map((item) => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}
            >
              <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-bold">{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setShowMore(true)}
          className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${showMore ? 'text-indigo-600' : 'text-gray-400'}`}
        >
          <MoreHorizontal size={20} />
          <span className="text-[10px] font-bold">More</span>
        </button>
      </nav>

      {/* More Menu Drawer */}
      {showMore && (
        <div className="fixed inset-0 z-[600] md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setShowMore(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-[32px] p-6 pb-[calc(24px+env(safe-area-inset-bottom,0))] animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">All Features</h3>
              <button onClick={() => setShowMore(false)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {moreItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onViewChange(item.id);
                    setShowMore(false);
                  }}
                  className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 active:bg-gray-100 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-700 flex items-center justify-center text-indigo-600 shadow-sm">
                    <item.icon size={20} />
                  </div>
                  <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 text-center">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileNav;
