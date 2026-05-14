"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CLARITIES,
  COLORS,
  SHAPE_CODE,
  SHAPES,
  type Clarity,
  type Color,
  type Shape,
} from "@/lib/pricing/brackets";
import { calculate, type CalcOutputs } from "@/lib/pricing/lookup";
import { notesFor } from "@/lib/pricing/notes";
import { useBookStore } from "@/lib/store";
import {
  CURRENCIES,
  convertFromUSD,
  fetchRates,
  fmtAge,
  fmtMoney,
  type Currency,
  type RateBundle,
} from "@/lib/currency";
import { appendHistory } from "@/lib/storage/db";
import {
  ScrollWheelColumn,
  CaratWheelSlot,
  buildDiscountWheelOptions,
  nearestWheelPct,
  type WheelOption,
} from "@/components/ScrollWheelColumn";

export interface CalculatorState {
  shape: Shape;
  carat: string;
  color: Color;
  clarity: Clarity;
  pct: string;
  currency: Currency;
}

const DEFAULT_STATE: CalculatorState = {
  shape: "Round",
  carat: "",
  color: "G",
  clarity: "VS1",
  pct: "-30.0",
  currency: "USD",
};

interface Props {
  initial?: Partial<CalculatorState>;
}

export function CalculatorForm({ initial }: Props) {
  const book = useBookStore((s) => s.book);
  const discOpts = useMemo(() => buildDiscountWheelOptions(), []);
  const [state, setState] = useState<CalculatorState>(() => ({
    ...DEFAULT_STATE,
    ...initial,
    pct: nearestWheelPct(
      (initial?.pct ?? DEFAULT_STATE.pct) as string,
      discOpts,
    ),
  }));
  const [bundle, setBundle] = useState<RateBundle | null>(null);
  const [overrideRate, setOverrideRate] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    void fetchRates().then(setBundle);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const liveRate = bundle?.rates[state.currency] ?? 1;
  const overrideNum = parseFloat(overrideRate);
  const fxRate =
    state.currency === "USD"
      ? 1
      : Number.isFinite(overrideNum) && overrideNum > 0
        ? overrideNum
        : liveRate;

  const carat = parseFloat(state.carat) || 0;
  const pct = parseFloat(state.pct) || 0;
  const qty = 1;

  const shapeOptions: WheelOption[] = useMemo(
    () => SHAPES.map((s) => ({ value: s, label: SHAPE_CODE[s] })),
    [],
  );
  const colorOptions: WheelOption[] = useMemo(
    () => COLORS.map((c) => ({ value: c, label: c })),
    [],
  );
  const clarityOptions: WheelOption[] = useMemo(
    () => CLARITIES.map((c) => ({ value: c, label: c })),
    [],
  );

  const result = useMemo(() => {
    if (!book) return null;
    return calculate(book, {
      shape: state.shape,
      carat,
      color: state.color,
      clarity: state.clarity,
      pct,
      quantity: qty,
    });
  }, [book, state.shape, state.color, state.clarity, carat, pct, qty]);

  const tradeNotes = useMemo(() => notesFor(carat), [carat]);

  function set<K extends keyof CalculatorState>(k: K, v: CalculatorState[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  async function refreshRates() {
    setRefreshing(true);
    try {
      setBundle(await fetchRates(true));
    } finally {
      setRefreshing(false);
    }
  }

  async function onSave() {
    if (!result || "error" in result) return;
    const id = crypto.randomUUID();
    await appendHistory({
      id,
      createdAt: Date.now(),
      inputs: {
        shape: state.shape,
        carat,
        color: state.color,
        clarity: state.clarity,
        pct,
        quantity: qty,
        currency: state.currency,
      },
      outputs: { ...result, fxRateToUSD: fxRate },
    });
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(null), 2200);
  }

  function fmtLocal(usd: number) {
    return fmtMoney(convertFromUSD(usd, fxRate), state.currency);
  }
  function fmtUsd(usd: number) {
    return fmtMoney(usd, "USD");
  }

  const ok = result && !("error" in result) ? (result as CalcOutputs) : null;
  const err = result && "error" in result ? result.error : null;

  const pctWheelVal = nearestWheelPct(state.pct, discOpts);

  return (
    <div className="space-y-5 text-neutral-100">
      {/* Carat + scroll wheels — same visual family */}
      <div className="rounded-2xl border border-white/10 bg-neutral-950/80 p-3 shadow-inner">
        <div className="flex gap-1 sm:gap-2">
          <CaratWheelSlot
            value={state.carat}
            onChange={(v) => set("carat", v)}
            ariaLabel="Stone weight in carats"
          />
          <ScrollWheelColumn
            ariaLabel="Shape"
            options={shapeOptions}
            value={state.shape}
            onChange={(v) => set("shape", v as Shape)}
          />
          <ScrollWheelColumn
            ariaLabel="Color"
            options={colorOptions}
            value={state.color}
            onChange={(v) => set("color", v as Color)}
          />
          <ScrollWheelColumn
            ariaLabel="Clarity"
            options={clarityOptions}
            value={state.clarity}
            onChange={(v) => set("clarity", v as Clarity)}
          />
          <ScrollWheelColumn
            ariaLabel="Percent off or on list"
            tone="discount"
            options={discOpts}
            value={pctWheelVal}
            onChange={(v) => set("pct", v)}
          />
        </div>
        {state.shape !== "Round" && state.shape !== "Pear" && (
          <p className="mt-2 px-1 text-center text-[11px] text-neutral-500">
            {state.shape} ({SHAPE_CODE[state.shape]}) uses the pear grid per
            industry convention.
          </p>
        )}
      </div>

      {/* 2×2 price grid — non-USD: USD first, local currency second; both same weight */}
      <div className="grid grid-cols-2 gap-2">
        <PriceCell
          label="Ref. price / ct."
          primary={ok ? fmtUsd(ok.listPpc) : "—"}
          secondary={ok && state.currency !== "USD" ? fmtLocal(ok.listPpc) : undefined}
          dualLine={state.currency !== "USD"}
        />
        <div className="flex flex-col rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-rose-200/90">
            Disc.
          </span>
          <span className="mt-1 text-[18px] font-bold tabular-nums text-rose-300">
            {pct >= 0 ? "+" : ""}
            {pct.toFixed(2)}%
          </span>
        </div>
        <PriceCell
          label="Price / ct."
          primary={ok ? fmtUsd(ok.yourPpc) : "—"}
          secondary={ok && state.currency !== "USD" ? fmtLocal(ok.yourPpc) : undefined}
          dualLine={state.currency !== "USD"}
        />
        <PriceCell
          label="Total price"
          primary={ok ? fmtUsd(ok.lotTotal ?? ok.yourTotal) : "—"}
          secondary={
            ok && state.currency !== "USD"
              ? fmtLocal(ok.lotTotal ?? ok.yourTotal)
              : undefined
          }
          dualLine={state.currency !== "USD"}
        />
      </div>

      {err && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
          {err}
        </p>
      )}

      {/* Currency + exchange rate (rate always visible when not USD) */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <span className="text-[12px] font-medium uppercase tracking-[0.1em] text-neutral-300">
          Currency
        </span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                set("currency", c);
                setOverrideRate("");
              }}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                state.currency === c
                  ? "bg-white text-neutral-950"
                  : "bg-white/10 text-neutral-300 hover:bg-white/15"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        {state.currency !== "USD" && (
          <div className="mt-4 space-y-3 border-t border-white/15 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400">
                  Exchange rate
                </p>
                <p className="mt-1.5 break-words text-[22px] font-semibold tabular-nums tracking-tight text-white">
                  1 USD = {fxRate.toFixed(4)}{" "}
                  <span className="text-[17px] font-semibold text-neutral-100">
                    {state.currency}
                  </span>
                </p>
                <p className="mt-3 text-[14px] leading-snug text-neutral-100">
                  <span className="font-semibold text-white">Rate source: </span>
                  {!bundle ? (
                    <span className="text-neutral-300">Loading…</span>
                  ) : bundle.source.startsWith("fallback") ? (
                    <span className="text-amber-200">
                      Offline estimate — refresh when online for a live rate
                    </span>
                  ) : bundle.sourceUrl ? (
                    <a
                      href={bundle.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-sky-300 underline decoration-sky-400/50 underline-offset-2 hover:text-sky-200"
                    >
                      {hostnameFromUrl(bundle.sourceUrl)}
                    </a>
                  ) : (
                    <span className="text-white">{bundle.source}</span>
                  )}
                </p>
                {bundle && !bundle.source.startsWith("fallback") && (
                  <p className="mt-1 text-[12px] text-neutral-400">
                    Fetched {fmtAge(bundle.fetchedAt, nowTick)} · compare with{" "}
                    <a
                      href="https://www.moneycontrol.com/forex-market/currency/USD-INR"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-300 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-200"
                    >
                      Moneycontrol
                    </a>{" "}
                    and override below if needed
                  </p>
                )}
                {overrideRate &&
                  Number.isFinite(parseFloat(overrideRate)) &&
                  parseFloat(overrideRate) > 0 && (
                    <p className="mt-2 text-[13px] text-sky-200/95">
                      Custom rate applied. Live quote:{" "}
                      {liveRate.toFixed(4)} {state.currency}
                      {bundle &&
                        !bundle.source.startsWith("fallback") &&
                        bundle.sourceUrl && (
                          <>
                            {" "}
                            (via {hostnameFromUrl(bundle.sourceUrl)})
                          </>
                        )}
                    </p>
                  )}
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full bg-white/15 px-4 py-2 text-[13px] font-semibold text-white hover:bg-white/25 active:scale-[0.98] disabled:opacity-40"
                onClick={refreshRates}
                disabled={refreshing}
              >
                {refreshing ? "…" : "Refresh"}
              </button>
            </div>
            <div>
              <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-neutral-400">
                Override (optional)
              </label>
              <input
                className="mt-1.5 w-full rounded-xl border border-white/25 bg-black/50 px-3 py-3 text-[16px] font-semibold tabular-nums text-white placeholder:text-neutral-500 focus:border-sky-400/70 focus:outline-none"
                type="number"
                inputMode="decimal"
                step="0.0001"
                placeholder={liveRate.toFixed(4)}
                value={overrideRate}
                onChange={(e) => setOverrideRate(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {tradeNotes.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-[12px] text-amber-100/90 space-y-1">
          {tradeNotes.map((n, i) => (
            <p key={i}>· {n}</p>
          ))}
        </div>
      )}

      {ok && (
        <p className="text-center text-[11px] text-neutral-500">
          {ok.resolvedShape} · bracket {ok.bracketId} · row {ok.rowKey}
          {state.currency !== "USD" && (
            <> · 1 USD = {fxRate.toFixed(4)} {state.currency}</>
          )}
        </p>
      )}

      <button
        type="button"
        className="w-full rounded-full bg-sky-500 py-3.5 text-[16px] font-semibold text-white shadow-lg shadow-sky-500/25 active:scale-[0.98] disabled:opacity-40"
        onClick={onSave}
        disabled={!ok}
      >
        {savedAt ? "Saved ✓" : "Save calculation"}
      </button>
    </div>
  );
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function PriceCell({
  label,
  primary,
  secondary,
  dualLine = false,
}: {
  label: string;
  primary: string;
  secondary?: string;
  /** When true, secondary is as prominent as primary (for USD + local pairs). */
  dualLine?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-neutral-900/50 px-3 py-2.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-neutral-500">
        {label}
      </span>
      <span className="mt-1 text-[15px] font-semibold tabular-nums text-white">
        {primary}
      </span>
      {secondary && (
        <span
          className={
            dualLine
              ? "mt-1.5 border-t border-white/15 pt-1.5 text-[15px] font-semibold tabular-nums text-white"
              : "mt-0.5 text-[12px] tabular-nums text-neutral-400"
          }
        >
          {secondary}
        </span>
      )}
    </div>
  );
}
