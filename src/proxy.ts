import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale } from "@/i18n/config";
import { parsePublicPath, translatePath } from "@/i18n/routes";
import { productSlugs } from "@/catalog/slugs";

/** Internal path of a product page with an unknown slug → serve the 404 page. */
function isUnknownProduct(internalPath: string): boolean {
  const match = internalPath.match(/^\/collection\/([^/]+)\/?$/);
  return match !== null && !(productSlugs as readonly string[]).includes(match[1]);
}

const NOT_FOUND_PATH = "/_not-found-page";

/**
 * Maps public URLs onto the internal `app/[lang]/…` routes.
 *
 *   /collectie/duo     → rewrite  /nl/collection/duo   (Dutch, default, no prefix)
 *   /en/collection/duo → rewrite  /en/collection/duo   (English)
 *   /nl/…              → redirect to the unprefixed Dutch URL (one canonical URL)
 *   /design            → redirect /ontwerp (an English slug used without /en)
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/nl" || pathname.startsWith("/nl/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }

  const { locale, path } = parsePublicPath(pathname);

  if (locale === "en") {
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
  const target = isUnknownProduct(resolved) ? NOT_FOUND_PATH : resolved;
  return NextResponse.rewrite(
    new URL(`/${defaultLocale}${target === "/" ? "" : target}${request.nextUrl.search}`, request.url),
  );
}

export const config = {
  // Skip Next internals, API routes and any file with an extension (images, video, fonts, robots.txt…).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
