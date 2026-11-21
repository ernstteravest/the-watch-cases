"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/components/motion/use-reduced-motion";

type HeroFilmProps = {
  /** 16:9 film for tablet and desktop. */
  desktopSrc: string;
  /** 4:3 film for phones (smaller file, box stays in frame). */
  mobileSrc: string;
  /** Still image shown until the film plays, and instead of it with "reduce motion". */
  poster: ReactNode;
  labels: { pause: string; play: string };
};

/**
 * Muted, looping background film with a pause control (WCAG 2.2.2).
 * With "reduce motion" switched on, the film does not start by itself.
 */
export function HeroFilm({ desktopSrc, mobileSrc, poster, labels }: HeroFilmProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video || reduceMotion) return;
    video.muted = true;
    video.play().catch(() => {
      /* Autoplay blocked (e.g. low-power mode): the still stays visible. */
    });
  }, [reduceMotion]);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  return (
    <>
      {poster}
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
        onPlaying={() => {
          setPlaying(true);
          setVisible(true);
        }}
        onPause={() => setPlaying(false)}
        className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
      >
        <source src={mobileSrc} type="video/mp4" media="(max-width: 767px)" />
        <source src={desktopSrc} type="video/mp4" />
      </video>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? labels.pause : labels.play}
        aria-pressed={!playing}
        className="absolute top-4 right-[var(--spacing-gutter)] z-10 grid size-10 cursor-pointer place-items-center rounded-pill border border-paper/40 text-paper/90 backdrop-blur-sm transition-colors hover:border-paper hover:text-paper"
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="4.5" width="4" height="15" rx="1" />
            <rect x="14" y="4.5" width="4" height="15" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7 4.8v14.4a.8.8 0 0 0 1.2.7l11.5-7.2a.8.8 0 0 0 0-1.4L8.2 4.1a.8.8 0 0 0-1.2.7Z" />
          </svg>
        )}
      </button>
    </>
  );
}
