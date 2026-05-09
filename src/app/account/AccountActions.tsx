"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AccountSummary } from "@/lib/account";

type Props =
  | { mode: "signed-out"; oauthNext?: string }
  | { mode: "signed-in"; account: AccountSummary };

/** OAuth return path: use current route (e.g. /calculator) so users land where they were blocked. */
export function SignInWithGoogleForCurrentPath() {
  const pathname = usePathname();
  const next =
    pathname && pathname.length > 0 ? pathname : "/";
  return <AccountActions mode="signed-out" oauthNext={next} />;
}

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
    const next =
      props.mode === "signed-out"
        ? (props.oauthNext ?? "/account")
        : "/account";
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
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
          type="button"
          className="btn-primary w-full gap-3"
          onClick={signInWithGoogle}
          disabled={busy === "google"}
        >
          <GoogleLogo className="h-5 w-5 shrink-0" />
          {busy === "google" ? "Redirecting…" : "Sign in with Google"}
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

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
