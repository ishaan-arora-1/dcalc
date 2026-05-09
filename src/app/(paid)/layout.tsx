import { getAccount } from "@/lib/account";
import { SignInWithGoogleForCurrentPath } from "@/app/account/AccountActions";

export const dynamic = "force-dynamic";

/**
 * Gates calculator, upload, lot, recut, and history behind a signed-in user.
 * Subscription billing is optional — see /account to subscribe after trial.
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
          Sign in with Google to upload your price list and use the calculator.
          Subscription is optional — your account page has plan details.
        </p>
        <div className="max-w-sm pt-1">
          <SignInWithGoogleForCurrentPath />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
