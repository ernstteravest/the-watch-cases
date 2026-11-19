import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import {
  BagIcon,
  ClockIcon,
  EngraveIcon,
  MenuIcon,
  PinIcon,
  ShieldIcon,
  TruckIcon,
} from "@/components/ui/icons";
import { TextLink } from "@/components/ui/text-link";
import bandDuo from "@/assets/images/home/band-duo.jpg";

export const metadata: Metadata = { title: "Style guide", robots: { index: false, follow: false } };

/**
 * Internal page showing the design system (Stage 2 review).
 * Not linked from the site; remove or keep private before launch.
 */
const colors = [
  ["ink", "#15120F", "bg-ink"],
  ["body", "#4F4943", "bg-body"],
  ["muted", "#6B645C", "bg-muted"],
  ["accent", "#7B4322", "bg-accent"],
  ["sand", "#F7F4F0", "bg-sand"],
  ["line", "#ECE8E3", "bg-line"],
  ["line-strong", "#DCD5CC", "bg-line-strong"],
  ["espresso", "#1E1611", "bg-espresso"],
  ["walnut", "#241812", "bg-walnut"],
  ["cream", "#F3EEE8", "bg-cream"],
  ["cream-muted", "#CFC6BC", "bg-cream-muted"],
] as const;

function Block({ title, children, tone = "paper" }: { title: string; children: React.ReactNode; tone?: "paper" | "sand" }) {
  return (
    <section className={tone === "sand" ? "border-y border-line bg-sand" : undefined}>
      <div className="container-page py-section-sm">
        <h2 className="eyebrow mb-8">{title}</h2>
        {children}
      </div>
    </section>
  );
}

export default async function StyleguidePage({ params }: PageProps<"/[lang]/styleguide">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <>
      <Block title="Colour">
        <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
          {colors.map(([name, hex, cls]) => (
            <li key={name} className="flex flex-col gap-2">
              <span className={`${cls} aspect-[4/3] rounded-card border border-line`} />
              <span className="text-[15px] font-semibold">{name}</span>
              <span className="-mt-1.5 text-sm text-muted">{hex}</span>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Typography — Archivo" tone="sand">
        <div className="flex flex-col gap-8">
          <p className="text-display font-bold">Designed by you, made for you</p>
          <p className="text-h1 font-bold text-accent">Explore the collection</p>
          <p className="text-h2 font-bold">Three choices, then your name</p>
          <p className="text-h3 font-bold">New leathers, now and then</p>
          <p className="max-w-3xl text-lead text-body">
            Lead text, 19px / 1.65. Two leather watch boxes: the Duo for two watches and the Quartet Slim for four.
          </p>
          <p className="max-w-3xl text-base text-body">Body text, 16px / 1.6, for longer descriptions and steps.</p>
          <p className="text-[15px] text-muted">Secondary text, 15px, muted.</p>
          <p className="eyebrow">Eyebrow label</p>
        </div>
      </Block>

      <Block title="Buttons and links">
        <div className="flex flex-wrap items-center gap-4">
          <Button size="lg">Open the configurator</Button>
          <Button size="sm">Design yours</Button>
          <Button variant="dark" size="md">
            Sign up
          </Button>
          <TextLink href="#">Find your box</TextLink>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-4 rounded-card bg-walnut p-8">
          <Button variant="light">Design your watch box</Button>
          <Button variant="outline">See the collection</Button>
          <TextLink href="#" tone="light">
            Discover more
          </TextLink>
        </div>
      </Block>

      <Block title="Icons" tone="sand">
        <div className="flex flex-wrap gap-6 text-ink">
          <MenuIcon />
          <PinIcon />
          <BagIcon />
          <EngraveIcon className="text-accent" />
          <ClockIcon className="text-accent" />
          <TruckIcon className="text-accent" />
          <ShieldIcon className="text-accent" />
        </div>
      </Block>

      <Block title="Photography and motion">
        <Reveal>
          <figure className="relative overflow-hidden rounded-card bg-walnut">
            <Image
              src={bandDuo}
              alt="Duo watch box in navy leather, open, beige suede inside"
              placeholder="blur"
              sizes="(min-width: 1440px) 1312px, 100vw"
              className="aspect-[22/10] w-full object-cover"
            />
          </figure>
          <figcaption className="mt-3 text-sm text-muted">
            next/image: resized per screen, served as AVIF/WebP, blurred placeholder while loading, fades in on scroll.
          </figcaption>
        </Reveal>
      </Block>
    </>
  );
}
