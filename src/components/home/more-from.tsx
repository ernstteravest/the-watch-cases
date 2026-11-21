import Image from "next/image";
import Link from "@/components/ui/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/nl";
import { href, type RouteKey } from "@/i18n/routes";
import { Reveal } from "@/components/motion/reveal";
import { ChevronIcon } from "@/components/ui/icons";
import gifts from "@/assets/images/home/more-gifts.jpg";
import business from "@/assets/images/home/more-business.jpg";
import jewellers from "@/assets/images/home/more-jewellers.jpg";
import { offersSeveralModels } from "@/catalog/availability";

const cards = [
  { key: "gifts", route: "gifts", image: gifts },
  // The business card shows the closed Quartet Slim; the closed Duo while only the Duo is offered.
  { key: "business", route: "business", image: offersSeveralModels ? business : gifts },
  { key: "jewellers", route: "jewellers", image: jewellers },
] as const satisfies readonly { key: string; route: RouteKey; image: unknown }[];

/** Gifts, business gifts, jewellers: three cards on sand. */
export function MoreFrom({ locale, t }: { locale: Locale; t: Dictionary }) {
  const m = t.home.more;
  return (
    <section className="border-t border-line bg-sand">
      <div className="container-page py-section">
        <h2 className="mb-[clamp(26px,3vw,40px)] text-h2 font-bold">{m.title}</h2>
        <ul className="grid grid-cols-1 gap-x-[clamp(20px,2.4vw,32px)] gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, i) => {
            const c = m[card.key];
            return (
              <li key={card.key}>
                <Reveal delay={i * 0.08}>
                  <Link href={href(card.route, locale)} className="group flex flex-col gap-3.5">
                    <span className="block overflow-hidden rounded-card bg-walnut">
                      <Image
                        src={card.image}
                        alt={card.key === "business" && !offersSeveralModels ? m.gifts.alt : c.alt}
                        placeholder="blur"
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="aspect-[4/3] w-full object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.03]"
                      />
                    </span>
                    <strong className="text-xl">{c.title}</strong>
                    <span className="leading-relaxed text-body">{c.text}</span>
                    <span className="inline-flex min-h-9 items-center gap-2 text-[15px] font-semibold text-accent group-hover:text-accent-strong">
                      {c.link}
                      <ChevronIcon
                        size={12}
                        className="transition-transform duration-200 ease-out-soft group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
