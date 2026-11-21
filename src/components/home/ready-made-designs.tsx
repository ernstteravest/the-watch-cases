import Image from "next/image";
import Link from "@/components/ui/link";
import { readyMadeDesigns } from "@/catalog/ready-made-designs";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/nl";
import { href } from "@/i18n/routes";
import { formatPrice } from "@/lib/format";
import { Reveal } from "@/components/motion/reveal";
import { TextLink } from "@/components/ui/text-link";

/**
 * Grid of ready-made designs. Only rendered when `features.readyMadeDesigns`
 * is on (see the homepage); the data lives in src/catalog/ready-made-designs.ts.
 */
export function ReadyMadeDesigns({ locale, t }: { locale: Locale; t: Dictionary }) {
  const shown = readyMadeDesigns.slice(0, 3);
  return (
    <section id="designs" className="container-page scroll-mt-16 py-section">
      <div className="mb-[clamp(26px,3vw,40px)] flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
        <h2 className="text-h2 font-bold">{t.home.designs.title}</h2>
        <TextLink href={href("designs", locale)}>{t.home.designs.seeAll}</TextLink>
      </div>
      <ul className="grid grid-cols-1 gap-[clamp(20px,2.4vw,32px)] sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((design, i) => (
          <li key={design.slug}>
            <Reveal delay={i * 0.08}>
              <Link href={href("designs", locale, design.slug)} className="group flex flex-col gap-3.5">
                <span className="block overflow-hidden rounded-card bg-walnut">
                  <Image
                    src={design.image}
                    alt={design.alt[locale]}
                    placeholder="blur"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="aspect-[4/3] w-full object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.03]"
                  />
                </span>
                <span className="flex items-baseline justify-between gap-4">
                  <span className="text-lg font-semibold group-hover:text-accent">{design.name[locale]}</span>
                  <span className="text-body">{formatPrice(design.priceCents, locale)}</span>
                </span>
                <span className="-mt-1.5 text-[15px] text-muted">{design.details[locale]}</span>
              </Link>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}
