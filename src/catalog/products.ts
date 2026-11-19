/**
 * Watch box models. Static for now; moves to Supabase in Stage 6 behind
 * the same functions, so pages don't change.
 *
 * Prices are in euro cents. `null` = not decided yet, shown as the
 * placeholder from `site.pricePlaceholder` (€xxx.xx).
 */
export type ProductSlug = "duo" | "quartet-slim";

export type Product = {
  slug: ProductSlug;
  name: string;
  /** Number of watches the box holds. */
  capacity: number;
  /** Lowest price incl. VAT, in cents. */
  priceFromCents: number | null;
  /** Maximum engraving length (must match the configurator catalog). */
  engravingMaxLength: number;
};

export const products: readonly Product[] = [
  { slug: "duo", name: "Duo", capacity: 2, priceFromCents: null, engravingMaxLength: 12 },
  { slug: "quartet-slim", name: "Quartet Slim", capacity: 4, priceFromCents: null, engravingMaxLength: 18 },
];

export function getProduct(slug: ProductSlug): Product {
  const product = products.find((p) => p.slug === slug);
  if (!product) throw new Error(`Unknown product: ${slug}`);
  return product;
}
