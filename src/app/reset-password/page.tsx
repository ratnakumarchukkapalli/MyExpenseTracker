"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowRight, Info, Lock } from "lucide-react";
import Image from "next/image";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem('darkMode') === 'true') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    }
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createSupabaseBrowserClient();

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Password updated successfully! Redirecting to login...");
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-white font-sans selection:bg-blue-100">
      {/* Left side: Premium Illustration */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#F9FAFB] items-center justify-center p-12 border-r border-gray-100">
        <div className="absolute inset-0 opacity-40">
          <Image 
            src="/login-bg.png" 
            alt="Wealth Illustration" 
            fill 
            className="object-cover"
            priority
          />
        </div>
        
        <div className="relative z-10 max-w-lg">
          <div className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)]">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white mb-8 shadow-lg shadow-blue-600/20">
              <Lock size={28} />
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight leading-tight">
              Secure your <span className="text-blue-600">Account</span>.
            </h2>
            <p className="text-gray-500 text-lg leading-relaxed mb-10">
              Set a strong password to protect your financial data and personal information.
            </p>
          </div>
        </div>
      </div>

      {/* Right side: Reset Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl">
              M
            </div>
            <h1 className="text-xl font-bold text-gray-900 leading-none">MET</h1>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              New Password
            </h2>
            <p className="text-gray-500">
              Please enter your new password below.
            </p>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm"
              />
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 rounded-2xl text-sm bg-red-50 text-red-700 border border-red-100">
                <Info size={18} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div className="flex items-start gap-3 p-4 rounded-2xl text-sm bg-green-50 text-green-700 border border-green-100">
                <ShieldCheck size={18} className="mt-0.5 flex-shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full group flex items-center justify-center gap-2 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-lg shadow-blue-600/10 active:scale-[0.98]"
            >
              {loading ? "Updating..." : "Update Password"}
              {!loading && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-gray-100 text-center">
            <p className="text-gray-500 text-sm font-medium">
              Remembered your password?{" "}
              <button
                onClick={() => router.push("/login")}
                className="text-blue-600 font-bold hover:text-blue-700 transition-colors"
              >
                Back to Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
