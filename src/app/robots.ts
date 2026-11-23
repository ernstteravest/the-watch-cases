import type { MetadataRoute } from "next";
import { site } from "@/config/site";

/** Pre-launch: all crawlers out. At launch set NEXT_PUBLIC_ALLOW_INDEXING=true on Vercel. */
export default function robots(): MetadataRoute.Robots {
  if (!site.allowIndexing) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/beheer", "/winkelmand", "/afrekenen", "/en/cart", "/en/checkout"] },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
