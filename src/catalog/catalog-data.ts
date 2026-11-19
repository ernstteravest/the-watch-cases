import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/server";
import { products as staticProducts, type Product, type ProductSlug } from "./products";

type Commercial = { priceFromCents: number | null; active: boolean };

/**
 * Prices and availability from Supabase, cached for a few minutes. If the
 * database isn't configured or can't be reached, the values in products.ts
 * are used, so pages never break because of the database.
 */
async function getCommercialData(): Promise<Partial<Record<ProductSlug, Commercial>>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");

  const db = createPublicClient();
  if (!db) return {};
  const { data, error } = await db.from("products").select("slug, price_from_cents, active");
  if (error) {
    console.error("[catalog] Could not load products from Supabase; using built-in data.", error.message);
    return {};
  }
  return Object.fromEntries(
    data.map((row) => [row.slug, { priceFromCents: row.price_from_cents, active: row.active }]),
  ) as Partial<Record<ProductSlug, Commercial>>;
}

/** All active products, with prices from the database where available. */
export async function getProducts(): Promise<Product[]> {
  const commercial = await getCommercialData();
  const hasDbData = Object.keys(commercial).length > 0;
  return staticProducts
    .map((p) => {
      const row = commercial[p.slug];
      return row ? { ...p, priceFromCents: row.priceFromCents } : p;
    })
    // The public key only returns active products, so "missing" means "switched off".
    .filter((p) => !hasDbData || (p.slug in commercial && commercial[p.slug]?.active !== false));
}

/** One product with its current price, or null if unknown or switched off in the database. */
export async function getProductBySlug(slug: ProductSlug): Promise<Product | null> {
  return (await getProducts()).find((p) => p.slug === slug) ?? null;
}
