import Image from "next/image";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/nl";
import { href } from "@/i18n/routes";
import { Reveal } from "@/components/motion/reveal";
import { TextLink } from "@/components/ui/text-link";
import howItWorks from "@/assets/images/home/how-it-works.jpg";

/** "From your screen to your desk": photo next to the four order steps. */
export function Process({ locale, t }: { locale: Locale; t: Dictionary }) {
  const p = t.home.process;
  return (
    <section id="how-its-made" className="container-page flex scroll-mt-16 flex-wrap gap-[clamp(32px,4vw,72px)] py-section">
      <Reveal className="min-w-0 flex-[1_1_400px]">
        <Image
          src={howItWorks}
          alt={p.alt}
          placeholder="blur"
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="aspect-[4/3] w-full rounded-card bg-walnut object-cover"
        />
      </Reveal>
      <Reveal delay={0.1} className="flex flex-[1_1_380px] flex-col gap-6">
        <h2 className="text-h2 font-bold">{p.title}</h2>
        <ol className="flex flex-col gap-5">
          {p.steps.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span
                aria-hidden="true"
                className="grid size-[30px] flex-none place-items-center rounded-pill border border-line-strong text-sm font-bold"
              >
                {i + 1}
              </span>
              <span>
                <strong className="block text-[17px]">{step.title}</strong>
                <span className="leading-relaxed text-body">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
        <TextLink href={href("howItsMade", locale)}>{p.link}</TextLink>
      </Reveal>
    </section>
  );
}
