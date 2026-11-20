import { getCatalog, type Configuration } from "@/configurator/catalog";
import { createLabels } from "@/configurator/labels";
import { getDictionary } from "@/i18n/get-dictionary";
import { orderConfirmationEmail } from "@/lib/email/order-confirmation";
import { sendEmail } from "@/lib/email/send";
import { getOrderForConfirmation, markOrderPaid } from "@/lib/orders/repository";
import { verifyStripeSignature } from "@/lib/payments/stripe";
import { createAdminClient } from "@/lib/supabase/server";
import { describeDesign } from "@/components/configurator/describe";

/**
 * Stripe webhook. The ONLY place an order becomes "paid": after the
 * signature is verified and Stripe reports the Checkout Session as paid.
 * Configure in Stripe: endpoint https://<site>/api/webhooks/stripe with the
 * events checkout.session.completed and checkout.session.async_payment_succeeded.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Payments not configured", { status: 503 });

  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret)) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(payload) as {
    type: string;
    data: { object: { id: string; object: string; payment_status?: string } };
  };
  const paidEvent =
    event.type === "checkout.session.async_payment_succeeded" ||
    (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid");
  if (!paidEvent) return Response.json({ received: true });

  const db = createAdminClient();
  if (!db) return new Response("Database not configured", { status: 503 });

  const sessionId = event.data.object.id;
  // Idempotent: null when the order was already paid (Stripe retries webhooks).
  const paid = await markOrderPaid(db, sessionId);
  if (paid) await sendConfirmation(sessionId).catch((e) => console.error("[webhook] confirmation e-mail:", e));
  return Response.json({ received: true });
}

async function sendConfirmation(sessionId: string) {
  const db = createAdminClient();
  if (!db) return;
  const order = await getOrderForConfirmation(db, sessionId);
  if (!order?.customers) return;
  const t = await getDictionary(order.locale);
  const catalog = getCatalog();
  const labels = createLabels(catalog, order.locale);
  const lines = order.order_items.map((item) => {
    const c = item.configuration as unknown as Configuration;
    const logo = c.logo?.artwork ? { mode: c.logo.mode, color: c.logo.color, name: c.logo.artwork.name } : null;
    return {
      description: describeDesign(catalog, labels, t.configurator, c, logo),
      quantity: item.quantity,
      lineTotalCents: item.line_total_cents,
    };
  });
  await sendEmail(
    orderConfirmationEmail({
      locale: order.locale,
      to: order.customers.email,
      firstName: order.customers.first_name ?? "",
      orderNumber: order.order_number,
      lines,
      shippingCents: order.shipping_cents,
      totalCents: order.total_cents,
      requiresLogoReview: order.requires_logo_review,
    }),
  );
}
