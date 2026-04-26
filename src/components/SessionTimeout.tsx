'use client';

import React, { useEffect, useState, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface SessionTimeoutProps {
  onLogout: () => Promise<void>;
}

const TIMEOUT_DURATION = 60 * 60 * 1000; // 1 hour in ms
const WARNING_DURATION = 60 * 1000; // 60 seconds in ms

export default function SessionTimeout({ onLogout }: SessionTimeoutProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const logoutTriggered = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const getLastActive = () => {
      const val = localStorage.getItem('session_last_active');
      return val ? parseInt(val, 10) : Date.now();
    };

    const setLastActive = () => {
      // Throttle to avoid spamming localStorage
      const now = Date.now();
      const last = getLastActive();
      if (now - last > 5000) {
        localStorage.setItem('session_last_active', now.toString());
      }
    };

    // Initial set if not present
    if (!localStorage.getItem('session_last_active')) {
      localStorage.setItem('session_last_active', Date.now().toString());
    }

    const checkSession = async () => {
      if (logoutTriggered.current) return;

      const lastActive = getLastActive();
      const now = Date.now();
      const timeSinceLastActive = now - lastActive;

      if (timeSinceLastActive >= TIMEOUT_DURATION) {
        logoutTriggered.current = true;
        await onLogout();
      } else if (timeSinceLastActive >= TIMEOUT_DURATION - WARNING_DURATION) {
        setShowWarning(true);
        const remainingMs = TIMEOUT_DURATION - timeSinceLastActive;
        setCountdown(Math.max(0, Math.ceil(remainingMs / 1000)));
      } else {
        setShowWarning(false);
      }
    };

    // Listen for user activity
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => {
      setLastActive();
      if (showWarning) {
        setShowWarning(false);
      }
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // Listen for storage changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'session_last_active') {
        checkSession();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Listen for tab visibility changes (e.g. computer woke up)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Periodic check
    const interval = setInterval(checkSession, 1000);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [showWarning, onLogout]);

  const handleStayLoggedIn = () => {
    localStorage.setItem('session_last_active', Date.now().toString());
    setShowWarning(false);
  };

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md pane-strong p-6 shadow-2xl border border-[var(--hairline)]">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent-bg)] flex items-center justify-center text-[var(--accent)] mx-auto mb-4">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-lg font-bold text-[var(--ink)] mb-2">Session Expiring</h3>
          <p className="text-sm text-[var(--ink-muted)] mb-6">
            You have been inactive for a while. You will be automatically logged out in{' '}
            <span className="font-mono font-bold text-[var(--accent)]">{countdown}</span> seconds.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              logoutTriggered.current = true;
              void onLogout();
            }}
            className="flex-1 btn cursor-pointer justify-center"
          >
            Log out
          </button>
          <button
            onClick={handleStayLoggedIn}
            className="flex-1 btn btn-accent cursor-pointer justify-center"
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}
