"use client";

export type Currency = "USD" | "INR" | "AED" | "EUR" | "GBP";
export const CURRENCIES: Currency[] = ["USD", "INR", "AED", "EUR", "GBP"];

/**
 * Last-resort fallback values used only when every live source fails. These
 * are intentionally rough — the UI always shows the rate that's actually in
 * use and lets the user override it.
 */
const FALLBACK_RATES: Record<Currency, number> = {
  USD: 1,
  INR: 94.5,
  AED: 3.67,
  EUR: 0.92,
  GBP: 0.78,
};

const CACHE_KEY = "dcalc:fxRates:v2";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface RateBundle {
  rates: Record<Currency, number>;
  /** Short id e.g. API hostname */
  source: string;
  /** Full URL of the endpoint used (for display / link). */
  sourceUrl?: string;
  fetchedAt: number;
}

interface SourceDef {
  name: string;
  url: string;
  pick: (d: unknown) => Record<string, number> | null;
}

/**
 * Try several free public FX endpoints in order. The first one that responds
 * with a usable INR/USD rate wins. We try open.er-api.com first because it
 * tracks the interbank rate Indian traders are most familiar with on
 * Moneycontrol/Google. Frankfurter (ECB) is the last resort because its
 * USD/INR is often stale by 2-3 INR vs. spot.
 */
const SOURCES: SourceDef[] = [
  {
    name: "open.er-api.com",
    url: "https://open.er-api.com/v6/latest/USD",
    pick: (d) => {
      const v = d as { rates?: Record<string, number> };
      return v?.rates ?? null;
    },
  },
  {
    name: "exchangerate.host",
    url: "https://api.exchangerate.host/latest?base=USD",
    pick: (d) => {
      const v = d as { rates?: Record<string, number> };
      return v?.rates ?? null;
    },
  },
  {
    name: "frankfurter.app",
    url: "https://api.frankfurter.app/latest?from=USD&to=INR,AED,EUR,GBP",
    pick: (d) => {
      const v = d as { rates?: Record<string, number> };
      return v?.rates ?? null;
    },
  },
];

function readCache(): RateBundle | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const b = JSON.parse(raw) as RateBundle;
    if (Date.now() - b.fetchedAt > CACHE_TTL_MS) return null;
    return b;
  } catch {
    return null;
  }
}

function writeCache(b: RateBundle) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(b));
  } catch {}
}

export async function fetchRates(force = false): Promise<RateBundle> {
  if (!force) {
    const cached = readCache();
    if (cached) return cached;
  }
  for (const src of SOURCES) {
    try {
      const res = await fetch(src.url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      const all = src.pick(data);
      if (!all) continue;
      const rates: Record<Currency, number> = {
        USD: 1,
        INR: all.INR ?? FALLBACK_RATES.INR,
        AED: all.AED ?? FALLBACK_RATES.AED,
        EUR: all.EUR ?? FALLBACK_RATES.EUR,
        GBP: all.GBP ?? FALLBACK_RATES.GBP,
      };
      // Sanity check: if INR is wildly off (e.g. < 60 or > 130), skip.
      if (rates.INR < 60 || rates.INR > 130) continue;
      const bundle: RateBundle = {
        rates,
        source: src.name,
        sourceUrl: src.url,
        fetchedAt: Date.now(),
      };
      writeCache(bundle);
      return bundle;
    } catch {
      // try next source
    }
  }
  return {
    rates: FALLBACK_RATES,
    source: "fallback (no live source reachable)",
    fetchedAt: Date.now(),
  };
}

export function convertFromUSD(usd: number, rate: number): number {
  return usd * rate;
}

export function fmtMoney(value: number, currency: Currency): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "INR" ? 2 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}
