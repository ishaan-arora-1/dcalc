"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { clearHistory, clearPriceBook } from "@/lib/storage/db";
import { useBookStore } from "@/lib/store";

interface AccountState {
  email: string | null;
  trialStartedAt: number | null;
  plan: "trial" | "monthly" | "annual" | null;
}

const KEY = "dcalc:account";

function load(): AccountState {
  if (typeof window === "undefined")
    return { email: null, trialStartedAt: null, plan: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AccountState;
  } catch {}
  return { email: null, trialStartedAt: null, plan: null };
}
function save(s: AccountState) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export default function AccountPage() {
  const setBook = useBookStore((s) => s.setBook);
  const [state, setState] = useState<AccountState>({
    email: null,
    trialStartedAt: null,
    plan: null,
  });
  const [emailInput, setEmailInput] = useState("");

  useEffect(() => {
    setState(load());
  }, []);

  function startTrial() {
    if (!emailInput.includes("@")) return;
    const next: AccountState = {
      email: emailInput,
      trialStartedAt: Date.now(),
      plan: "trial",
    };
    save(next);
    setState(next);
  }
  function signOut() {
    save({ email: null, trialStartedAt: null, plan: null });
    setState({ email: null, trialStartedAt: null, plan: null });
  }
  async function reset() {
    await clearPriceBook();
    await clearHistory();
    setBook(null);
  }

  const trialDaysLeft = state.trialStartedAt
    ? Math.max(
        0,
        7 - Math.floor((Date.now() - state.trialStartedAt) / (24 * 60 * 60 * 1000)),
      )
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-[24px] font-semibold tracking-tight text-white">
        Account
      </h1>

      {!state.email ? (
        <div className="card p-6 space-y-3">
          <h2 className="text-[16px] font-semibold text-white">Start your 7-day free trial</h2>
          <p className="text-[13px] text-neutral-500">
            Full access. No credit card required.
          </p>
          <input
            className="input"
            type="email"
            inputMode="email"
            placeholder="you@business.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
          />
          <button className="btn-primary w-full" onClick={startTrial}>
            Start trial
          </button>
        </div>
      ) : (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] text-neutral-500">Signed in</div>
              <div className="text-[15px] font-medium text-white">{state.email}</div>
            </div>
            <button className="btn-ghost" onClick={signOut}>
              Sign out
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-[11px] uppercase tracking-wider text-neutral-400">
                Plan
              </div>
              <div className="mt-1 text-[16px] font-semibold capitalize text-white">
                {state.plan ?? "—"}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-[11px] uppercase tracking-wider text-neutral-400">
                Trial days left
              </div>
              <div className="mt-1 text-[16px] font-semibold text-white">
                {trialDaysLeft ?? "—"}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-outline" disabled>
              Monthly
            </button>
            <button className="btn-outline" disabled>
              Annual
            </button>
          </div>
        </div>
      )}

      <div className="card p-6 space-y-3">
        <h2 className="text-[15px] font-semibold text-white">Price list</h2>
        <p className="text-[13px] text-neutral-500">
          Manage the PDF stored on this device.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Link className="btn-outline" href="/upload">
            Replace
          </Link>
          <button className="btn-outline" onClick={reset}>
            Clear all data
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[12px] text-neutral-500 leading-relaxed">
        Diamond Master is not affiliated with any price list provider. We do not store,
        distribute, or process your price list on our servers. All PDF
        processing occurs locally on your device.
      </div>
    </div>
  );
}
