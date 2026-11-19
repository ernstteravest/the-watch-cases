import type { MetadataRoute } from "next";

/** Pre-launch: keep all crawlers out. Switch to allow "/" at launch. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
