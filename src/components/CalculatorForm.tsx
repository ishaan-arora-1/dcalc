"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CLARITIES,
  COLORS,
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
  fmtMoney,
  type Currency,
  type RateBundle,
} from "@/lib/currency";
import { appendHistory } from "@/lib/storage/db";
import { Chips } from "./Chips";

export interface CalculatorState {
  shape: Shape;
  carat: string;
  color: Color;
  clarity: Clarity;
  pct: string;
  quantity: string;
  currency: Currency;
}

const DEFAULT_STATE: CalculatorState = {
  shape: "Round",
  carat: "1.00",
  color: "G",
  clarity: "VS1",
  pct: "-30",
  quantity: "1",
  currency: "USD",
};

interface Props {
  initial?: Partial<CalculatorState>;
}

export function CalculatorForm({ initial }: Props) {
  const book = useBookStore((s) => s.book);
  const [state, setState] = useState<CalculatorState>({
    ...DEFAULT_STATE,
    ...initial,
  });
  const [bundle, setBundle] = useState<RateBundle | null>(null);
  const [overrideRate, setOverrideRate] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    void fetchRates().then(setBundle);
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
  const qty = Math.max(1, parseInt(state.quantity || "1", 10) || 1);

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

  function fmt(v: number) {
    return fmtMoney(convertFromUSD(v, fxRate), state.currency);
  }

  const ok = result && !("error" in result) ? (result as CalcOutputs) : null;
  const err = result && "error" in result ? result.error : null;

  return (
    <div className="space-y-6">
      <Hero
        title="Your total"
        big={ok ? fmt(ok.lotTotal ?? ok.yourTotal) : "—"}
        subtitle={
          ok
            ? `${state.shape} · ${carat.toFixed(2)} ct · ${state.color}/${state.clarity} · ${pct >= 0 ? `+${pct}` : pct}%`
            : "Set the specs below to calculate."
        }
        error={err}
      />

      {ok && (
        <div className="card p-5">
          <div className="stat-row">
            <span className="stat-label">List / ct</span>
            <span className="stat-value">{fmt(ok.listPpc)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">List total</span>
            <span className="stat-value">{fmt(ok.listTotal)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Your / ct</span>
            <span className="stat-value">{fmt(ok.yourPpc)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Your total</span>
            <span className="stat-value">{fmt(ok.yourTotal)}</span>
          </div>
          {ok.lotTotal != null && (
            <div className="stat-row">
              <span className="stat-label">Lot total · ×{qty}</span>
              <span className="stat-value">{fmt(ok.lotTotal)}</span>
            </div>
          )}
        </div>
      )}

      <Section title="Shape & weight">
        <div className="space-y-3">
          <div>
            <Label>Shape</Label>
            <select
              className="select"
              value={state.shape}
              onChange={(e) => set("shape", e.target.value as Shape)}
            >
              {SHAPES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            {state.shape !== "Round" && state.shape !== "Pear" && (
              <p className="mt-2 text-[12px] text-stone-500">
                {state.shape} uses the pear grid per industry convention.
              </p>
            )}
          </div>
          <div>
            <Label>Carat</Label>
            <input
              className="input input-lg"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={state.carat}
              onChange={(e) => set("carat", e.target.value)}
            />
          </div>
        </div>
      </Section>

      <Section title="Color">
        <Chips
          ariaLabel="Color"
          options={COLORS}
          value={state.color}
          onChange={(v) => set("color", v)}
        />
      </Section>

      <Section title="Clarity">
        <Chips
          ariaLabel="Clarity"
          options={CLARITIES}
          value={state.clarity}
          onChange={(v) => set("clarity", v)}
        />
      </Section>

      <Section title="Pricing">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>% off / on list</Label>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="0.5"
              value={state.pct}
              onChange={(e) => set("pct", e.target.value)}
            />
          </div>
          <div>
            <Label>Quantity</Label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={state.quantity}
              onChange={(e) => set("quantity", e.target.value)}
            />
          </div>
        </div>
      </Section>

      <Section
        title="Currency"
        action={
          <button
            type="button"
            className="text-[12px] text-stone-500 hover:text-stone-900"
            onClick={() => setShowSettings((s) => !s)}
          >
            {showSettings ? "Hide" : "Set rate"}
          </button>
        }
      >
        <Chips
          ariaLabel="Currency"
          options={CURRENCIES}
          value={state.currency}
          onChange={(v) => {
            set("currency", v);
            setOverrideRate("");
            if (v !== "USD") setShowSettings(true);
          }}
        />

        {state.currency !== "USD" && (showSettings || overrideRate) && (
          <div className="mt-4 rounded-xl bg-stone-50 border border-stone-200/70 p-4 space-y-3">
            <div>
              <Label>1 USD = {state.currency}</Label>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                step="0.0001"
                placeholder={liveRate.toFixed(4)}
                value={overrideRate}
                onChange={(e) => setOverrideRate(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between text-[12px] text-stone-500">
              <span>
                Live {liveRate.toFixed(4)}
                {bundle ? ` · ${bundle.source}` : ""}
              </span>
              <button
                type="button"
                className="font-medium text-stone-900 hover:underline"
                onClick={refreshRates}
                disabled={refreshing}
              >
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            {overrideRate && (
              <p className="text-[12px] text-stone-700">
                Using rate <strong className="font-semibold">{fxRate.toFixed(4)}</strong>{" "}
                for this calculation.
              </p>
            )}
          </div>
        )}
      </Section>

      {tradeNotes.length > 0 && (
        <div className="rounded-xl bg-amber-50/80 border border-amber-200/70 p-4 text-[13px] text-amber-900 space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-amber-700">
            Heads up
          </div>
          {tradeNotes.map((n, i) => (
            <p key={i}>{n}</p>
          ))}
        </div>
      )}

      {ok && (
        <p className="text-center text-[12px] text-stone-400">
          {ok.resolvedShape} · bracket {ok.bracketId} · row {ok.rowKey}
          {state.currency !== "USD" && (
            <> · 1 USD = {fxRate.toFixed(4)} {state.currency}</>
          )}
        </p>
      )}

      <div className="sticky bottom-20 z-10 -mx-5 px-5 pt-3 pb-2 bg-gradient-to-t from-stone-50 via-stone-50/95 to-transparent">
        <button
          type="button"
          className="btn-primary w-full text-[16px] py-3.5"
          onClick={onSave}
          disabled={!ok}
        >
          {savedAt ? "Saved ✓" : "Save calculation"}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-medium uppercase tracking-[0.08em] text-stone-500">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="label mb-1.5 block">{children}</span>;
}

function Hero({
  title,
  big,
  subtitle,
  error,
}: {
  title: string;
  big: string;
  subtitle: string;
  error: string | null;
}) {
  return (
    <div className="rounded-3xl bg-stone-900 text-white px-6 py-7 shadow-card">
      <div className="text-[12px] uppercase tracking-[0.12em] text-stone-400">
        {title}
      </div>
      <div className="mt-2 text-[40px] font-semibold tracking-tightest leading-none tabular-nums break-words">
        {big}
      </div>
      <div className="mt-3 text-[13px] text-stone-300">{subtitle}</div>
      {error && (
        <div className="mt-3 text-[13px] text-rose-200">{error}</div>
      )}
    </div>
  );
}
