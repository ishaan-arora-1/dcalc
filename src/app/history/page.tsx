"use client";

import { useEffect, useState } from "react";
import {
  deleteHistory,
  listHistory,
  type SavedCalculation,
} from "@/lib/storage/db";
import { convertFromUSD, fmtMoney, type Currency } from "@/lib/currency";

export default function HistoryPage() {
  const [items, setItems] = useState<SavedCalculation[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setItems(await listHistory());
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  function exportCsv() {
    const rows = [
      [
        "date",
        "shape",
        "carat",
        "color",
        "clarity",
        "pct",
        "qty",
        "currency",
        "fx_rate",
        "list_ppc_local",
        "your_ppc_local",
        "your_total_local",
        "lot_total_local",
      ].join(","),
      ...items.map((it) =>
        [
          new Date(it.createdAt).toISOString(),
          it.inputs.shape,
          it.inputs.carat,
          it.inputs.color,
          it.inputs.clarity,
          it.inputs.pct,
          it.inputs.quantity,
          it.inputs.currency,
          it.outputs.fxRateToUSD,
          (it.outputs.listPpc * it.outputs.fxRateToUSD).toFixed(2),
          (it.outputs.yourPpc * it.outputs.fxRateToUSD).toFixed(2),
          (it.outputs.yourTotal * it.outputs.fxRateToUSD).toFixed(2),
          it.outputs.lotTotal != null
            ? (it.outputs.lotTotal * it.outputs.fxRateToUSD).toFixed(2)
            : "",
        ].join(","),
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "history.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-stone-900">
            History
          </h1>
          <p className="text-[13px] text-stone-500">
            Saved on this device only.
          </p>
        </div>
        {items.length > 0 && (
          <button className="btn-outline" onClick={exportCsv}>
            Export
          </button>
        )}
      </div>

      {loading && (
        <div className="card p-6 text-[14px] text-stone-500">Loading…</div>
      )}
      {!loading && items.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-[14px] text-stone-500">
            No saved calculations yet.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((it) => (
          <HistoryCard
            key={it.id}
            item={it}
            onDelete={async () => {
              await deleteHistory(it.id);
              void refresh();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function HistoryCard({
  item,
  onDelete,
}: {
  item: SavedCalculation;
  onDelete: () => void;
}) {
  const c = item.inputs.currency as Currency;
  const fmt = (usd: number) => fmtMoney(convertFromUSD(usd, item.outputs.fxRateToUSD), c);
  const total = item.outputs.lotTotal ?? item.outputs.yourTotal;
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] text-stone-400">
            {new Date(item.createdAt).toLocaleString()}
          </div>
          <div className="mt-1 text-[15px] font-medium truncate">
            {item.inputs.shape} · {item.inputs.carat.toFixed(2)} ct ·{" "}
            {item.inputs.color}/{item.inputs.clarity}
          </div>
          <div className="text-[13px] text-stone-500">
            {item.inputs.pct >= 0 ? `+${item.inputs.pct}` : item.inputs.pct}% ·
            ×{item.inputs.quantity}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[18px] font-semibold tabular-nums">
            {fmt(total)}
          </div>
          <div className="text-[11px] text-stone-400">{c}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
        <Stat k="List / ct" v={fmt(item.outputs.listPpc)} />
        <Stat k="Your / ct" v={fmt(item.outputs.yourPpc)} />
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          className="text-[12px] text-stone-500 hover:text-rose-700"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-stone-500">{k}</div>
      <div className="mt-0.5 font-medium tabular-nums">{v}</div>
    </div>
  );
}
