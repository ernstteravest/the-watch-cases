"use client";

import Image, { type StaticImageData } from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

type GalleryImage = { src: StaticImageData; alt: string };

/** One large photo with thumbnails below. Thumbnails are real buttons (keyboard and screen reader friendly). */
export function ProductGallery({ images, label }: { images: GalleryImage[]; label: string }) {
  const [active, setActive] = useState(0);
  const current = images[active];

  return (
    <section aria-label={label} className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-card bg-walnut">
        <Image
          key={current.src.src}
          src={current.src}
          alt={current.alt}
          placeholder="blur"
          preload={active === 0}
          sizes="(min-width: 1024px) 56vw, 100vw"
          className="aspect-[4/3] w-full animate-[fade-in_400ms_ease-out] object-cover object-[70%_50%]"
        />
      </div>
      {images.length > 1 && (
        <ul className="grid grid-cols-4 gap-3">
          {images.map((image, i) => (
            <li key={image.src.src}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={image.alt}
                aria-current={i === active ? "true" : undefined}
                className={cn(
                  "block w-full cursor-pointer overflow-hidden rounded-card bg-walnut ring-offset-2 transition-opacity",
                  i === active ? "ring-2 ring-accent" : "opacity-70 hover:opacity-100",
                )}
              >
                <Image
                  src={image.src}
                  alt=""
                  sizes="(min-width: 1024px) 13vw, 25vw"
                  className="aspect-[4/3] w-full object-cover object-[70%_50%]"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
