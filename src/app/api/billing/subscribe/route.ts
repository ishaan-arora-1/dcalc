import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { PLANS, TRIAL_DAYS, type PlanInterval } from "@/lib/razorpay";
import { razorpay } from "@/lib/razorpay";

/**
 * Creates a Razorpay subscription for the authenticated user. The first
 * charge is scheduled `TRIAL_DAYS` days in the future via `start_at` so the
 * user gets a free trial.
 *
 * The browser then opens Razorpay Checkout with the returned `subscriptionId`.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    interval?: PlanInterval;
  };
  const interval = body.interval;
  if (interval !== "monthly" && interval !== "yearly") {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const plan = PLANS[interval];
  if (!plan.planId) {
    return NextResponse.json(
      { error: `Plan id for ${interval} not configured on the server.` },
      { status: 500 },
    );
  }

  // If the user already has an active or pending subscription, refuse to
  // create another. They can cancel and re-subscribe instead.
  const existing = await prisma.subscription.findFirst({
    where: {
      profileId: user.id,
      status: { in: ["created", "authenticated", "active", "pending"] },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have a subscription.", subscriptionId: existing.razorpaySubscriptionId },
      { status: 409 },
    );
  }

  const startAt = Math.floor(Date.now() / 1000) + TRIAL_DAYS * 24 * 60 * 60;

  const sub = await razorpay().subscriptions.create({
    plan_id: plan.planId,
    total_count: plan.totalCount,
    customer_notify: 1,
    start_at: startAt,
    notes: {
      profile_id: user.id,
      email: user.email ?? "",
      interval,
    },
  });

  await prisma.subscription.create({
    data: {
      profileId: user.id,
      razorpaySubscriptionId: sub.id,
      razorpayPlanId: plan.planId,
      interval,
      status: "created",
    },
  });

  return NextResponse.json({
    subscriptionId: sub.id,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    plan: { interval, label: plan.label, amountPaise: plan.amountPaise },
  });
}
