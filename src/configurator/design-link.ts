/**
 * Saves a design in the page URL, so customers can bookmark or share it
 * without an account:
 *
 *   /ontwerp?model=duo&ext=navy&int=beige&name=A.V.
 *
 * Reading is forgiving: anything unknown or no longer offered (e.g. a colour
 * removed from config/options.ts) falls back to the default instead of failing.
 * Links from before the Leather details step was removed (with `pieces=`)
 * still open; the pieces are ignored.
 *
 * A logo is an image file and can't travel in a link; customers upload it again.
 */
import { defaultConfiguration, findProduct, validateConfiguration, type Catalog, type Configuration } from "./catalog";

export type DesignState = { configuration: Configuration; name: string };

export function encodeDesign(_catalog: Catalog, { configuration, name }: DesignState): URLSearchParams {
  const params = new URLSearchParams();
  params.set("model", configuration.product);
  params.set("ext", configuration.exterior);
  params.set("int", configuration.interior);
  const trimmed = name.trim();
  if (trimmed) params.set("name", trimmed);
  return params;
}

/**
 * @param isOffered models currently on offer (the website can switch a model
 *   off); a link to another model opens with the first model on offer.
 */
export function decodeDesign(
  catalog: Catalog,
  params: URLSearchParams,
  isOffered: (productId: string) => boolean = () => true,
): DesignState {
  const model = params.get("model") ?? "";
  const fallback = isOffered(catalog.defaultProduct)
    ? catalog.defaultProduct
    : (catalog.products.find((p) => isOffered(p.id))?.id ?? catalog.defaultProduct);
  const productId = findProduct(catalog, model) && isOffered(model) ? model : fallback;
  const base = defaultConfiguration(catalog, productId);

  const candidate: Configuration = {
    ...base,
    exterior: params.get("ext") ?? base.exterior,
    interior: params.get("int") ?? base.interior,
  };

  // Try the full design, then each colour on its own.
  const attempts: Configuration[] = [
    candidate,
    { ...base, exterior: candidate.exterior },
    { ...base, interior: candidate.interior },
  ];
  const configuration = attempts.find((c) => validateConfiguration(catalog, c).ok) ?? base;

  // Length and characters are checked (and explained) by the engraving field.
  const name = (params.get("name") ?? "").slice(0, 60);
  return { configuration, name };
}
