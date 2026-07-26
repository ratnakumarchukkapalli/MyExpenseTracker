export interface WealthDelta {
  pct: number;
  abs: number;
}

export function computeDelta(current: number, prev: number | null | undefined): WealthDelta | null {
  if (prev == null || prev <= 0 || current <= 0) return null;
  return { pct: ((current - prev) / prev) * 100, abs: current - prev };
}

export interface WealthDeltasResponse {
  sip: { prevMonth: number | null; prevYear: number | null };
  stocks: { prevMonth: number | null; prevYear: number | null };
}

export async function fetchWealthDeltas(month: number, year: number): Promise<WealthDeltasResponse | null> {
  try {
    const res = await fetch(`/api/wealth/deltas?month=${month}&year=${year}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
