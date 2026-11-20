import type { StaticImageData } from "next/image";
import type { Locale } from "@/i18n/config";
import bandDuo from "@/assets/images/home/band-duo.jpg";
import bandQuartet from "@/assets/images/home/band-quartet-slim.jpg";
import duoClosed from "@/assets/images/home/more-gifts.jpg";
import quartetClosed from "@/assets/images/home/more-business.jpg";
import together from "@/assets/images/home/how-it-works.jpg";

/**
 * Watch box models. Static for now; moves to Supabase in Stage 6 behind
 * the same functions, so pages don't change.
 *
 * Prices are in euro cents. `null` = not decided yet, shown as the
 * placeholder from `site.pricePlaceholder` (€xxx.xx).
 * Dimensions are in cm, from the blueprints in the configurator catalog.
 */
import type { ProductSlug } from "./slugs";

export type { ProductSlug };

export type ProductImage = {
  src: StaticImageData;
  alt: Record<Locale, string>;
  /** The photo also shows this other model: only used while that model is on offer. */
  alsoShows?: ProductSlug;
};

export type Product = {
  slug: ProductSlug;
  name: string;
  /** Number of watches the box holds. */
  capacity: number;
  /** Lowest price incl. VAT, in cents. */
  priceFromCents: number | null;
  /** Maximum engraving length (must match the configurator catalog). */
  engravingMaxLength: number;
  /** Outer dimensions in cm. */
  dimensions: { length: number; depth: number; height: number };
  /** First image is the main one (also used on the collection page). */
  images: ProductImage[];
  /** Crop point of the main image in the full-width bands (CSS object-position), so the box stays in view. */
  bandFocus: { mobile: string; desktop: string };
};

const togetherAlt = {
  nl: "De Quartet Slim met de initialen L.M.H. en de Duo met A.V., open naast elkaar op een houten tafel",
  en: "The Quartet Slim with the initials L.M.H. and the Duo with A.V., open side by side on a wooden table",
};

export const products: readonly Product[] = [
  {
    slug: "duo",
    name: "Duo",
    capacity: 2,
    priceFromCents: null,
    engravingMaxLength: 12,
    dimensions: { length: 16, depth: 9, height: 7.5 },
    bandFocus: { mobile: "88% 50%", desktop: "72% 50%" },
    images: [
      {
        src: bandDuo,
        alt: {
          nl: "Duo horlogebox in navy leer, open, met beige suède binnenin, op een houten wandtafel",
          en: "Duo watch box in navy leather, open, with beige suede inside, on a wooden console table",
        },
      },
      {
        src: duoClosed,
        alt: {
          nl: "Een gesloten navy Duo horlogebox op een houten bureau",
          en: "A closed navy Duo watch box on a wooden desk",
        },
      },
      { src: together, alt: togetherAlt, alsoShows: "quartet-slim" },
    ],
  },
  {
    slug: "quartet-slim",
    name: "Quartet Slim",
    capacity: 4,
    priceFromCents: null,
    engravingMaxLength: 18,
    dimensions: { length: 26.5, depth: 9, height: 7.5 },
    bandFocus: { mobile: "72% 50%", desktop: "72% 50%" },
    images: [
      {
        src: bandQuartet,
        alt: {
          nl: "Quartet Slim horlogebox in zwart leer, open, met rode suède binnenin, op een eikenhouten tafel",
          en: "Quartet Slim watch box in black leather, open, with red suede inside, on an oak table",
        },
      },
      {
        src: quartetClosed,
        alt: {
          nl: "Een gesloten zwarte Quartet Slim horlogebox op een lichte eikenhouten tafel",
          en: "A closed black Quartet Slim watch box on a light oak table",
        },
      },
      { src: together, alt: togetherAlt, alsoShows: "duo" },
    ],
  },
];

export function isProductSlug(value: string): value is ProductSlug {
  return products.some((p) => p.slug === value);
}

export function getProduct(slug: ProductSlug): Product {
  const product = products.find((p) => p.slug === slug);
  if (!product) throw new Error(`Unknown product: ${slug}`);
  return product;
}
