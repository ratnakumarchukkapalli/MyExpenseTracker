'use client';

import React from 'react';
import { LogOut, X, AlertTriangle } from 'lucide-react';

interface LogoutConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({ onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop with enhanced blur */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
        onClick={onCancel}
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-sm bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl border border-white/20 dark:border-gray-800 rounded-[28px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header/Icon Area */}
        <div className="flex flex-col items-center pt-8 pb-4">
          <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-4 ring-8 ring-red-50/50 dark:ring-red-500/5">
            <LogOut className="text-red-500" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Sign Out
          </h2>
          <p className="mt-2 text-center px-8 text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
            Are you sure you want to sign out? You'll need to sign back in to access your financial data.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="p-6 pt-2 flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            Sign Out
          </button>
          <button
            onClick={onCancel}
            className="w-full py-4 rounded-2xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-sm transition-all cursor-pointer"
          >
            Stay Logged In
          </button>
        </div>

        {/* Close Button (Optional but nice) */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default LogoutConfirmModal;
