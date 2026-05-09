import Link from "next/link";
import { getAccount } from "@/lib/account";

export const dynamic = "force-dynamic";

/**
 * Gates the calculator, lot, recut, and history pages behind:
 *   1. an authenticated Supabase user, and
 *   2. either an in-progress 30-day trial or an active Razorpay subscription.
 */
export default async function PaidLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await getAccount();

  if (!account) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-7 space-y-3">
        <h2 className="text-[18px] font-semibold tracking-tight text-white">
          Sign in to continue
        </h2>
        <p className="text-[14px] text-neutral-300 leading-relaxed">
          Diamond Master keeps your history and price-list settings tied to
          your account. Sign in to start your free 30-day trial.
        </p>
        <Link
          className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-[15px] font-medium text-neutral-950"
          href="/account"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (!account.hasAccess) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 space-y-3">
        <h2 className="text-[17px] font-semibold text-amber-100">
          Your free trial has ended
        </h2>
        <p className="text-[13px] text-amber-100/80 leading-relaxed">
          Subscribe to keep using Diamond Master. ₹99 / month or ₹799 / year.
        </p>
        <Link
          className="inline-flex items-center justify-center rounded-full bg-amber-400 px-5 py-3 text-[15px] font-medium text-neutral-950"
          href="/account"
        >
          Choose a plan
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
