"use client";

import { useEffect, useMemo, useState } from "react";
import { PriceBookGate } from "@/components/PriceBookGate";
import { useBookStore } from "@/lib/store";
import {
  CLARITIES,
  COLORS,
  SHAPES,
  type Clarity,
  type Color,
  type Shape,
} from "@/lib/pricing/brackets";
import { calculate } from "@/lib/pricing/lookup";
import {
  CURRENCIES,
  convertFromUSD,
  fetchRates,
  fmtMoney,
  type Currency,
  type RateBundle,
} from "@/lib/currency";
import { Chips } from "@/components/Chips";

export default function RecutPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight text-stone-900">
          Recut
        </h1>
        <p className="text-[13px] text-stone-500">
          Estimate the polished value of a rough or recut.
        </p>
      </div>
      <PriceBookGate>
        <RecutEditor />
      </PriceBookGate>
    </div>
  );
}

function RecutEditor() {
  const book = useBookStore((s) => s.book);
  const [rough, setRough] = useState("2.50");
  const [yieldPct, setYieldPct] = useState("45");
  const [shape, setShape] = useState<Shape>("Round");
  const [color, setColor] = useState<Color>("G");
  const [clarity, setClarity] = useState<Clarity>("VS1");
  const [pct, setPct] = useState("-30");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [bundle, setBundle] = useState<RateBundle | null>(null);
  const [overrideRate, setOverrideRate] = useState("");

  useEffect(() => {
    void fetchRates().then(setBundle);
  }, []);

  const roughCt = parseFloat(rough) || 0;
  const yieldFr = Math.max(0, Math.min(100, parseFloat(yieldPct) || 0)) / 100;
  const polishedCt = +(roughCt * yieldFr).toFixed(3);
  const liveRate = bundle?.rates[currency] ?? 1;
  const overrideNum = parseFloat(overrideRate);
  const fxRate =
    currency === "USD"
      ? 1
      : Number.isFinite(overrideNum) && overrideNum > 0
        ? overrideNum
        : liveRate;

  const result = useMemo(() => {
    if (!book || polishedCt <= 0) return null;
    return calculate(book, {
      shape,
      carat: polishedCt,
      color,
      clarity,
      pct: parseFloat(pct) || 0,
      quantity: 1,
    });
  }, [book, shape, color, clarity, pct, polishedCt]);

  function fmt(usd: number) {
    return fmtMoney(convertFromUSD(usd, fxRate), currency);
  }

  const ok = result && !("error" in result) ? result : null;
  const err = result && "error" in result ? result.error : null;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-stone-900 text-white p-6 shadow-card">
        <div className="text-[12px] uppercase tracking-[0.12em] text-stone-400">
          Polished value
        </div>
        <div className="mt-2 text-[36px] font-semibold tracking-tightest leading-none tabular-nums">
          {ok ? fmt(ok.yourTotal) : "—"}
        </div>
        <div className="mt-3 text-[13px] text-stone-300">
          {polishedCt.toFixed(2)} ct expected polished
          {ok && roughCt > 0 && (
            <> · implied {fmt(ok.yourTotal / roughCt)} / ct of rough</>
          )}
        </div>
        {err && <div className="mt-3 text-[13px] text-rose-200">{err}</div>}
      </div>

      <Section title="Rough">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rough weight (ct)">
            <input
              className="input input-lg"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={rough}
              onChange={(e) => setRough(e.target.value)}
            />
          </Field>
          <Field label="Expected yield %">
            <input
              className="input input-lg"
              type="number"
              inputMode="decimal"
              step="1"
              value={yieldPct}
              onChange={(e) => setYieldPct(e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Polished specs">
        <div className="space-y-4">
          <Field label="Shape">
            <select
              className="select"
              value={shape}
              onChange={(e) => setShape(e.target.value as Shape)}
            >
              {SHAPES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <div>
            <div className="label mb-1.5">Color</div>
            <Chips options={COLORS} value={color} onChange={setColor} />
          </div>
          <div>
            <div className="label mb-1.5">Clarity</div>
            <Chips options={CLARITIES} value={clarity} onChange={setClarity} />
          </div>
          <Field label="% off / on list">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="0.5"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Currency">
        <Chips
          options={CURRENCIES}
          value={currency}
          onChange={(v) => {
            setCurrency(v);
            setOverrideRate("");
          }}
        />
        {currency !== "USD" && (
          <div className="mt-3 rounded-xl bg-stone-50 border border-stone-200/70 p-4 space-y-2">
            <Field label={`1 USD = ${currency}`}>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                step="0.0001"
                placeholder={liveRate.toFixed(4)}
                value={overrideRate}
                onChange={(e) => setOverrideRate(e.target.value)}
              />
            </Field>
            <p className="text-[12px] text-stone-500">
              Live {liveRate.toFixed(4)}
              {bundle ? ` · ${bundle.source}` : ""}
            </p>
          </div>
        )}
      </Section>

      {ok && (
        <div className="card p-5">
          <div className="stat-row">
            <span className="stat-label">List / ct</span>
            <span className="stat-value">{fmt(ok.listPpc)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Your / ct</span>
            <span className="stat-value">{fmt(ok.yourPpc)}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Your total</span>
            <span className="stat-value">{fmt(ok.yourTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[13px] font-medium uppercase tracking-[0.08em] text-stone-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
