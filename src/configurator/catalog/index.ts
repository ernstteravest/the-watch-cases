/**
 * The validated options catalog. Validation runs once, when this module is
 * first imported (configurator, Remotion Studio, render endpoint).
 */
import { options } from "../config/options";
import { CatalogValidationError, loadCatalog } from "./loadCatalog";
import type { Catalog, Result } from "./schema";

export const catalogResult: Result<Catalog> = loadCatalog(options);

if (!catalogResult.ok) {
  // Loud in every environment; the UI also renders these issues.
  console.error(new CatalogValidationError(catalogResult.issues).message);
}

/** Returns the validated catalog or throws CatalogValidationError. */
export const getCatalog = (): Catalog => {
  if (!catalogResult.ok) throw new CatalogValidationError(catalogResult.issues);
  return catalogResult.value;
};

export * from "./schema";
export * from "./configuration";
export * from "./personalization";
export * from "./logo";
export { CatalogValidationError, loadCatalog } from "./loadCatalog";
