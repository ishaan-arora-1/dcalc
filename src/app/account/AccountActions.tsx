"use client";

import Script from "next/script";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AccountSummary } from "@/lib/account";

type Props =
  | { mode: "signed-out"; account?: undefined }
  | { mode: "signed-in"; account: AccountSummary };

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

export function AccountActions(props: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setBusy("google");
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/account`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setBusy(null);
      setError(error.message);
    }
  }

  async function startSubscription(interval: "monthly" | "yearly") {
    setBusy(interval);
    setError(null);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = (await res.json()) as {
        subscriptionId?: string;
        keyId?: string;
        error?: string;
      };
      if (!res.ok || !data.subscriptionId || !data.keyId) {
        throw new Error(data.error ?? "Could not start subscription");
      }
      if (!window.Razorpay) {
        throw new Error("Razorpay Checkout failed to load. Refresh and retry.");
      }
      const rzp = new window.Razorpay({
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "Diamond Master",
        description:
          interval === "monthly"
            ? "Monthly subscription (₹99/mo)"
            : "Yearly subscription (₹799/yr)",
        handler: () => {
          // Final confirmation arrives via the webhook; reload so the server
          // component picks up the new subscription state.
          window.location.reload();
        },
        modal: {
          ondismiss: () => setBusy(null),
        },
        theme: { color: "#0a0a0a" },
      });
      rzp.open();
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  async function cancelSubscription() {
    if (!confirm("Cancel your subscription at the end of the current period?"))
      return;
    setBusy("cancel");
    setError(null);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not cancel");
      }
      window.location.reload();
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  if (props.mode === "signed-out") {
    return (
      <>
        <button
          className="btn-primary w-full"
          onClick={signInWithGoogle}
          disabled={busy === "google"}
        >
          {busy === "google" ? "Redirecting…" : "Continue with Google"}
        </button>
        {error ? (
          <p className="text-[12px] text-red-400 mt-2">{error}</p>
        ) : null}
      </>
    );
  }

  const sub = props.account.subscription;
  const hasLiveSub =
    sub && (sub.status === "active" || sub.status === "authenticated" || sub.status === "pending");

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />

      {!hasLiveSub ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn-outline"
            onClick={() => startSubscription("monthly")}
            disabled={busy !== null}
          >
            {busy === "monthly" ? "Opening…" : "₹99 / month"}
          </button>
          <button
            className="btn-outline"
            onClick={() => startSubscription("yearly")}
            disabled={busy !== null}
          >
            {busy === "yearly" ? "Opening…" : "₹799 / year"}
          </button>
        </div>
      ) : (
        <button
          className="btn-outline w-full"
          onClick={cancelSubscription}
          disabled={busy !== null}
        >
          {busy === "cancel" ? "Cancelling…" : "Cancel subscription"}
        </button>
      )}

      <form action="/auth/signout" method="POST">
        <button className="btn-ghost w-full" type="submit">
          Sign out
        </button>
      </form>

      {error ? <p className="text-[12px] text-red-400">{error}</p> : null}
      {props.account.inTrial && !hasLiveSub ? (
        <p className="text-[12px] text-neutral-500">
          You&apos;re in your free trial. Subscribe any time — you won&apos;t be
          charged until the trial ends.
        </p>
      ) : null}
    </>
  );
}

interface RazorpayOptions {
  key: string;
  subscription_id: string;
  name: string;
  description?: string;
  handler?: (response: unknown) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
}
