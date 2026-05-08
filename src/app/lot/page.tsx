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

interface LotRow {
  id: string;
  shape: Shape;
  carat: number;
  color: Color;
  clarity: Clarity;
  pct: number;
  quantity: number;
  expanded?: boolean;
}

const ROW_DEFAULT: Omit<LotRow, "id"> = {
  shape: "Round",
  carat: 1,
  color: "G",
  clarity: "VS1",
  pct: -30,
  quantity: 1,
};

export default function LotPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight text-stone-900">
          Lot
        </h1>
        <p className="text-[13px] text-stone-500">
          Build a parcel. Each stone prices independently.
        </p>
      </div>
      <PriceBookGate>
        <LotEditor />
      </PriceBookGate>
    </div>
  );
}

function LotEditor() {
  const book = useBookStore((s) => s.book);
  const [rows, setRows] = useState<LotRow[]>([
    { id: crypto.randomUUID(), ...ROW_DEFAULT, expanded: true },
  ]);
  const [currency, setCurrency] = useState<Currency>("USD");
  const [bundle, setBundle] = useState<RateBundle | null>(null);
  const [overrideRate, setOverrideRate] = useState("");

  useEffect(() => {
    void fetchRates().then(setBundle);
  }, []);

  const liveRate = bundle?.rates[currency] ?? 1;
  const overrideNum = parseFloat(overrideRate);
  const fxRate =
    currency === "USD"
      ? 1
      : Number.isFinite(overrideNum) && overrideNum > 0
        ? overrideNum
        : liveRate;

  const priced = useMemo(() => {
    if (!book) return [];
    return rows.map((r) => ({
      row: r,
      calc: calculate(book, {
        shape: r.shape,
        carat: r.carat,
        color: r.color,
        clarity: r.clarity,
        pct: r.pct,
        quantity: r.quantity,
      }),
    }));
  }, [book, rows]);

  const totals = useMemo(() => {
    let stones = 0;
    let weight = 0;
    let value = 0;
    for (const { row, calc } of priced) {
      if (!calc || "error" in calc) continue;
      stones += row.quantity;
      weight += row.carat * row.quantity;
      value += calc.yourTotal * row.quantity;
    }
    return { stones, weight, value, avgPpc: weight ? value / weight : 0 };
  }, [priced]);

  function update(id: string, patch: Partial<LotRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function add() {
    setRows((rs) => [
      ...rs.map((r) => ({ ...r, expanded: false })),
      { id: crypto.randomUUID(), ...ROW_DEFAULT, expanded: true },
    ]);
  }
  function remove(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }
  function fmt(usd: number) {
    return fmtMoney(convertFromUSD(usd, fxRate), currency);
  }
  function exportCsv() {
    const header = [
      "shape",
      "carat",
      "color",
      "clarity",
      "pct",
      "qty",
      "list_ppc_usd",
      "your_ppc_usd",
      "your_total_usd",
      "line_total_usd",
    ];
    const lines = [header.join(",")];
    for (const { row, calc } of priced) {
      const ok = calc && !("error" in calc) ? calc : null;
      lines.push(
        [
          row.shape,
          row.carat,
          row.color,
          row.clarity,
          row.pct,
          row.quantity,
          ok ? ok.listPpc.toFixed(2) : "",
          ok ? ok.yourPpc.toFixed(2) : "",
          ok ? ok.yourTotal.toFixed(2) : "",
          ok ? (ok.yourTotal * row.quantity).toFixed(2) : "",
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lot.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-stone-900 text-white p-6 shadow-card">
        <div className="text-[12px] uppercase tracking-[0.12em] text-stone-400">
          Lot value
        </div>
        <div className="mt-2 text-[36px] font-semibold tracking-tightest leading-none tabular-nums">
          {fmt(totals.value)}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-[12px]">
          <div>
            <div className="text-stone-400 uppercase tracking-wider text-[10px]">
              Stones
            </div>
            <div className="mt-1 text-[16px] font-medium tabular-nums">
              {totals.stones}
            </div>
          </div>
          <div>
            <div className="text-stone-400 uppercase tracking-wider text-[10px]">
              Weight
            </div>
            <div className="mt-1 text-[16px] font-medium tabular-nums">
              {totals.weight.toFixed(2)} ct
            </div>
          </div>
          <div>
            <div className="text-stone-400 uppercase tracking-wider text-[10px]">
              Avg / ct
            </div>
            <div className="mt-1 text-[16px] font-medium tabular-nums">
              {fmt(totals.avgPpc)}
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div>
          <div className="label mb-2">Currency</div>
          <Chips
            options={CURRENCIES}
            value={currency}
            onChange={(v) => {
              setCurrency(v);
              setOverrideRate("");
            }}
          />
        </div>
        {currency !== "USD" && (
          <div className="space-y-1">
            <div className="label">1 USD = {currency}</div>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="0.0001"
              placeholder={liveRate.toFixed(4)}
              value={overrideRate}
              onChange={(e) => setOverrideRate(e.target.value)}
            />
            <p className="text-[12px] text-stone-400">
              Live {liveRate.toFixed(4)}
              {bundle ? ` · ${bundle.source}` : ""}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {priced.map(({ row, calc }, idx) => (
          <LotCard
            key={row.id}
            index={idx + 1}
            row={row}
            calc={calc}
            fmt={fmt}
            onUpdate={(p) => update(row.id, p)}
            onRemove={() => remove(row.id)}
            onToggle={() => update(row.id, { expanded: !row.expanded })}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <button className="btn-outline flex-1" onClick={add}>
          + Add stone
        </button>
        <button className="btn-outline flex-1" onClick={exportCsv}>
          Export CSV
        </button>
      </div>
    </div>
  );
}

function LotCard({
  index,
  row,
  calc,
  fmt,
  onUpdate,
  onRemove,
  onToggle,
}: {
  index: number;
  row: LotRow;
  calc: ReturnType<typeof calculate> | null;
  fmt: (usd: number) => string;
  onUpdate: (patch: Partial<LotRow>) => void;
  onRemove: () => void;
  onToggle: () => void;
}) {
  const ok = calc && !("error" in calc) ? calc : null;
  const err = calc && "error" in calc ? calc.error : null;

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        onClick={onToggle}
      >
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-wider text-stone-400">
            Stone {index}
          </div>
          <div className="mt-0.5 text-[15px] font-medium text-stone-900 truncate">
            {row.shape} · {row.carat.toFixed(2)} ct · {row.color}/{row.clarity}{" "}
            <span className="text-stone-400">
              {row.pct >= 0 ? `+${row.pct}` : row.pct}% · ×{row.quantity}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0 ml-3">
          <div className="text-[15px] font-semibold tabular-nums text-stone-900">
            {ok ? fmt(ok.yourTotal * row.quantity) : err ? "—" : "—"}
          </div>
          {err && (
            <div className="text-[11px] text-rose-700 max-w-[180px] truncate">
              {err}
            </div>
          )}
        </div>
      </button>

      {row.expanded && (
        <div className="border-t border-stone-100 px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label mb-1">Shape</div>
              <select
                className="select"
                value={row.shape}
                onChange={(e) => onUpdate({ shape: e.target.value as Shape })}
              >
                {SHAPES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="label mb-1">Carat</div>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={row.carat}
                onChange={(e) =>
                  onUpdate({ carat: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <div>
            <div className="label mb-1.5">Color</div>
            <Chips
              options={COLORS}
              value={row.color}
              onChange={(v) => onUpdate({ color: v })}
            />
          </div>
          <div>
            <div className="label mb-1.5">Clarity</div>
            <Chips
              options={CLARITIES}
              value={row.clarity}
              onChange={(v) => onUpdate({ clarity: v })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label mb-1">% off / on</div>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                step="0.5"
                value={row.pct}
                onChange={(e) =>
                  onUpdate({ pct: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <div className="label mb-1">Quantity</div>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={row.quantity}
                onChange={(e) =>
                  onUpdate({
                    quantity: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
              />
            </div>
          </div>

          {ok && (
            <div className="rounded-xl bg-stone-50 p-3 text-[13px] text-stone-700 space-y-1.5">
              <Line k="List / ct" v={fmt(ok.listPpc)} />
              <Line k="Your / ct" v={fmt(ok.yourPpc)} />
              <Line k="Your total" v={fmt(ok.yourTotal)} />
              <Line
                k={`Line total · ×${row.quantity}`}
                v={fmt(ok.yourTotal * row.quantity)}
                strong
              />
            </div>
          )}

          <button
            type="button"
            className="text-[13px] text-rose-700 hover:underline"
            onClick={onRemove}
          >
            Remove stone
          </button>
        </div>
      )}
    </div>
  );
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-stone-500">{k}</span>
      <span className={`tabular-nums ${strong ? "font-semibold text-stone-900" : ""}`}>
        {v}
      </span>
    </div>
  );
}
