import type { Dictionary } from "@/i18n/dictionaries/nl";
import { Reveal } from "@/components/motion/reveal";
import { TextLink } from "@/components/ui/text-link";

export function Intro({ t }: { t: Dictionary }) {
  const i = t.home.intro;
  return (
    <section id="collection" className="container-page flex scroll-mt-20 flex-wrap gap-x-24 gap-y-7 py-section">
      <Reveal className="flex-[1_1_340px]">
        <h2 className="text-h1 font-bold text-accent">
          {i.titleLine1}
          <br />
          {i.titleLine2}
        </h2>
      </Reveal>
      <Reveal delay={0.1} className="flex flex-[1.2_1_420px] flex-col gap-5">
        <p className="text-[17px] leading-[1.65] text-body md:text-lead">{i.text}</p>
        <TextLink href="#duo">{i.link}</TextLink>
      </Reveal>
    </section>
  );
}
