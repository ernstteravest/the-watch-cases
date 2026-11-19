/**
 * Supported languages. Dutch is the default and has no URL prefix
 * (thewatchcases.nl/…); English lives under /en/….
 */
export const locales = ["nl", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "nl";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** BCP 47 tags for <html lang>, Intl formatting and Open Graph. */
export const localeTags: Record<Locale, string> = {
  nl: "nl-NL",
  en: "en-GB",
};
