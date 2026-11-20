import { z } from "zod";

/**
 * Checkout form rules, checked on the server (the browser only helps).
 * Error messages are codes; the page shows them in the visitor's language.
 */
export const SHIPPING_COUNTRIES = ["NL", "BE", "DE"] as const;

const POSTCODE: Record<(typeof SHIPPING_COUNTRIES)[number], RegExp> = {
  NL: /^\d{4}\s?[A-Za-z]{2}$/,
  BE: /^\d{4}$/,
  DE: /^\d{5}$/,
};

const text = (max: number) => z.string().trim().min(1, "required").max(max, "too_long");
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "too_long")
    .optional()
    .transform((v) => v || undefined);

const address = z
  .object({
    name: text(120),
    line1: text(120),
    line2: optional(120),
    postalCode: text(12),
    city: text(80),
    country: z.enum(SHIPPING_COUNTRIES, { message: "country" }),
  })
  .superRefine((a, ctx) => {
    if (!POSTCODE[a.country].test(a.postalCode)) ctx.addIssue({ code: "custom", path: ["postalCode"], message: "postcode" });
  });

export const checkoutSchema = z
  .object({
    locale: z.enum(["nl", "en"]),
    email: z.string().trim().toLowerCase().max(254, "too_long").email("email"),
    firstName: text(60),
    lastName: text(80),
    phone: optional(30).refine((v) => !v || /^[+()\d\s-]{6,30}$/.test(v), "phone"),
    shipping: address,
    billingSameAsShipping: z.boolean(),
    billing: address.optional(),
    company: optional(120),
    vatNumber: optional(20)
      .transform((v) => v?.replace(/[\s.]/g, "").toUpperCase())
      .refine((v) => !v || /^[A-Z]{2}[0-9A-Z]{8,12}$/.test(v), "vat"),
    acceptTerms: z.literal(true, { message: "terms" }),
  })
  // Runs even when other fields are wrong, so the visitor sees every problem at once.
  .refine((f) => f.billingSameAsShipping || Boolean(f.billing), {
    path: ["billing", "line1"],
    message: "required",
    when: () => true,
  });

export type CheckoutForm = z.input<typeof checkoutSchema>;
export type ValidCheckout = z.output<typeof checkoutSchema>;

/** Field errors as { "shipping.postalCode": "postcode", … }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
