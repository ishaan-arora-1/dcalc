import Razorpay from "razorpay";

export const TRIAL_DAYS = 30;

export type PlanInterval = "monthly" | "yearly";

export interface PlanConfig {
  interval: PlanInterval;
  planId: string;
  amountPaise: number;
  label: string;
  totalCount: number;
}

export const PLANS: Record<PlanInterval, PlanConfig> = {
  monthly: {
    interval: "monthly",
    planId: process.env.RAZORPAY_PLAN_ID_MONTHLY ?? "",
    amountPaise: 9900,
    label: "₹99 / month",
    totalCount: 120,
  },
  yearly: {
    interval: "yearly",
    planId: process.env.RAZORPAY_PLAN_ID_YEARLY ?? "",
    amountPaise: 79900,
    label: "₹799 / year",
    totalCount: 10,
  },
};

let _client: Razorpay | null = null;

export function razorpay(): Razorpay {
  if (_client) return _client;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
    );
  }
  _client = new Razorpay({ key_id, key_secret });
  return _client;
}
