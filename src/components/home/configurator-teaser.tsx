import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/nl";
import { href } from "@/i18n/routes";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConfiguratorTeaser({ locale, t }: { locale: Locale; t: Dictionary }) {
  const c = t.home.configurator;
  const last = c.steps.length - 1;
  return (
    <section className="border-y border-line bg-sand">
      <div className="container-page py-section">
        <Reveal className="mb-[clamp(32px,4vw,56px)] flex flex-wrap items-end justify-between gap-x-12 gap-y-5">
          <div className="flex-[1_1_420px]">
            <p className="eyebrow mb-2.5">{c.eyebrow}</p>
            <h2 className="text-[clamp(30px,3.2vw,46px)] leading-[1.08] font-bold tracking-[-0.015em]">{c.title}</h2>
          </div>
          <p className="flex-[1_1_320px] text-[17px] leading-relaxed text-body">{c.text}</p>
        </Reveal>

        <ol className="mb-[clamp(32px,4vw,48px)] grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {c.steps.map((step, i) => (
            <li key={step.title}>
              <Reveal
                delay={i * 0.08}
                className={cn("flex flex-col gap-1.5 border-t-2 pt-[18px]", i === last ? "border-accent" : "border-ink")}
              >
                <span className={cn("text-[13px] font-bold tracking-[0.1em]", i === last && "text-accent")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={cn("text-[17px] font-semibold", i === last && "text-accent")}>{step.title}</span>
                <span className="text-[15px] text-muted">{step.text}</span>
              </Reveal>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-3.5">
          <Button asChild size="lg" className="max-sm:w-full">
            <Link href={href("configure", locale)}>{c.cta}</Link>
          </Button>
          <span className="text-[15px] text-muted">{c.note}</span>
        </div>
      </div>
    </section>
  );
}
