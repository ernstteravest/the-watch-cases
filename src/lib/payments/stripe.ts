import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stripe Checkout through Stripe's REST API (no SDK needed).
 *
 * Switched off until the keys exist. Safety: a LIVE secret key (sk_live_…)
 * is refused unless STRIPE_ALLOW_LIVE=true is set deliberately at launch,
 * so real payments can't start by accident.
 */

export type CheckoutInput = {
  orderId: string;
  orderNumber: string;
  locale: "nl" | "en";
  email: string;
  lines: { name: string; quantity: number; unitAmountCents: number }[];
  shipping: { label: string; amountCents: number } | null;
  successUrl: string;
  cancelUrl: string;
};

export type PaymentStatus =
  | { available: true }
  | { available: false; reason: "not_configured" | "live_key_blocked" };

export function stripeStatus(env: Record<string, string | undefined> = process.env): PaymentStatus {
  const key = env.STRIPE_SECRET_KEY;
  if (!key || !env.STRIPE_WEBHOOK_SECRET) return { available: false, reason: "not_configured" };
  if (key.startsWith("sk_live_") && env.STRIPE_ALLOW_LIVE !== "true") return { available: false, reason: "live_key_blocked" };
  return { available: true };
}

/** Flattens nested objects into Stripe's form encoding: line_items[0][price_data][currency]=eur. */
export function toStripeForm(data: Record<string, unknown>, prefix = ""): URLSearchParams {
  const params = new URLSearchParams();
  const add = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) value.forEach((v, i) => add(`${key}[${i}]`, v));
    else if (typeof value === "object") for (const [k, v] of Object.entries(value)) add(`${key}[${k}]`, v);
    else params.append(key, String(value));
  };
  for (const [k, v] of Object.entries(data)) add(prefix ? `${prefix}[${k}]` : k, v);
  return params;
}

export function checkoutSessionForm(input: CheckoutInput): URLSearchParams {
  const item = (name: string, quantity: number, amount: number) => ({
    quantity,
    price_data: { currency: "eur", unit_amount: amount, product_data: { name } },
  });
  return toStripeForm({
    mode: "payment",
    customer_email: input.email,
    client_reference_id: input.orderId,
    locale: input.locale,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: { order_id: input.orderId, order_number: input.orderNumber },
    payment_intent_data: { metadata: { order_id: input.orderId, order_number: input.orderNumber } },
    line_items: [
      ...input.lines.map((l) => item(l.name, l.quantity, l.unitAmountCents)),
      ...(input.shipping && input.shipping.amountCents > 0 ? [item(input.shipping.label, 1, input.shipping.amountCents)] : []),
    ],
  });
}

export async function createStripeCheckout(input: CheckoutInput): Promise<{ reference: string; redirectUrl: string }> {
  const status = stripeStatus();
  if (!status.available) throw new Error(`Payments unavailable: ${status.reason}`);
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `checkout-${input.orderId}`,
    },
    body: checkoutSessionForm(input),
  });
  const body = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !body.id || !body.url) throw new Error(`Stripe: ${body.error?.message ?? res.status}`);
  return { reference: body.id, redirectUrl: body.url };
}

/**
 * Verifies the Stripe-Signature header of a webhook (scheme v1: HMAC-SHA256
 * of "timestamp.payload" with the endpoint secret), within a 5-minute window.
 */
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  { toleranceSeconds = 300, now = Date.now() }: { toleranceSeconds?: number; now?: number } = {},
): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim().split("=") as [string, string]);
  const timestamp = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest();
  return signatures.some((sig) => {
    const given = Buffer.from(sig, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
