import type { StaticImageData } from "next/image";
import type { Locale } from "@/i18n/config";
import type { ProductSlug } from "./products";
import cognacRacingGreen from "@/assets/images/designs/cognac-racing-green.jpg";
import darkBrownSand from "@/assets/images/designs/dark-brown-sand.jpg";
import blackOranje from "@/assets/images/designs/black-oranje.jpg";

/**
 * Ready-made designs: fixed combinations customers can buy without
 * configuring. Hidden on the site while `features.readyMadeDesigns` is
 * false. To add one: add an image to src/assets/images/designs/ and an
 * entry below. The three entries are examples from the design reference.
 */
export type ReadyMadeDesign = {
  slug: string;
  model: ProductSlug;
  name: Record<Locale, string>;
  details: Record<Locale, string>;
  image: StaticImageData;
  alt: Record<Locale, string>;
  priceCents: number | null;
};

export const readyMadeDesigns: readonly ReadyMadeDesign[] = [
  {
    slug: "cognac-racing-green",
    model: "duo",
    name: { nl: "Cognac & Racing green", en: "Cognac & Racing green" },
    details: { nl: "Duo · lichtbruine stiksels", en: "Duo · tan stitch" },
    image: cognacRacingGreen,
    alt: {
      nl: "Duo horlogebox in cognac leer met racing green suède binnenin",
      en: "Duo watch box in cognac leather with racing green suede inside",
    },
    priceCents: null,
  },
  {
    slug: "dark-brown-sand",
    model: "duo",
    name: { nl: "Donkerbruin & Zand", en: "Dark brown & Sand" },
    details: { nl: "Duo · crème stiksels", en: "Duo · cream stitch" },
    image: darkBrownSand,
    alt: {
      nl: "Duo horlogebox in donkerbruin leer met beige suède binnenin",
      en: "Duo watch box in dark brown leather with beige suede inside",
    },
    priceCents: null,
  },
  {
    slug: "black-oranje",
    model: "duo",
    name: { nl: "Zwart & Oranje", en: "Black & Oranje" },
    details: { nl: "Duo · zwarte stiksels", en: "Duo · black stitch" },
    image: blackOranje,
    alt: {
      nl: "Duo horlogebox in zwart leer met oranje suède binnenin",
      en: "Duo watch box in black leather with orange suede inside",
    },
    priceCents: null,
  },
];
