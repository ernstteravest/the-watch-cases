import { site } from "@/config/site";
import type { Locale } from "@/i18n/config";
import { formatPrice } from "@/lib/format";
import type { Email } from "./send";

export type ConfirmationData = {
  locale: Locale;
  to: string;
  firstName: string;
  orderNumber: string;
  lines: { description: string; quantity: number; lineTotalCents: number }[];
  shippingCents: number;
  totalCents: number;
  requiresLogoReview: boolean;
};

const copy = {
  nl: {
    subject: (n: string) => `Uw bestelling ${n} bij The Watch Cases`,
    greeting: (name: string) => `Beste ${name},`,
    thanks: "Hartelijk dank voor uw bestelling. Wij hebben uw betaling ontvangen.",
    production: `Uw horlogebox wordt op bestelling gemaakt. De productietijd is ${site.productionWorkingDays} werkdagen; u hoort van ons zodra hij onderweg is.`,
    logo: "Uw bestelling bevat een logo. Wij controleren het logo eerst en nemen contact met u op als er iets aangepast moet worden, voordat de productie begint.",
    overview: "Uw bestelling",
    shipping: "Verzending",
    free: "gratis",
    total: "Totaal (incl. btw)",
    questions: `Vragen? Beantwoord deze e-mail of schrijf naar ${site.email}.`,
    sign: "Met vriendelijke groet,\nThe Watch Cases Amsterdam",
  },
  en: {
    subject: (n: string) => `Your order ${n} at The Watch Cases`,
    greeting: (name: string) => `Dear ${name},`,
    thanks: "Thank you for your order. We have received your payment.",
    production: `Your watch box is made to order. Production takes ${site.productionWorkingDays} working days; we’ll let you know when it’s on its way.`,
    logo: "Your order includes a logo. We check the logo first and will contact you if anything needs adjusting before production starts.",
    overview: "Your order",
    shipping: "Shipping",
    free: "free",
    total: "Total (incl. VAT)",
    questions: `Questions? Reply to this e-mail or write to ${site.email}.`,
    sign: "Kind regards,\nThe Watch Cases Amsterdam",
  },
} as const;

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Order confirmation, sent only after a verified payment. Plain text plus simple HTML. */
export function orderConfirmationEmail(d: ConfirmationData): Email {
  const c = copy[d.locale];
  const price = (cents: number) => formatPrice(cents, d.locale);
  const shipping = d.shippingCents === 0 ? c.free : price(d.shippingCents);
  const paragraphs = [c.thanks, c.production, ...(d.requiresLogoReview ? [c.logo] : [])];

  const text = [
    c.greeting(d.firstName),
    "",
    ...paragraphs.flatMap((p) => [p, ""]),
    `${c.overview} ${d.orderNumber}`,
    ...d.lines.map((l) => `${l.quantity} × ${l.description} — ${price(l.lineTotalCents)}`),
    `${c.shipping}: ${shipping}`,
    `${c.total}: ${price(d.totalCents)}`,
    "",
    c.questions,
    "",
    c.sign,
  ].join("\n");

  const rows = d.lines
    .map(
      (l) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #ece8e3">${l.quantity} × ${escape(l.description)}</td>` +
        `<td style="padding:8px 0;border-bottom:1px solid #ece8e3;text-align:right;white-space:nowrap">${price(l.lineTotalCents)}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="${d.locale}"><body style="margin:0;background:#f7f4f0;font-family:Helvetica,Arial,sans-serif;color:#15120f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:3px" cellpadding="0" cellspacing="0"><tr><td style="padding:32px">
<p style="margin:0 0 24px;letter-spacing:.26em;font-size:14px;text-align:center">THE WATCH CASES</p>
<p>${escape(c.greeting(d.firstName))}</p>
${paragraphs.map((p) => `<p style="line-height:1.6;color:#4f4943">${escape(p)}</p>`).join("")}
<h2 style="font-size:16px;margin:28px 0 8px">${escape(c.overview)} ${escape(d.orderNumber)}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}
<tr><td style="padding:8px 0">${escape(c.shipping)}</td><td style="padding:8px 0;text-align:right">${escape(shipping)}</td></tr>
<tr><td style="padding:8px 0;font-weight:bold">${escape(c.total)}</td><td style="padding:8px 0;text-align:right;font-weight:bold">${price(d.totalCents)}</td></tr></table>
<p style="margin-top:28px;line-height:1.6;color:#4f4943">${escape(c.questions)}</p>
<p style="white-space:pre-line;color:#4f4943">${escape(c.sign)}</p>
</td></tr></table></td></tr></table></body></html>`;

  return { to: d.to, subject: c.subject(d.orderNumber), text, html, replyTo: site.email };
}
