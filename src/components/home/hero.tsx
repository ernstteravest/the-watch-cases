import Link from "@/components/ui/link";
import { getImageProps } from "next/image";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/nl";
import { href } from "@/i18n/routes";
import { Button } from "@/components/ui/button";
import posterDesktop from "@/assets/images/home/hero-poster.jpg";
import posterMobile from "@/assets/images/home/hero-poster-mobile.jpg";
import { HeroFilm } from "./hero-film";

/**
 * The film fully visible (4:3 on phones, wide on larger screens), with the
 * headline and buttons below it on walnut, so nothing covers the product.
 */
export function Hero({ locale, t }: { locale: Locale; t: Dictionary }) {
  const h = t.home.hero;

  const { props: desktop } = getImageProps({ src: posterDesktop, alt: "", sizes: "100vw", preload: true });
  const { props: mobile } = getImageProps({ src: posterMobile, alt: "", sizes: "100vw", preload: true });
  const poster = (
    <>
      {/* Tell the browser about the still frame straight away (it's the largest element on screen). */}
      <link rel="preload" as="image" imageSrcSet={desktop.srcSet} imageSizes="100vw" media="(min-width: 768px)" fetchPriority="high" />
      <link rel="preload" as="image" imageSrcSet={mobile.srcSet} imageSizes="100vw" media="(max-width: 767px)" fetchPriority="high" />
    <picture>
      <source media="(min-width: 768px)" srcSet={desktop.srcSet} sizes="100vw" />
      <img {...mobile} alt="" fetchPriority="high" className="absolute inset-0 size-full object-cover" />
    </picture>
    </>
  );

  return (
    <section aria-label={h.filmLabel} className="relative overflow-hidden bg-walnut-light text-paper">
      {/* The film, fully visible: 4:3 on phones, wide on larger screens. */}
      <div className="relative aspect-[4/3] overflow-hidden md:aspect-auto md:h-[clamp(420px,44vw,720px)]">
        <HeroFilm
          desktopSrc="/video/hero-film.mp4"
          mobileSrc="/video/hero-film-mobile.mp4"
          poster={poster}
          labels={{ pause: h.pause, play: h.play }}
        />
        {/* Fade the film into the walnut area with the headline below. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 -bottom-px h-2/5 bg-gradient-to-b from-transparent to-walnut-light md:h-1/4"
        />
      </div>

      <div className="container-page relative -mt-10 flex flex-col items-center gap-5 pb-12 text-center md:-mt-6 md:pb-16">
        <h1 className="text-display font-bold">
          {h.titleLine1}
          <br />
          {h.titleLine2}
        </h1>
        <div className="mt-1.5 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
          <Button asChild variant="light">
            <Link href={href("configure", locale)}>{h.primary}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={href("collection", locale)}>{h.secondary}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
