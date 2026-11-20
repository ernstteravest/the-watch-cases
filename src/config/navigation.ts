import { isProductEnabled } from "@/catalog/availability";
import { features } from "@/config/site";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/nl";
import { href } from "@/i18n/routes";

export type NavItem = { label: string; href: string };
export type NavGroup = { title: string; items: NavItem[] };

/** Main menu (the panel behind the menu icon). */
export function getMainNav(locale: Locale, t: Dictionary): { primary: NavItem[]; secondary: NavItem[] } {
  const primary: NavItem[] = [
    { label: t.nav.configure, href: href("configure", locale) },
    { label: t.nav.duo, href: href("collection", locale, "duo") },
    ...(isProductEnabled("quartet-slim") ? [{ label: t.nav.quartetSlim, href: href("collection", locale, "quartet-slim") }] : []),
    ...(features.readyMadeDesigns ? [{ label: t.nav.designs, href: href("designs", locale) }] : []),
  ];
  const secondary: NavItem[] = [
    { label: t.nav.howItsMade, href: href("howItsMade", locale) },
    { label: t.nav.gifts, href: href("gifts", locale) },
    { label: t.nav.business, href: href("business", locale) },
    { label: t.nav.jewellers, href: href("jewellers", locale) },
    { label: t.nav.about, href: href("about", locale) },
    { label: t.nav.contact, href: href("contact", locale) },
  ];
  return { primary, secondary };
}

/** Footer link columns. */
export function getFooterNav(locale: Locale, t: Dictionary): NavGroup[] {
  return [
    {
      title: t.footer.shop,
      items: [
        { label: t.nav.configure, href: href("configure", locale) },
        { label: t.nav.duo, href: href("collection", locale, "duo") },
        ...(isProductEnabled("quartet-slim") ? [{ label: t.nav.quartetSlim, href: href("collection", locale, "quartet-slim") }] : []),
        ...(features.readyMadeDesigns ? [{ label: t.nav.designs, href: href("designs", locale) }] : []),
      ],
    },
    {
      title: t.footer.about,
      items: [
        { label: t.nav.howItsMade, href: href("howItsMade", locale) },
        { label: t.nav.about, href: href("about", locale) },
        { label: t.nav.business, href: href("business", locale) },
        { label: t.nav.jewellers, href: href("jewellers", locale) },
      ],
    },
    {
      title: t.footer.help,
      items: [
        { label: t.nav.faq, href: href("faq", locale) },
        { label: t.nav.delivery, href: href("delivery", locale) },
        { label: t.nav.returns, href: href("returns", locale) },
        { label: t.nav.contact, href: href("contact", locale) },
      ],
    },
  ];
}

export function getLegalNav(locale: Locale, t: Dictionary): NavItem[] {
  return [
    { label: t.nav.terms, href: href("terms", locale) },
    { label: t.nav.privacy, href: href("privacy", locale) },
    { label: t.nav.cookies, href: href("cookies", locale) },
  ];
}
