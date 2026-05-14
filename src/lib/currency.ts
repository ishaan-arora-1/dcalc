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

const CACHE_KEY = "dcalc:fxRates:v3";
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes — keep the quote fresh against Moneycontrol-style live spot

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
 * Free public FX endpoints, ordered by how closely they track the live
 * USD/INR spot that traders see on Moneycontrol / Google Finance.
 *
 * - floatrates.com refreshes ~every 6 hours and is closest to spot.
 * - jsdelivr currency-api refreshes once a day but is rock-solid.
 * - open.er-api.com is daily, widely used, good fallback.
 * - frankfurter.app (ECB) can be 1-3 INR off spot — last resort.
 */
const SOURCES: SourceDef[] = [
  {
    name: "floatrates.com",
    url: "https://www.floatrates.com/daily/usd.json",
    pick: (d) => {
      const v = d as Record<string, { code: string; rate: number }>;
      if (!v || typeof v !== "object") return null;
      const out: Record<string, number> = {};
      for (const k of Object.keys(v)) {
        const code = k.toUpperCase();
        const rate = v[k]?.rate;
        if (typeof rate === "number") out[code] = rate;
      }
      return Object.keys(out).length ? out : null;
    },
  },
  {
    name: "currency-api.pages.dev",
    url: "https://latest.currency-api.pages.dev/v1/currencies/usd.json",
    pick: (d) => {
      const v = d as { usd?: Record<string, number> };
      if (!v?.usd) return null;
      const out: Record<string, number> = {};
      for (const [k, val] of Object.entries(v.usd)) {
        out[k.toUpperCase()] = val;
      }
      return out;
    },
  },
  {
    name: "open.er-api.com",
    url: "https://open.er-api.com/v6/latest/USD",
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

/** Human label like "just now", "3 min ago", "1 h ago". */
export function fmtAge(fetchedAt: number, now: number = Date.now()): string {
  const sec = Math.max(0, Math.round((now - fetchedAt) / 1000));
  if (sec < 30) return "just now";
  if (sec < 90) return "1 min ago";
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 7200) return "1 h ago";
  if (sec < 86400) return `${Math.round(sec / 3600)} h ago`;
  return `${Math.round(sec / 86400)} d ago`;
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
