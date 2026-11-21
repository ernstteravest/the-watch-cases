"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Animation guideline: content fades up 16px once, as it scrolls into view.
 * 0.7s, soft ease-out, optional stagger via `delay`. Nothing loops, nothing
 * bounces. Uses the browser's IntersectionObserver and a CSS transition (no
 * animation library). With "reduce motion" switched on, content simply
 * appears (see globals.css); without JavaScript it is visible too.
 */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal=""
      data-shown={shown || undefined}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
      className={cn("reveal", className)}
    >
      {children}
    </div>
  );
}
