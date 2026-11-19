import { options } from "../config/options";
import { getCatalog } from "../catalog";
import type { CatalogInput } from "../catalog/schema";

/** A deep, mutable copy of the shipped options for building invalid catalogs. */
export const cloneOptions = (): CatalogInput => structuredClone(options) as CatalogInput;

export const catalog = getCatalog();

export const product = (id: string) => {
  const p = catalog.products.find((x) => x.id === id);
  if (!p) throw new Error(`no product ${id}`);
  return p;
};
