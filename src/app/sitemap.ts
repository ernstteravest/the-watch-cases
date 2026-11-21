import type { MetadataRoute } from "next";
import { enabledProductSlugs } from "@/catalog/availability";
import { site } from "@/config/site";
import { href, type RouteKey } from "@/i18n/routes";

/** Public pages in both languages, with their language versions. Cart, checkout and internal pages are left out. */
const PAGES: RouteKey[] = [
  "home",
  "collection",
  "configure",
  "howItsMade",
  "about",
  "amsterdam",
  "gifts",
  "business",
  "jewellers",
  "faq",
  "delivery",
  "returns",
  "contact",
  "terms",
  "privacy",
  "cookies",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entry = (route: RouteKey, ...segments: string[]): MetadataRoute.Sitemap[number] => ({
    url: `${site.url}${href(route, "nl", ...segments)}`,
    alternates: {
      languages: {
        nl: `${site.url}${href(route, "nl", ...segments)}`,
        en: `${site.url}${href(route, "en", ...segments)}`,
      },
    },
  });
  return [...PAGES.map((p) => entry(p)), ...enabledProductSlugs.map((slug) => entry("collection", slug))];
}
