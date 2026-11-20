"use server";

import { isProductEnabled } from "@/catalog/availability";
import { getCatalog, type Configuration } from "@/configurator/catalog";
import { site } from "@/config/site";
import { getDictionary } from "@/i18n/get-dictionary";
import { href } from "@/i18n/routes";
import { checkoutSchema, fieldErrors, type CheckoutForm } from "@/lib/orders/checkout-schema";
import { quoteOrder, type CartLineInput, type QuoteError } from "@/lib/orders/quote";
import {
  attachPaymentReference,
  createPendingOrder,
  getPendingOrderForPayment,
  loadPriceList,
} from "@/lib/orders/repository";
import { createStripeCheckout, stripeStatus } from "@/lib/payments/stripe";
import { createAdminClient, type Db } from "@/lib/supabase/server";

/**
 * Checkout on the server. The browser sends WHAT is ordered (designs,
 * quantities, address); every amount is calculated here. No order is saved
 * unless payment can actually start.
 */

const LOGO_BUCKET = "order-logos";
const MAX_LINES = 10;

export type QuoteSummary =
  | { ok: true; subtotalCents: number; shippingCents: number; totalCents: number }
  | { ok: false; error: QuoteError | { code: "UNAVAILABLE" } };

async function shippingCosts(db: Db): Promise<Record<string, number | null>> {
  const { data, error } = await db.from("shipping_rates").select("country, price_cents").eq("active", true);
  if (error) throw new Error(`Could not load shipping rates: ${error.message}`);
  return Object.fromEntries(data.map((r) => [r.country, r.price_cents]));
}

function sanitizeLines(lines: unknown): CartLineInput[] {
  if (!Array.isArray(lines)) return [];
  return lines.slice(0, MAX_LINES).map((l) => {
    const line = l as Partial<CartLineInput>;
    return {
      configuration: line.configuration as Configuration,
      quantity: Number(line.quantity),
      logo: line.logo ?? null,
    };
  });
}

async function quote(lines: unknown, country: string) {
  const db = createAdminClient();
  if (!db) return { db: null, result: { ok: false as const, error: { code: "UNAVAILABLE" as const } } };
  const [prices, costs] = await Promise.all([loadPriceList(db), shippingCosts(db)]);
  return { db, result: quoteOrder(getCatalog(), prices, sanitizeLines(lines), { country, costs }, isProductEnabled) };
}

/** Totals for the order summary while the visitor fills in the form. */
export async function quoteCheckout(lines: unknown, country: string): Promise<QuoteSummary> {
  try {
    const { result } = await quote(lines, country);
    if (!result.ok) return result;
    const { subtotalCents, shippingCents, totalCents } = result.quote;
    return { ok: true, subtotalCents, shippingCents, totalCents };
  } catch (e) {
    console.error("[checkout] quote failed:", e);
    return { ok: false, error: { code: "UNAVAILABLE" } };
  }
}

export type PlaceOrderResult =
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "quote_error"; error: QuoteError | { code: "UNAVAILABLE" } }
  | { status: "payments_unavailable" }
  | { status: "upload_logos"; orderId: string; uploads: { line: number; original: string; preview: string }[] }
  | { status: "redirect"; url: string }
  | { status: "error" };

export async function placeOrder(form: CheckoutForm, lines: unknown, designUrls: string[]): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(form);
  if (!parsed.success) return { status: "invalid", fields: fieldErrors(parsed.error) };
  const f = parsed.data;

  try {
    const { db, result } = await quote(lines, f.shipping.country);
    if (!result.ok) return { status: "quote_error", error: result.error };
    if (!db) return { status: "quote_error", error: { code: "UNAVAILABLE" } };
    if (!stripeStatus().available) return { status: "payments_unavailable" };

    const billing = f.billingSameAsShipping ? f.shipping : f.billing!;
    const order = await createPendingOrder(db, {
      customer: { email: f.email, firstName: f.firstName, lastName: f.lastName, phone: f.phone },
      locale: f.locale,
      shippingAddress: f.shipping,
      billingAddress: { ...billing, company: f.company, vatNumber: f.vatNumber },
      quote: result.quote,
      designUrls: Array.isArray(designUrls) ? designUrls.map((u) => String(u).slice(0, 2000)) : [],
    });

    if (order.logoUploads.length > 0) {
      // One-time upload links: the browser sends the files straight to private storage.
      const uploads = [];
      for (const u of order.logoUploads) {
        const [original, preview] = await Promise.all([
          db.storage.from(LOGO_BUCKET).createSignedUploadUrl(u.original),
          db.storage.from(LOGO_BUCKET).createSignedUploadUrl(u.preview),
        ]);
        if (original.error || preview.error) throw new Error("Could not create logo upload links");
        uploads.push({ line: u.line, original: original.data.signedUrl, preview: preview.data.signedUrl });
      }
      return { status: "upload_logos", orderId: order.id, uploads };
    }
    return await startPayment(order.id);
  } catch (e) {
    console.error("[checkout] placing the order failed:", e);
    return { status: "error" };
  }
}

/** After the logos are uploaded (or straight away without logos): open Stripe Checkout. */
export async function startPayment(orderId: string): Promise<PlaceOrderResult> {
  try {
    const db = createAdminClient();
    if (!db) return { status: "error" };
    if (!stripeStatus().available) return { status: "payments_unavailable" };
    const order = await getPendingOrderForPayment(db, String(orderId));
    if (!order || order.status !== "pending_payment" || !order.customers) return { status: "error" };

    // Every logo file must be in storage before the customer can pay.
    for (const item of order.order_items) {
      for (const path of [item.logo_original_path, item.logo_preview_path]) {
        if (!path) continue;
        const folder = path.slice(0, path.lastIndexOf("/"));
        const name = path.slice(path.lastIndexOf("/") + 1);
        const { data } = await db.storage.from(LOGO_BUCKET).list(folder, { search: name });
        if (!data?.some((o) => o.name === name)) return { status: "error" };
      }
    }

    const t = await getDictionary(order.locale);
    const base = site.url;
    const session = await createStripeCheckout({
      orderId: order.id,
      orderNumber: order.order_number,
      locale: order.locale,
      email: order.customers.email,
      lines: order.order_items.map((i) => ({ name: i.product_name, quantity: i.quantity, unitAmountCents: i.unit_price_cents })),
      shipping: { label: t.cart.shipping, amountCents: order.shipping_cents },
      successUrl: `${base}${href("checkoutThanks", order.locale)}?order=${encodeURIComponent(order.order_number)}`,
      cancelUrl: `${base}${href("checkout", order.locale)}?cancelled=1`,
    });
    await attachPaymentReference(db, order.id, "stripe", session.reference);
    return { status: "redirect", url: session.redirectUrl };
  } catch (e) {
    console.error("[checkout] starting the payment failed:", e);
    return { status: "error" };
  }
}
