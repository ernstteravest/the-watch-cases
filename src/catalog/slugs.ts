/**
 * Product URL names. Kept in a tiny file (no images) so the proxy can use it
 * to answer unknown product URLs with a real 404.
 */
export const productSlugs = ["duo", "quartet-slim"] as const;
export type ProductSlug = (typeof productSlugs)[number];
