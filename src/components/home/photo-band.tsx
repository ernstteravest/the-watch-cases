import Image, { type StaticImageData } from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/motion/reveal";
import { TextLink } from "@/components/ui/text-link";

type PhotoBandProps = {
  id?: string;
  image: StaticImageData;
  alt: string;
  title: string;
  subtitle: string;
  meta?: ReactNode;
  link: { label: string; href: string };
  /**
   * "product": text over the photo on every screen size.
   * "detail": on phones the photo sits above the text (close-ups crop badly).
   */
  variant?: "product" | "detail";
  /** CSS object-position per breakpoint, to keep the box in view. */
  focus?: { mobile: string; desktop: string };
};

/** Full-width dark photography with text on the left (Duo, Quartet Slim, engraving). */
export function PhotoBand({
  id,
  image,
  alt,
  title,
  subtitle,
  meta,
  link,
  variant = "product",
  focus = { mobile: "67% 46%", desktop: "72% 50%" },
}: PhotoBandProps) {
  const detail = variant === "detail";
  return (
    <article
      id={id}
      className={cn(
        "relative scroll-mt-16 overflow-hidden bg-walnut text-paper md:h-[clamp(440px,46vw,680px)]",
        detail ? "" : "h-[clamp(520px,130vw,600px)]",
      )}
      style={{ ["--focus-m" as string]: focus.mobile, ["--focus-d" as string]: focus.desktop }}
    >
      <Image
        src={image}
        alt={alt}
        placeholder="blur"
        sizes="100vw"
        className={cn(
          "object-cover object-(--focus-m) md:absolute md:inset-0 md:size-full md:object-(--focus-d)",
          detail ? "relative aspect-[22/10] w-full object-center" : "absolute inset-0 size-full",
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 md:bg-[linear-gradient(90deg,rgba(14,10,7,0.88)_0%,rgba(14,10,7,0.62)_30%,rgba(14,10,7,0.12)_52%,rgba(14,10,7,0)_66%)]",
          detail
            ? "max-md:hidden"
            : "bg-[linear-gradient(0deg,rgba(14,10,7,0.96)_0%,rgba(14,10,7,0.88)_32%,rgba(14,10,7,0.34)_60%,rgba(14,10,7,0)_82%)]",
        )}
      />
      <Reveal
        className={cn(
          "container-page relative flex flex-col gap-2 md:h-full md:justify-center md:pb-0",
          detail ? "pt-6 pb-10" : "h-full justify-end pb-11",
        )}
      >
        <h2 className="max-w-[10em] text-band font-bold">{title}</h2>
        <p className="max-w-[17em] text-band-sub font-light">{subtitle}</p>
        {meta && <p className="mt-1 text-[15px] text-on-photo-muted">{meta}</p>}
        <TextLink href={link.href} tone="light" className="mt-2.5">
          {link.label}
        </TextLink>
      </Reveal>
    </article>
  );
}
