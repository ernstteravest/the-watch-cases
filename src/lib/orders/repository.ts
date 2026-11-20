import "server-only";
import type { Locale } from "@/i18n/config";
import type { Db } from "@/lib/supabase/server";
import type { Json, OrderStatus } from "@/lib/supabase/database.types";
import type { PriceList, Quote } from "./quote";

/**
 * Database access for orders. Server only (uses the secret-key client).
 * Amounts always come from quoteOrder(), never from the browser.
 */

export type Address = {
  name: string;
  line1: string;
  line2?: string;
  postalCode: string;
  city: string;
  country: "NL" | "BE" | "DE";
};

export type NewOrder = {
  customer: { email: string; firstName: string; lastName: string; phone?: string };
  locale: Locale;
  shippingAddress: Address;
  billingAddress?: Address;
  quote: Quote;
  designUrls?: string[];
};

/** Current prices from the database, in the shape quoteOrder() expects. */
export async function loadPriceList(db: Db): Promise<PriceList> {
  const [products, options] = await Promise.all([
    db.from("products").select("slug, price_from_cents").eq("active", true),
    db.from("option_prices").select("product_slug, option_kind, option_id, price_delta_cents").eq("active", true),
  ]);
  if (products.error) throw new Error(`Could not load prices: ${products.error.message}`);
  if (options.error) throw new Error(`Could not load option prices: ${options.error.message}`);

  const optionMap: Record<string, Record<string, number>> = {};
  for (const o of options.data as { product_slug: string | null; option_kind: string; option_id: string; price_delta_cents: number }[]) {
    const scope = o.product_slug ?? "*";
    (optionMap[scope] ??= {})[`${o.option_kind}:${o.option_id}`] = o.price_delta_cents;
  }
  return {
    products: Object.fromEntries(products.data.map((p) => [p.slug, p.price_from_cents])),
    options: optionMap,
  };
}

/**
 * Saves a new order as "pending_payment": customer (matched by e-mail),
 * order and its items. Returns the order id and number (e.g. TWC-2026-0001).
 * If saving the items fails, the half-created order is removed again.
 */
export async function createPendingOrder(db: Db, order: NewOrder): Promise<{ id: string; orderNumber: string }> {
  const email = order.customer.email.trim().toLowerCase();
  const { data: customer, error: customerError } = await db
    .from("customers")
    .upsert(
      {
        email,
        first_name: order.customer.firstName,
        last_name: order.customer.lastName,
        phone: order.customer.phone ?? null,
      },
      { onConflict: "email" },
    )
    .select("id")
    .single();
  if (customerError) throw new Error(`Could not save customer: ${customerError.message}`);

  const { quote } = order;
  const { data: created, error: orderError } = await db
    .from("orders")
    .insert({
      customer_id: customer.id,
      locale: order.locale,
      subtotal_cents: quote.subtotalCents,
      shipping_cents: quote.shippingCents,
      total_cents: quote.totalCents,
      shipping_country: order.shippingAddress.country,
      shipping_address: order.shippingAddress as unknown as Json,
      billing_address: (order.billingAddress ?? null) as unknown as Json,
    })
    .select("id, order_number")
    .single();
  if (orderError) throw new Error(`Could not save order: ${orderError.message}`);

  const { error: itemsError } = await db.from("order_items").insert(
    quote.lines.map((line, i) => ({
      order_id: created.id,
      product_slug: line.productSlug,
      product_name: line.productName,
      quantity: line.quantity,
      unit_price_cents: line.unitPriceCents,
      line_total_cents: line.lineTotalCents,
      configuration: line.configuration as unknown as Json,
      engraving_text: line.engravingText,
      design_url: order.designUrls?.[i] ?? null,
    })),
  );
  if (itemsError) {
    await db.from("orders").delete().eq("id", created.id);
    throw new Error(`Could not save order items: ${itemsError.message}`);
  }
  return { id: created.id, orderNumber: created.order_number };
}

/** Links the payment session (e.g. Stripe Checkout) to the order. */
export async function attachPaymentReference(db: Db, orderId: string, provider: string, reference: string) {
  const { error } = await db
    .from("orders")
    .update({ payment_provider: provider, payment_reference: reference })
    .eq("id", orderId)
    .eq("status", "pending_payment");
  if (error) throw new Error(`Could not attach payment: ${error.message}`);
}

/**
 * Marks an order as paid. Call ONLY from a verified payment webhook, never
 * from a browser redirect. Idempotent: a repeated webhook changes nothing.
 */
export async function markOrderPaid(db: Db, paymentReference: string): Promise<{ orderNumber: string } | null> {
  const { data, error } = await db
    .from("orders")
    .update({ status: "paid" satisfies OrderStatus })
    .eq("payment_reference", paymentReference)
    .eq("status", "pending_payment")
    .select("order_number")
    .maybeSingle();
  if (error) throw new Error(`Could not mark order paid: ${error.message}`);
  return data ? { orderNumber: data.order_number } : null;
}

/** Everything the confirmation e-mail needs, for an order found by its payment reference. */
export async function getOrderForConfirmation(db: Db, paymentReference: string) {
  const { data, error } = await db
    .from("orders")
    .select(
      "id, order_number, locale, shipping_cents, total_cents, requires_logo_review, customers(email, first_name), order_items(product_name, quantity, line_total_cents, configuration)",
    )
    .eq("payment_reference", paymentReference)
    .maybeSingle();
  if (error) throw new Error(`Could not load order: ${error.message}`);
  return data as unknown as {
    id: string;
    order_number: string;
    locale: Locale;
    shipping_cents: number;
    total_cents: number;
    requires_logo_review: boolean;
    customers: { email: string; first_name: string | null } | null;
    order_items: { product_name: string; quantity: number; line_total_cents: number; configuration: Json }[];
  } | null;
}
