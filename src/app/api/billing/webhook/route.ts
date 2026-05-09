import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { SubscriptionStatus } from "@prisma/client";

export const runtime = "nodejs";

/**
 * Razorpay webhook receiver. Subscribe to the following events when you
 * register the webhook in the Razorpay dashboard:
 *   - subscription.activated
 *   - subscription.charged
 *   - subscription.completed
 *   - subscription.cancelled
 *   - subscription.halted
 *   - subscription.paused
 *   - subscription.resumed
 *   - subscription.pending
 *   - payment.failed
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const raw = await request.text();
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const event = payload.event;
  const sub = payload.payload?.subscription?.entity;
  const pay = payload.payload?.payment?.entity;

  if (sub) {
    const nextStatus = mapStatus(event, sub.status);
    await prisma.subscription.updateMany({
      where: { razorpaySubscriptionId: sub.id },
      data: {
        status: nextStatus,
        currentStart: sub.current_start ? new Date(sub.current_start * 1000) : null,
        currentEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
        endedAt: sub.ended_at ? new Date(sub.ended_at * 1000) : null,
      },
    });
  }

  if (pay && pay.id) {
    const dbSub = pay.subscription_id
      ? await prisma.subscription.findUnique({
          where: { razorpaySubscriptionId: pay.subscription_id },
        })
      : null;

    const profileId =
      dbSub?.profileId ??
      (sub?.notes && typeof sub.notes === "object"
        ? (sub.notes as Record<string, string>).profile_id
        : undefined);

    if (profileId) {
      await prisma.payment.upsert({
        where: { razorpayPaymentId: pay.id },
        create: {
          profileId,
          subscriptionId: dbSub?.id,
          razorpayPaymentId: pay.id,
          razorpayOrderId: pay.order_id ?? null,
          razorpayInvoiceId: pay.invoice_id ?? null,
          amount: pay.amount ?? 0,
          currency: pay.currency ?? "INR",
          status: pay.status ?? "unknown",
        },
        update: {
          status: pay.status ?? "unknown",
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}

function mapStatus(event: string, raw: string): SubscriptionStatus {
  // Prefer the entity's `status` field, but fall back to the event name for
  // events Razorpay fires without a status change (e.g. subscription.charged).
  const candidate = raw || eventToStatus(event);
  switch (candidate) {
    case "created":
    case "authenticated":
    case "active":
    case "pending":
    case "halted":
    case "cancelled":
    case "completed":
    case "expired":
    case "paused":
      return candidate;
    default:
      return "pending";
  }
}

function eventToStatus(event: string): string {
  if (event.endsWith(".activated")) return "active";
  if (event.endsWith(".charged")) return "active";
  if (event.endsWith(".completed")) return "completed";
  if (event.endsWith(".cancelled")) return "cancelled";
  if (event.endsWith(".halted")) return "halted";
  if (event.endsWith(".paused")) return "paused";
  if (event.endsWith(".resumed")) return "active";
  if (event.endsWith(".pending")) return "pending";
  return "";
}

interface WebhookPayload {
  event: string;
  payload?: {
    subscription?: {
      entity: {
        id: string;
        status: string;
        current_start?: number | null;
        current_end?: number | null;
        ended_at?: number | null;
        notes?: Record<string, string> | unknown;
      };
    };
    payment?: {
      entity: {
        id: string;
        order_id?: string | null;
        invoice_id?: string | null;
        subscription_id?: string | null;
        amount?: number;
        currency?: string;
        status?: string;
      };
    };
  };
}
