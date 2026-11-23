import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale } from "@/i18n/config";
import { parsePublicPath, translatePath } from "@/i18n/routes";
import { isProductEnabled } from "@/catalog/availability";
import { productSlugs } from "@/catalog/slugs";
import { beheerProxy } from "@/lib/admin/proxy";
import { isBeheerPath } from "@/lib/admin/session-rules";

/** Internal path of a product page with an unknown slug → serve the 404 page. */
function isUnknownProduct(internalPath: string): boolean {
  const match = internalPath.match(/^\/collection\/([^/]+)\/?$/);
  return match !== null && !(productSlugs as readonly string[]).includes(match[1]);
}

const NOT_FOUND_PATH = "/_not-found-page";

/** A known model that is switched off right now (features in config/site.ts). */
function switchedOffProduct(internalPath: string): boolean {
  const match = internalPath.match(/^\/collection\/([^/]+)\/?$/);
  return match !== null && (productSlugs as readonly string[]).includes(match[1]) && !isProductEnabled(match[1]);
}

/** Temporary redirect (307): the page returns when the model is switched on again. */
function toCollection(request: NextRequest, locale: "nl" | "en") {
  const url = request.nextUrl.clone();
  url.pathname = locale === "en" ? "/en/collection" : "/collectie";
  url.search = "";
  return NextResponse.redirect(url, 307);
}

/**
 * Maps public URLs onto the internal `app/[lang]/…` routes.
 *
 *   /collectie/duo     → rewrite  /nl/collection/duo   (Dutch, default, no prefix)
 *   /en/collection/duo → rewrite  /en/collection/duo   (English)
 *   /nl/…              → redirect to the unprefixed Dutch URL (one canonical URL)
 *   /design            → redirect /ontwerp (an English slug used without /en)
 *   /beheer/…          → management environment (see lib/admin/proxy.ts)
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The management environment has its own rules (login, MFA, strict CSP)
  // and is never treated as a language page.
  if (isBeheerPath(pathname)) return beheerProxy(request);

  if (pathname === "/nl" || pathname.startsWith("/nl/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }

  const { locale, path } = parsePublicPath(pathname);

  if (locale === "en") {
    if (switchedOffProduct(path)) return toCollection(request, "en");
    const target = isUnknownProduct(path) ? NOT_FOUND_PATH : path;
    return NextResponse.rewrite(new URL(`/en${target === "/" ? "" : target}${request.nextUrl.search}`, request.url));
  }

  // Dutch: translate Dutch slugs to the internal (English) folder names.
  const internal = translatePath(path, "nl", "en");
  if (internal === null) {
    // An English slug without /en (e.g. /design): send to its Dutch URL.
    const dutch = translatePath(path, "en", "nl");
    if (dutch !== null && dutch !== path) {
      const url = request.nextUrl.clone();
      url.pathname = dutch;
      return NextResponse.redirect(url, 308);
    }
  }

  const resolved = internal ?? path;
  if (switchedOffProduct(resolved)) return toCollection(request, "nl");
  const target = isUnknownProduct(resolved) ? NOT_FOUND_PATH : resolved;
  return NextResponse.rewrite(
    new URL(`/${defaultLocale}${target === "/" ? "" : target}${request.nextUrl.search}`, request.url),
  );
}

export const config = {
  // Skip Next internals, API routes and any file with an extension (images, video, fonts, robots.txt…).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
