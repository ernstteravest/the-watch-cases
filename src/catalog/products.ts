import type { StaticImageData } from "next/image";
import type { Locale } from "@/i18n/config";
import bandDuo from "@/assets/images/home/band-duo.jpg";
import bandQuartet from "@/assets/images/home/band-quartet-slim.jpg";
import duoClosed from "@/assets/images/home/more-gifts.jpg";
import duoSide from "@/assets/images/home/more-jewellers.jpg";
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

export type ProductImage = { src: StaticImageData; alt: Record<Locale, string> };

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
};

const togetherAlt = {
  nl: "De Duo en de Quartet Slim open naast elkaar op een notenhouten bureau",
  en: "The Duo and the Quartet Slim open side by side on a walnut desk",
};

export const products: readonly Product[] = [
  {
    slug: "duo",
    name: "Duo",
    capacity: 2,
    priceFromCents: null,
    engravingMaxLength: 12,
    dimensions: { length: 16, depth: 9, height: 7.5 },
    images: [
      {
        src: bandDuo,
        alt: {
          nl: "Duo horlogebox in navy leer, open, met beige suède binnenin en de initialen A.V. in het deksel",
          en: "Duo watch box in navy leather, open, beige suede inside, initials A.V. pressed into the lid",
        },
      },
      {
        src: duoSide,
        alt: {
          nl: "Een open Duo horlogebox op een notenhouten bureau, van opzij gezien",
          en: "A Duo watch box open on a walnut desk, seen from the side",
        },
      },
      {
        src: duoClosed,
        alt: {
          nl: "Een gesloten navy Duo horlogebox op een notenhouten bureau",
          en: "A closed navy Duo watch box on a walnut desk",
        },
      },
      { src: together, alt: togetherAlt },
    ],
  },
  {
    slug: "quartet-slim",
    name: "Quartet Slim",
    capacity: 4,
    priceFromCents: null,
    engravingMaxLength: 18,
    dimensions: { length: 26.5, depth: 9, height: 7.5 },
    images: [
      {
        src: bandQuartet,
        alt: {
          nl: "Quartet Slim horlogebox in zwart leer, open, met rode suède binnenin",
          en: "Quartet Slim watch box in black leather, open, red suede inside",
        },
      },
      {
        src: quartetClosed,
        alt: {
          nl: "Een gesloten zwarte Quartet Slim horlogebox op een notenhouten bureau",
          en: "A closed black Quartet Slim watch box on a walnut desk",
        },
      },
      { src: together, alt: togetherAlt },
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
