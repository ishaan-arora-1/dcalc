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
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-[14px] text-neutral-400">
        Loading your price list…
      </div>
    );
  }

  if (!book) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-7 space-y-3">
        <h2 className="text-[18px] font-semibold tracking-tight text-white">
          No price list loaded
        </h2>
        <p className="text-[14px] text-neutral-300 leading-relaxed">
          Upload your diamond price list PDF to start calculating. The file is
          processed entirely on this device — it never leaves your browser.
        </p>
        <Link
          className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-[15px] font-medium text-neutral-950"
          href="/upload"
        >
          Upload PDF
        </Link>
      </div>
    );
  }

  if (expired) {
    const days = Math.round(PRICEBOOK_TTL_MS / (24 * 60 * 60 * 1000));
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 space-y-3">
        <h2 className="text-[17px] font-semibold text-amber-100">
          Your price list has expired
        </h2>
        <p className="text-[13px] text-amber-100/80 leading-relaxed">
          The list you uploaded is more than {days} days old. Please upload your
          updated PDF to continue.
        </p>
        <Link
          className="inline-flex items-center justify-center rounded-full bg-amber-400 px-5 py-3 text-[15px] font-medium text-neutral-950"
          href="/upload"
        >
          Upload updated PDF
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
