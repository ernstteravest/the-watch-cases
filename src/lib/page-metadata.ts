import type { Metadata } from "next";
import type { Locale } from "@/i18n/config";
import { href, type RouteKey } from "@/i18n/routes";
import shareImage from "@/assets/images/home/band-duo.jpg";

/** Image shown when a page is shared (WhatsApp, LinkedIn, …), unless a page sets its own. */
export const defaultShareImage = { url: shareImage.src, width: shareImage.width, height: shareImage.height };

/** Title, description and both language versions for a page in the route table. */
export function pageMetadata(
  route: RouteKey,
  locale: Locale,
  { title, description, segments = [] }: { title: string; description?: string; segments?: string[] },
): Metadata {
  return {
    title,
    description: description || undefined,
    alternates: {
      canonical: href(route, locale, ...segments),
      languages: {
        nl: href(route, "nl", ...segments),
        en: href(route, "en", ...segments),
        "x-default": href(route, "nl", ...segments),
      },
    },
    openGraph: {
      title,
      description: description || undefined,
      url: href(route, locale, ...segments),
      images: [defaultShareImage],
    },
  };
}
