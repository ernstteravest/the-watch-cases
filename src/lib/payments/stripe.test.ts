import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { checkoutSessionForm, stripeStatus, verifyStripeSignature } = await import("./stripe");

const secret = "whsec_test";
const sign = (payload: string, t: number, key = secret) =>
  `t=${t},v1=${createHmac("sha256", key).update(`${t}.${payload}`).digest("hex")}`;

describe("Stripe webhook signature", () => {
  const payload = JSON.stringify({ type: "checkout.session.completed" });
  const now = 1_790_000_000_000;
  const t = now / 1000;

  it("accepts a correct, recent signature", () => {
    expect(verifyStripeSignature(payload, sign(payload, t), secret, { now })).toBe(true);
  });
  it("rejects a wrong secret, a changed body, an old timestamp or a missing header", () => {
    expect(verifyStripeSignature(payload, sign(payload, t, "whsec_other"), secret, { now })).toBe(false);
    expect(verifyStripeSignature(payload + " ", sign(payload, t), secret, { now })).toBe(false);
    expect(verifyStripeSignature(payload, sign(payload, t - 600), secret, { now })).toBe(false);
    expect(verifyStripeSignature(payload, null, secret, { now })).toBe(false);
  });
});

describe("Stripe availability", () => {
  it("is off without keys and refuses live keys unless allowed", () => {
    expect(stripeStatus({})).toEqual({ available: false, reason: "not_configured" });
    expect(stripeStatus({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec" })).toEqual({ available: true });
    expect(stripeStatus({ STRIPE_SECRET_KEY: "sk_live_x", STRIPE_WEBHOOK_SECRET: "whsec" })).toEqual({
      available: false,
      reason: "live_key_blocked",
    });
    expect(
      stripeStatus({ STRIPE_SECRET_KEY: "sk_live_x", STRIPE_WEBHOOK_SECRET: "whsec", STRIPE_ALLOW_LIVE: "true" }),
    ).toEqual({ available: true });
  });
});

describe("Stripe Checkout session", () => {
  it("encodes amounts from the server quote, with shipping only when charged", () => {
    const form = checkoutSessionForm({
      orderId: "o1",
      orderNumber: "TWC-2026-0001",
      locale: "nl",
      email: "a@example.com",
      lines: [{ name: "Duo", quantity: 2, unitAmountCents: 34900 }],
      shipping: { label: "Verzending", amountCents: 0 },
      successUrl: "https://x/ok",
      cancelUrl: "https://x/cancel",
    });
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe("34900");
    expect(form.get("line_items[0][quantity]")).toBe("2");
    expect(form.get("line_items[0][price_data][currency]")).toBe("eur");
    expect(form.has("line_items[1][quantity]")).toBe(false);
    expect(form.get("metadata[order_number]")).toBe("TWC-2026-0001");
    expect(form.get("mode")).toBe("payment");
  });
});
