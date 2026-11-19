/**
 * Business settings in one place. Values marked TODO are not decided yet
 * and must not be presented as fact on the site.
 */
export const site = {
  name: "The Watch Cases Amsterdam",
  shortName: "The Watch Cases",
  domain: "thewatchcases.nl",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  email: "thewatchcases@gmail.com",
  city: "Amsterdam",
  country: "NL",

  /** Countries we ship to (ISO 3166-1 alpha-2). Checkout only accepts these. */
  shippingCountries: ["NL", "BE", "DE"] as const,

  /** Production time in working days, from order to dispatch. */
  productionWorkingDays: 14,

  /** Warranty period in years. */
  warrantyYears: 1,

  /** Placeholder shown wherever a price is not decided yet. */
  pricePlaceholder: "€xxx.xx",

  social: {
    instagram: null as string | null, // TODO: handle not decided
    linkedin: null as string | null, // TODO: page not decided
  },

  /** Payment methods shown in the footer. Only shown once payments are live. */
  paymentMethods: ["iDEAL", "Bancontact", "Visa", "Mastercard", "Apple Pay"],
} as const;

/**
 * Feature switches. Turning a feature on shows its links, sections and
 * pages; the code and data structures exist either way.
 */
export const features = {
  /** Ready-made designs: hidden until the designs and prices are final. */
  readyMadeDesigns: false,
  /** Payments: stays false until Stripe is configured and approved. */
  payments: false,
  /** Newsletter sign-up: form is shown but not yet connected to a mailing service. */
  newsletter: true,
} as const;
