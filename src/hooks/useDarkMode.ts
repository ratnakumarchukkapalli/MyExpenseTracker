'use client';

import { useState, useEffect } from 'react';

function readDark() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('darkMode') === 'true';
}

export function useDarkMode() {
  const [isDark, setIsDark] = useState(readDark);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'darkMode') setIsDark(e.newValue === 'true');
    };
    // Also watch for in-tab changes via MutationObserver on html[data-theme]
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      observer.disconnect();
    };
  }, []);

  const chartColors = {
    axisText:      isDark ? '#8B869A' : '#6B6875',
    grid:          isDark ? 'rgba(255,255,255,0.08)' : 'rgba(30,20,60,0.08)',
    pos:           isDark ? '#56B487' : '#1F8A5B',
    neg:           isDark ? '#E07974' : '#C2423C',
    accent:        isDark ? '#A39BFF' : '#5A4FCF',
    accentSoft:    isDark ? '#C3BDFF' : '#7D73E6',
    accentFill:    isDark ? 'rgba(163,155,255,0.15)' : 'rgba(90,79,207,0.10)',
    amber:         isDark ? '#E8C25A' : '#B8852B',
    blue:          isDark ? '#60A5FA' : '#3B82F6',
    emerald:       isDark ? '#34D399' : '#10B981',
    red:           isDark ? '#F87171' : '#EF4444',
    gray:          isDark ? '#6B7280' : '#9CA3AF',
    tooltipBg:     isDark ? '#1A1624' : '#FFFFFF',
    tooltipBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(30,20,60,0.08)',
    barInvested:   isDark ? '#6D65A8' : '#C7D2FE',
    barGain:       isDark ? '#4ADE80' : '#86EFAC',
    barLoss:       isDark ? '#F87171' : '#FCA5A5',
  };

  return { isDark, chartColors };
}
