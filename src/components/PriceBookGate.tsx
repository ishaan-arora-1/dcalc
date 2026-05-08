"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useBookStore } from "@/lib/store";
import { PRICEBOOK_TTL_MS } from "@/lib/storage/db";

export function PriceBookGate({ children }: { children: React.ReactNode }) {
  const { book, expired, loading, hydrate } = useBookStore();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (loading) {
    return (
      <div className="card p-8 text-[14px] text-stone-500">Loading your price list…</div>
    );
  }

  if (!book) {
    return (
      <div className="card p-7 space-y-3">
        <h2 className="text-[18px] font-semibold tracking-tight">No price list loaded</h2>
        <p className="text-[14px] text-stone-600 leading-relaxed">
          Upload your diamond price list PDF to start calculating. The file is
          processed entirely on this device — it never leaves your browser.
        </p>
        <Link className="btn-primary inline-flex" href="/upload">
          Upload PDF
        </Link>
      </div>
    );
  }

  if (expired) {
    const days = Math.round(PRICEBOOK_TTL_MS / (24 * 60 * 60 * 1000));
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-3">
        <h2 className="text-[17px] font-semibold text-amber-900">
          Your price list has expired
        </h2>
        <p className="text-[13px] text-amber-900/80 leading-relaxed">
          The list you uploaded is more than {days} days old. Please upload your
          updated PDF to continue.
        </p>
        <Link className="btn-primary inline-flex" href="/upload">
          Upload updated PDF
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

export function PriceBookBanner() {
  const { book, expired } = useBookStore();
  if (!book) return null;
  const ageDays = Math.floor((Date.now() - book.uploadedAt) / (24 * 60 * 60 * 1000));
  return (
    <div className="text-[12px] text-stone-400">
      List loaded
      {book.reportDate ? ` — ${book.reportDate}` : ""} ·{" "}
      {ageDays === 0 ? "today" : `${ageDays}d ago`}
      {expired ? " · expired" : ""}
    </div>
  );
}
