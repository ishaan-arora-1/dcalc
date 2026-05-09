import Link from "next/link";
import { getAccount } from "@/lib/account";
import { AccountActions } from "./AccountActions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const account = await getAccount();

  return (
    <div className="space-y-6">
      <h1 className="text-[24px] font-semibold tracking-tight text-white">
        Account
      </h1>

      {!account ? <SignedOut /> : <SignedIn account={account} />}

      <div className="card p-6 space-y-3">
        <h2 className="text-[15px] font-semibold text-white">Price list</h2>
        <p className="text-[13px] text-neutral-500">
          Manage the PDF stored on this device.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Link className="btn-outline" href="/upload">
            Replace
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[12px] text-neutral-500 leading-relaxed">
        Diamond Master is not affiliated with any price list provider. We do
        not store, distribute, or process your price list on our servers. All
        PDF processing occurs locally on your device.
      </div>
    </div>
  );
}

function SignedOut() {
  return (
    <div className="card p-6 space-y-4">
      <div className="space-y-2">
        <h2 className="text-[16px] font-semibold text-white">
          Sign in to Diamond Master
        </h2>
        <p className="text-[13px] text-neutral-500 leading-relaxed">
          Free for the first 30 days. After that, ₹99 / month or ₹799 / year.
          You won&apos;t be charged during the trial.
        </p>
      </div>
      <AccountActions mode="signed-out" />
    </div>
  );
}

function SignedIn({
  account,
}: {
  account: NonNullable<Awaited<ReturnType<typeof getAccount>>>;
}) {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-3">
        {account.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={account.avatarUrl}
            alt=""
            className="h-10 w-10 rounded-full border border-white/10"
          />
        ) : null}
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-neutral-500">Signed in</div>
          <div className="text-[15px] font-medium text-white truncate">
            {account.name ?? account.email}
          </div>
          {account.name ? (
            <div className="text-[12px] text-neutral-500 truncate">
              {account.email}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-[11px] uppercase tracking-wider text-neutral-400">
            Plan
          </div>
          <div className="mt-1 text-[16px] font-semibold capitalize text-white">
            {account.subscription
              ? `${account.subscription.interval}`
              : account.inTrial
                ? "Trial"
                : "—"}
          </div>
          {account.subscription ? (
            <div className="mt-0.5 text-[11px] text-neutral-500 capitalize">
              {account.subscription.status}
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-[11px] uppercase tracking-wider text-neutral-400">
            {account.inTrial ? "Trial days left" : "Renews"}
          </div>
          <div className="mt-1 text-[16px] font-semibold text-white">
            {account.inTrial
              ? account.trialDaysLeft
              : account.subscription?.currentEnd
                ? account.subscription.currentEnd.toLocaleDateString()
                : "—"}
          </div>
        </div>
      </div>

      <AccountActions mode="signed-in" account={account} />
    </div>
  );
}
