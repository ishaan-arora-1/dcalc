"use client";

import { useState } from "react";
import type { CertificateResult, Lab, LookupResponse } from "@/lib/certificate/types";

const LABS: Lab[] = ["GIA", "IGI", "HRD"];

export default function CertificatePage() {
  const [lab, setLab] = useState<Lab>("GIA");
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<CertificateResult | null>(null);

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault();
    if (!number.trim()) {
      setErr("Enter a certificate number.");
      return;
    }
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const url = `/api/certificate/lookup?lab=${lab}&number=${encodeURIComponent(number.trim())}`;
      const res = await fetch(url);
      const data = (await res.json()) as LookupResponse;
      if (!data.ok || !data.result) {
        setErr(data.error || "Lookup failed.");
      } else {
        setResult(data.result);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-[26px] font-semibold tracking-tight text-white">
          Certificate lookup
        </h1>
        <p className="text-[14px] text-neutral-400 leading-relaxed">
          Verify GIA, IGI, and HRD reports. Enter the certificate number and
          we&apos;ll fetch the details straight from the lab.
        </p>
      </header>

      <form onSubmit={lookup} className="space-y-4">
        <div className="space-y-2">
          <div className="label">Lab</div>
          <div className="chips">
            {LABS.map((l) => (
              <button
                key={l}
                type="button"
                className="chip"
                aria-pressed={lab === l}
                onClick={() => setLab(l)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="label">Certificate number</div>
          <input
            className="input input-lg"
            inputMode="numeric"
            autoComplete="off"
            placeholder={
              lab === "GIA"
                ? "e.g. 2141438171"
                : lab === "IGI"
                  ? "e.g. LG612345678"
                  : "e.g. 220000012345"
            }
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? "Fetching from lab…" : "Look up certificate"}
        </button>
      </form>

      {err && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-[13px] text-rose-200">
          {err}
        </div>
      )}

      {result && <ResultCard result={result} />}

      {!result && !err && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[12px] text-neutral-500 leading-relaxed">
          Reports are fetched live from the issuing lab. We don&apos;t store
          your lookups. Some labs rate-limit automated checks — if a lookup
          fails, open the official link and try again in a moment.
        </div>
      )}
    </div>
  );
}

function ResultCard({ result }: { result: CertificateResult }) {
  const rows: Array<[string, string | undefined]> = [
    ["Report number", result.reportNumber],
    ["Report type", result.reportType],
    ["Report date", result.reportDate],
    ["Shape", result.shape],
    ["Carat weight", result.caratWeight],
    ["Color", result.color],
    ["Clarity", result.clarity],
    ["Cut", result.cut],
    ["Polish", result.polish],
    ["Symmetry", result.symmetry],
    ["Fluorescence", result.fluorescence],
    ["Measurements", result.measurements],
    ["Depth", result.depth],
    ["Table", result.table],
    ["Girdle", result.girdle],
    ["Culet", result.culet],
    ["Inscription", result.inscription],
    ["Comments", result.comments],
  ].filter((row): row is [string, string] => Boolean(row[1] && row[1].trim()));

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.08em] text-neutral-500">
            {result.lab}
          </div>
          <div className="mt-0.5 text-[18px] font-semibold tracking-tight text-white">
            {result.reportNumber}
          </div>
        </div>
        {result.reportUrl && (
          <a
            className="btn-ghost text-[13px]"
            href={result.reportUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open on {result.lab.toLowerCase()}.org ↗
          </a>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 px-4">
        {rows.map(([k, v]) => (
          <div key={k} className="stat-row">
            <span className="stat-label">{k}</span>
            <span className="stat-value text-right max-w-[60%] truncate">
              {v}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
