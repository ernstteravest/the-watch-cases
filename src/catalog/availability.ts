import { features } from "@/config/site";
import { productSlugs, type ProductSlug } from "./slugs";

/**
 * Which models are on offer right now. A switched-off model keeps all its
 * code, photos and texts; it just isn't shown, configurable or orderable.
 * Small on purpose: used by pages, the configurator, the proxy and the server.
 */
export function isProductEnabled(slug: string): slug is ProductSlug {
  if (!(productSlugs as readonly string[]).includes(slug)) return false;
  if (slug === "quartet-slim") return features.quartetSlim;
  return true;
}

export const enabledProductSlugs: ProductSlug[] = productSlugs.filter(isProductEnabled);

/** True when more than one model is on offer (texts then mention both). */
export const offersSeveralModels = enabledProductSlugs.length > 1;
