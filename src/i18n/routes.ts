/**
 * One table for every public URL in both languages.
 *
 * Internally (in `src/app/[lang]/…`) every route uses the English path.
 * The proxy rewrites Dutch public paths to those internal paths, and the
 * language switch uses the same table to find the matching page in the
 * other language. Add a page here once and both work.
 *
 * Dynamic routes (e.g. /collection/duo) are matched by prefix: only the
 * listed part is translated, the rest of the path (the slug) is kept.
 */
import { defaultLocale, type Locale } from "./config";

export const routes = {
  home: { nl: "/", en: "/" },
  configure: { nl: "/ontwerp", en: "/design" },
  collection: { nl: "/collectie", en: "/collection" },
  designs: { nl: "/ontwerpen", en: "/designs" },
  howItsMade: { nl: "/zo-wordt-het-gemaakt", en: "/how-its-made" },
  about: { nl: "/over-ons", en: "/about" },
  amsterdam: { nl: "/amsterdam", en: "/amsterdam" },
  gifts: { nl: "/cadeaus", en: "/gifts" },
  business: { nl: "/zakelijk", en: "/business" },
  jewellers: { nl: "/juweliers", en: "/jewellers" },
  faq: { nl: "/veelgestelde-vragen", en: "/faq" },
  delivery: { nl: "/verzending", en: "/delivery" },
  returns: { nl: "/retour-en-garantie", en: "/returns-and-warranty" },
  contact: { nl: "/contact", en: "/contact" },
  terms: { nl: "/voorwaarden", en: "/terms" },
  privacy: { nl: "/privacy", en: "/privacy" },
  cookies: { nl: "/cookies", en: "/cookies" },
  cart: { nl: "/winkelmand", en: "/cart" },
  checkout: { nl: "/afrekenen", en: "/checkout" },
  checkoutThanks: { nl: "/afrekenen/bedankt", en: "/checkout/thank-you" },
  styleguide: { nl: "/stijlgids", en: "/styleguide" },
} as const satisfies Record<string, Record<Locale, string>>;

export type RouteKey = keyof typeof routes;

const routeEntries = Object.values(routes) as Record<Locale, string>[];

/** Prefix the path for non-default locales: "/design" → "/en/design". */
function withLocalePrefix(path: string, locale: Locale): string {
  if (locale === defaultLocale) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Public URL for a route, e.g. href("collection", "nl", "duo") → "/collectie/duo". */
export function href(key: RouteKey, locale: Locale, ...segments: string[]): string {
  const base = routes[key][locale];
  const rest = segments.map(encodeURIComponent).join("/");
  const path = rest ? `${base === "/" ? "" : base}/${rest}` : base;
  return withLocalePrefix(path, locale);
}

/**
 * Translate a path (without locale prefix) from one language's slugs to
 * another's. Matches whole segments only, longest prefix first.
 * Returns null when no route in the table matches.
 */
export function translatePath(path: string, from: Locale, to: Locale): string | null {
  if (path === "/" || path === "") return "/";
  const candidates = routeEntries
    .filter((r) => r[from] !== "/")
    .sort((a, b) => b[from].length - a[from].length);
  for (const route of candidates) {
    const prefix = route[from];
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return route[to] + path.slice(prefix.length);
    }
  }
  return null;
}

/** Split a public pathname into its locale and the path without prefix. */
export function parsePublicPath(pathname: string): { locale: Locale; path: string } {
  const match = pathname.match(/^\/(en)(\/.*)?$/);
  if (match) return { locale: "en", path: match[2] || "/" };
  return { locale: defaultLocale, path: pathname || "/" };
}

/** The same page in another language, used by the language switch. */
export function switchLocalePath(pathname: string, to: Locale): string {
  const { locale, path } = parsePublicPath(pathname);
  if (locale === to) return pathname;
  const translated = translatePath(path, locale, to) ?? "/";
  return withLocalePrefix(translated, to);
}
