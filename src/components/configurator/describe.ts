import { findProduct, type Catalog, type Configuration } from "@/configurator/catalog";
import type { Labels } from "@/configurator/labels";
import type { Dictionary } from "@/i18n/dictionaries/nl";

type Texts = Pick<Dictionary["configurator"], "summary" | "summaryName" | "logo">;
type LogoInfo = { mode: "full-color" | "one-color"; color?: string; name: string } | null | "pending";

/**
 * One line describing a design, e.g.
 * "Duo in navy leer met beige suède, met de gravering “A.V.”. Logo: één kleur, goud (acme.png)".
 * Used by the configurator summary and the cart, so both always say the same.
 */
export function describeDesign(catalog: Catalog, labels: Labels, t: Texts, c: Configuration, logo: LogoInfo): string {
  const product = findProduct(catalog, c.product);
  const text = c.personalization.text.trim();
  const base =
    t.summary
      .replace("{model}", product?.name ?? c.product)
      .replace("{exterior}", labels.color(c.exterior).toLowerCase())
      .replace("{interior}", labels.color(c.interior).toLowerCase()) + (text ? t.summaryName.replace("{name}", text) : "");
  if (!logo) return base;
  if (logo === "pending") return base + t.logo.summaryPending;
  return (
    base +
    (logo.mode === "one-color"
      ? t.logo.summaryOne.replace("{color}", labels.logoColor(logo.color ?? "")).replace("{file}", logo.name)
      : t.logo.summaryFull.replace("{file}", logo.name))
  );
}
