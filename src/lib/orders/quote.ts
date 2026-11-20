/**
 * Server-side price calculation for an order. The browser only sends WHAT
 * the customer wants (model, design, quantity, address country); every
 * amount is calculated here from the database prices. Pure function, so it
 * can be tested without a database.
 */
import {
  findProduct,
  validateConfiguration,
  validatePersonalization,
  type Catalog,
  type Configuration,
  type LogoFormat,
} from "@/configurator/catalog";
import { site } from "@/config/site";

/** The uploaded logo file, described (the file itself is uploaded separately). */
export type LogoFileInfo = { name: string; format: LogoFormat; width: number; height: number };

export type CartLineInput = { configuration: Configuration; quantity: number; logo?: LogoFileInfo | null };

export type PriceList = {
  /** Price per product in cents incl. VAT; null = not decided (cannot be ordered). */
  products: Record<string, number | null>;
  /** Optional surcharges, keyed "kind:optionId" (product-specific first, then "*"). */
  options?: Record<string, Record<string, number>>;
};

export type QuoteLine = {
  productSlug: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  /** The design as ordered, without the logo image itself (see logoArtwork). */
  configuration: Configuration;
  engravingText: string | null;
  /** The customer's logo file (uploaded to storage after the order is created). */
  logo: LogoFileInfo | null;
};

export type Quote = { lines: QuoteLine[]; subtotalCents: number; shippingCents: number; totalCents: number };

export type QuoteError =
  | { code: "EMPTY_CART" }
  | { code: "INVALID_QUANTITY"; line: number }
  | { code: "INVALID_DESIGN"; line: number; issues: string[] }
  | { code: "INVALID_ENGRAVING"; line: number; issues: string[] }
  | { code: "LOGO_MISSING"; line: number }
  | { code: "PRICE_NOT_SET"; line: number; product: string }
  | { code: "SHIPPING_NOT_AVAILABLE"; country: string }
  | { code: "SHIPPING_PRICE_NOT_SET"; country: string };

export const MAX_QUANTITY = 10;

function surcharge(prices: PriceList, product: string, key: string): number {
  return prices.options?.[product]?.[key] ?? prices.options?.["*"]?.[key] ?? 0;
}

/** Surcharges for one configuration (all zero at launch: options are included in the price). */
function optionSurcharges(prices: PriceList, c: Configuration): number {
  let total = surcharge(prices, c.product, `exterior:${c.exterior}`) + surcharge(prices, c.product, `interior:${c.interior}`);
  if (c.personalization.text) total += surcharge(prices, c.product, `engraving:${c.personalization.placement}`);
  if (c.logo) total += surcharge(prices, c.product, `logo:${c.logo.mode}`);
  return total;
}

export function quoteOrder(
  catalog: Catalog,
  prices: PriceList,
  lines: CartLineInput[],
  shipping: { country: string; costs: Record<string, number | null> },
): { ok: true; quote: Quote } | { ok: false; error: QuoteError } {
  if (lines.length === 0) return { ok: false, error: { code: "EMPTY_CART" } };
  if (!(site.shippingCountries as readonly string[]).includes(shipping.country)) {
    return { ok: false, error: { code: "SHIPPING_NOT_AVAILABLE", country: shipping.country } };
  }
  const shippingCents = shipping.costs[shipping.country];
  if (shippingCents === null || shippingCents === undefined) {
    return { ok: false, error: { code: "SHIPPING_PRICE_NOT_SET", country: shipping.country } };
  }

  const out: QuoteLine[] = [];
  for (const [i, line] of lines.entries()) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) {
      return { ok: false, error: { code: "INVALID_QUANTITY", line: i } };
    }
    // Engraving first, so the customer gets the specific message.
    const product = findProduct(catalog, line.configuration?.product ?? "");
    const engraving = validatePersonalization(
      String(line.configuration?.personalization?.text ?? ""),
      catalog.personalization,
      product,
    );
    if (!engraving.ok) {
      return { ok: false, error: { code: "INVALID_ENGRAVING", line: i, issues: engraving.issues.map((x) => x.message) } };
    }
    const design = validateConfiguration(catalog, line.configuration);
    if (!design.ok || !product) {
      const issues = design.ok ? ["Unknown product"] : design.issues.map((x) => x.message);
      return { ok: false, error: { code: "INVALID_DESIGN", line: i, issues } };
    }
    const base = prices.products[product.id];
    if (base === null || base === undefined) {
      return { ok: false, error: { code: "PRICE_NOT_SET", line: i, product: product.id } };
    }
    const logo = line.configuration.logo ? (line.logo ?? null) : null;
    if (line.configuration.logo && !logo) {
      return { ok: false, error: { code: "LOGO_MISSING", line: i } };
    }
    const { pieces: _legacyPieces, ...rest } = line.configuration;
    void _legacyPieces;
    // Snapshot for the order: the logo is described by its file, the image itself lives in storage.
    const configuration: Configuration = {
      ...rest,
      personalization: { ...line.configuration.personalization, text: engraving.value },
      ...(line.configuration.logo && logo ? { logo: { ...line.configuration.logo, artwork: { ...logo, dataUrl: "" } } } : {}),
    };
    const unit = base + optionSurcharges(prices, configuration);
    out.push({
      productSlug: product.id,
      productName: product.name,
      quantity: line.quantity,
      unitPriceCents: unit,
      lineTotalCents: unit * line.quantity,
      configuration,
      engravingText: engraving.value || null,
      logo,
    });
  }

  const subtotalCents = out.reduce((sum, l) => sum + l.lineTotalCents, 0);
  return { ok: true, quote: { lines: out, subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents } };
}
