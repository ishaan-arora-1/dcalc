"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parsePriceListPdf } from "@/lib/pricing/parser";
import { savePriceBook } from "@/lib/storage/db";
import { useBookStore } from "@/lib/store";

export default function UploadPage() {
  const router = useRouter();
  const setBook = useBookStore((s) => s.setBook);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [warns, setWarns] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  async function onFile(f: File) {
    if (!confirmed) {
      setErr("Please confirm legitimate use of your price list before uploading.");
      return;
    }
    setBusy(true);
    setErr(null);
    setWarns([]);
    try {
      const { book, warnings } = await parsePriceListPdf(f);
      if (book.grids.length === 0) {
        setErr(
          "We couldn't find any price grids in this PDF. Make sure it's the weekly diamond price list and try again.",
        );
        setBusy(false);
        return;
      }
      await savePriceBook(book);
      setBook(book);
      setWarns(warnings);
      router.push("/calculator");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-[26px] font-semibold tracking-tight text-stone-900">
          Upload your price list
        </h1>
        <p className="text-[14px] text-stone-600 leading-relaxed">
          Drop in your weekly PDF. The file is parsed entirely in your browser —
          it never leaves your device.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-[13px] text-stone-700 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-stone-900"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span className="leading-relaxed">
          I confirm that I have legitimately obtained this price list PDF and
          that my use of it complies with the terms under which it was
          purchased.
        </span>
      </label>

      <div
        className="rounded-2xl border-2 border-dashed border-stone-300 bg-white p-10 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) void onFile(f);
        }}
      >
        <div className="text-[14px] text-stone-500">
          {busy ? "Parsing your price list…" : "Drag & drop, or pick a file"}
        </div>
        <label className="btn-primary mt-4 inline-flex cursor-pointer">
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
          Choose PDF
        </label>
      </div>

      {err && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-900">
          {err}
        </div>
      )}

      {warns.length > 0 && (
        <ul className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900 space-y-1">
          {warns.map((w, i) => (
            <li key={i}>· {w}</li>
          ))}
        </ul>
      )}

      <div className="rounded-2xl bg-stone-100/70 p-4 text-[12px] text-stone-500 leading-relaxed">
        We only retain the extracted numerical price grid in your browser&apos;s
        local storage. The PDF file itself is not stored. Stored data expires
        after 7 days.
      </div>
    </div>
  );
}
