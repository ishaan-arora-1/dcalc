"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface WheelOption {
  value: string;
  label: string;
}

const ITEM_H = 44;
const VISIBLE = 5;
/** Top/bottom padding so first/last items can scroll to the highlight. */
const PAD = (VISIBLE * ITEM_H - ITEM_H) / 2;

/** Scroll viewport height (matches all wheel columns). */
export const WHEEL_VIEWPORT_HEIGHT = VISIBLE * ITEM_H;

interface ScrollWheelColumnAppProps {
  options: WheelOption[];
  value: string;
  onChange: (value: string) => void;
  /** 'discount' = rose text like the reference */
  tone?: "default" | "discount";
  ariaLabel: string;
}

function WheelChrome() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-xl"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,10,10,0.92) 0%, transparent 28%, transparent 72%, rgba(10,10,10,0.92) 100%)",
        }}
      />
      <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-10 -translate-y-1/2 border-y border-white/15" />
    </>
  );
}

/** Native-feeling vertical picker: snap-scroll, center highlight, edge fade. */
export function ScrollWheelColumn({
  options,
  value,
  onChange,
  tone = "default",
  ariaLabel,
}: ScrollWheelColumnAppProps) {
  const ref = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const idxForValue = useCallback(
    (v: string) => {
      const i = options.findIndex((o) => o.value === v);
      return i >= 0 ? i : 0;
    },
    [options],
  );

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = idxForValue(value);
    setActiveIdx(idx);
    const target = idx * ITEM_H;
    if (Math.abs(el.scrollTop - target) < 0.5) return;
    syncing.current = true;
    el.scrollTop = target;
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  }, [value, options, idxForValue]);

  const settleScroll = useCallback(() => {
    const el = ref.current;
    if (!el || syncing.current) return;
    const raw = el.scrollTop;
    let idx = Math.round(raw / ITEM_H);
    idx = Math.max(0, Math.min(idx, options.length - 1));
    const target = idx * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 0.5) {
      el.scrollTo({ top: target, behavior: "auto" });
    }
    setActiveIdx(idx);
    const next = options[idx]?.value;
    if (next != null && next !== value) onChange(next);
  }, [options, value, onChange]);

  const onScroll = () => {
    const el = ref.current;
    if (!el || syncing.current) return;
    const idx = Math.round(el.scrollTop / ITEM_H);
    const c = Math.max(0, Math.min(idx, options.length - 1));
    setActiveIdx(c);
    if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = setTimeout(settleScroll, 120);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onEnd = () => settleScroll();
    el.addEventListener("scrollend", onEnd);
    return () => {
      el.removeEventListener("scrollend", onEnd);
      if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
    };
  }, [settleScroll]);

  const colH = WHEEL_VIEWPORT_HEIGHT;

  return (
    <div
      className="relative flex-1 min-w-0"
      role="group"
      aria-label={ariaLabel}
    >
      <WheelChrome />
      <div
        ref={ref}
        onScroll={onScroll}
        className="overflow-y-auto overflow-x-hidden rounded-xl bg-neutral-900/60 scrollbar-none"
        style={{
          height: colH,
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ paddingTop: PAD, paddingBottom: PAD }}>
          {options.map((opt, i) => {
            const dist = Math.abs(i - activeIdx);
            const faded = dist >= 2;
            const isDiscount = tone === "discount";
            return (
              <div
                key={`${opt.value}-${i}`}
                data-wheel-item
                className="flex items-center justify-center text-center font-semibold tabular-nums tracking-tight"
                style={{
                  height: ITEM_H,
                  scrollSnapAlign: "center",
                  fontSize: isDiscount ? 13 : 14,
                  color: isDiscount
                    ? faded
                      ? "rgba(251, 113, 133, 0.35)"
                      : "#fda4af"
                    : faded
                      ? "rgba(250, 250, 250, 0.28)"
                      : "#fafafa",
                }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** % off/on list — half-point steps, trade-friendly range. */
export function buildDiscountWheelOptions(): WheelOption[] {
  const out: WheelOption[] = [];
  for (let n = -100; n <= 20; n += 0.5) {
    const label = `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
    out.push({ value: n.toFixed(1), label });
  }
  return out;
}

export const PCT_MIN = -100;
export const PCT_MAX = 20;

/** Clamp and format a typed carat weight; returns fallback if invalid. */
export function normalizeCaratInput(raw: string, fallback = ""): string {
  const cleaned = raw.replace(/\s*ct\.?/gi, "").trim();
  if (!cleaned) return fallback;
  const t = parseFloat(cleaned);
  if (!Number.isFinite(t) || t <= 0) return fallback;
  const rounded = Math.round(t * 1000) / 1000;
  return String(rounded);
}

/** Clamp and format a typed discount; returns fallback if not a number. */
export function normalizePctInput(
  raw: string,
  fallback = "-30.0",
): string {
  const cleaned = raw.replace(/%/g, "").trim();
  if (!cleaned || cleaned === "+" || cleaned === "-") return fallback;
  const t = parseFloat(cleaned);
  if (!Number.isFinite(t)) return fallback;
  const clamped = Math.max(PCT_MIN, Math.min(PCT_MAX, t));
  const rounded = Math.round(clamped * 10) / 10;
  return rounded.toFixed(1);
}

/** Snap an arbitrary pct string to the nearest wheel step (for legacy state). */
export function nearestWheelPct(pctStr: string, options: WheelOption[]): string {
  const t = parseFloat(pctStr);
  if (!Number.isFinite(t)) {
    return options[Math.floor(options.length / 2)]?.value ?? "-30.0";
  }
  let best = options[0]?.value ?? "-30.0";
  let bestD = Infinity;
  for (const o of options) {
    const d = Math.abs(parseFloat(o.value) - t);
    if (d < bestD) {
      bestD = d;
      best = o.value;
    }
  }
  return best;
}

/**
 * Plain carat field — same column width/height as wheels, no picker chrome.
 */
export function CaratWheelSlot({
  value,
  onChange,
  ariaLabel = "Carat weight",
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      className="flex flex-1 min-w-0 flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-neutral-900/30 px-1"
      style={{ height: WHEEL_VIEWPORT_HEIGHT, minHeight: WHEEL_VIEWPORT_HEIGHT }}
      role="group"
      aria-label={ariaLabel}
    >
      <span className="mb-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-neutral-500">
        Ct.
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder=""
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 border-0 border-b border-white/35 bg-transparent pb-1 text-center text-[14px] font-semibold tabular-nums tracking-tight text-neutral-100 placeholder:text-neutral-600 focus:border-sky-400/80 focus:outline-none focus:ring-0"
      />
    </div>
  );
}
