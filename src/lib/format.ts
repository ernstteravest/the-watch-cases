import { site } from "@/config/site";
import { localeTags, type Locale } from "@/i18n/config";

/** €349 / €349,50 in the visitor's language; the placeholder when no price is set yet. */
export function formatPrice(cents: number | null, locale: Locale): string {
  if (cents === null) return site.pricePlaceholder;
  return new Intl.NumberFormat(localeTags[locale], {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
