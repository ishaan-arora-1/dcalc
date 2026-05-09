import { prisma } from "@/lib/prisma";
import { TRIAL_DAYS } from "@/lib/razorpay";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AccountSummary {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  trialDaysLeft: number;
  inTrial: boolean;
  subscription: {
    interval: "monthly" | "yearly";
    status: string;
    currentEnd: Date | null;
    razorpaySubscriptionId: string;
  } | null;
  hasAccess: boolean;
}

/**
 * Resolves the signed-in user's account state. Returns null if no user.
 *
 * Access rules:
 *   - In trial window (<= TRIAL_DAYS since profile.trialStartedAt) → access.
 *   - Razorpay subscription is `active` or `authenticated` → access.
 *   - Otherwise → no access (user must subscribe).
 */
export async function getAccount(): Promise<AccountSummary | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    include: {
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // The /auth/callback route normally creates this row; if not (e.g. user
  // was signed in before the table existed), create it here lazily.
  const created =
    profile ??
    (await prisma.profile.create({
      data: {
        id: user.id,
        email: user.email ?? "",
        name:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null,
        avatarUrl:
          (user.user_metadata?.avatar_url as string | undefined) ??
          (user.user_metadata?.picture as string | undefined) ??
          null,
      },
      include: {
        subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }));

  const trialMs = TRIAL_DAYS * 24 * 60 * 60 * 1000;
  const elapsedMs = Date.now() - created.trialStartedAt.getTime();
  const trialDaysLeft = Math.max(
    0,
    Math.ceil((trialMs - elapsedMs) / (24 * 60 * 60 * 1000)),
  );
  const inTrial = elapsedMs < trialMs;

  const sub = created.subscriptions[0] ?? null;
  const subscription = sub
    ? {
        interval: sub.interval,
        status: sub.status,
        currentEnd: sub.currentEnd,
        razorpaySubscriptionId: sub.razorpaySubscriptionId,
      }
    : null;

  const subActive =
    sub?.status === "active" || sub?.status === "authenticated";
  const hasAccess = inTrial || subActive;

  return {
    email: created.email,
    name: created.name,
    avatarUrl: created.avatarUrl,
    trialDaysLeft,
    inTrial,
    subscription,
    hasAccess,
  };
}
