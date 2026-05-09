import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { razorpay } from "@/lib/razorpay";

/**
 * Cancels the user's active Razorpay subscription. By default the cancel
 * takes effect at the end of the current billing cycle so they keep access
 * until the period they paid for runs out.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const sub = await prisma.subscription.findFirst({
    where: {
      profileId: user.id,
      status: { in: ["created", "authenticated", "active", "pending"] },
    },
  });
  if (!sub) {
    return NextResponse.json({ error: "No active subscription" }, { status: 404 });
  }

  await razorpay().subscriptions.cancel(sub.razorpaySubscriptionId, true);
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "cancelled" },
  });

  return NextResponse.json({ ok: true });
}
