import type { Product } from "@/catalog/products";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/nl";

/** Spec list. Every value here is confirmed business information. */
export function ProductSpecs({ product, locale, t }: { product: Product; locale: Locale; t: Dictionary }) {
  const s = t.product.specs;
  const num = (n: number) => n.toLocaleString(locale === "nl" ? "nl-NL" : "en-GB");
  const { length, depth, height } = product.dimensions;
  const rows: [string, string][] = [
    [s.capacity, t.collection.capacity.replace("{count}", String(product.capacity))],
    [s.dimensions, s.dimensionsValue.replace("{l}", num(length)).replace("{w}", num(depth)).replace("{h}", num(height))],
    [s.exterior, s.exteriorValue],
    [s.interior, s.interiorValue],
    [s.cushions, s.cushionsValue],
    [s.engraving, s.engravingValue.replace("{max}", String(product.engravingMaxLength))],
    [s.production, s.productionValue],
    [s.shipping, s.shippingValue],
    [s.warranty, s.warrantyValue],
  ];
  return (
    <section aria-labelledby="details-title">
      <h2 id="details-title" className="eyebrow mb-4">
        {t.product.detailsTitle}
      </h2>
      <dl className="border-t border-line">
        {rows.map(([term, value]) => (
          <div key={term} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 border-b border-line py-3 text-[15px]">
            <dt className="font-semibold">{term}</dt>
            <dd className="text-body">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
