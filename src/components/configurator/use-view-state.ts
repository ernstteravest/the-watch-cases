"use client";

/**
 * Camera/lid view state for the live preview: preset carousel, free 360° drag
 * and smooth transitions. Whatever this holds is passed verbatim to the
 * render, so the downloaded image shows exactly the view on screen.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { viewFromPreset, type Catalog, type ViewState } from "@/configurator/catalog";

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Shortest signed angular difference b − a in degrees. */
export const angleDelta = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;

export const clampElevation = (catalog: Catalog, elevation: number) =>
  Math.min(catalog.presentation.camera.maxElevation, Math.max(catalog.presentation.camera.minElevation, elevation));

export const useViewState = (catalog: Catalog) => {
  const [view, setView] = useState<ViewState>(() => viewFromPreset(catalog, catalog.presentation.defaultView));
  const frame = useRef<number | null>(null);
  const viewRef = useRef(view);
  // Latest view for animations that start from the current position.
  useLayoutEffect(() => {
    viewRef.current = view;
  }, [view]);

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  const animateTo = useCallback(
    (target: ViewState, durationMs = 750) => {
      stop();
      const from = viewRef.current;
      const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (reduce || durationMs <= 0) {
        setView(target);
        return;
      }
      // Reflect the chosen preset immediately (chip highlight), even before the first frame.
      setView((v) => ({ ...v, preset: target.preset }));
      const dAz = angleDelta(from.azimuth, target.azimuth);
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const k = easeInOut(t);
        setView({
          preset: target.preset,
          azimuth: (((from.azimuth + dAz * k) % 360) + 360) % 360,
          elevation: from.elevation + (target.elevation - from.elevation) * k,
          lidAngle: from.lidAngle + (target.lidAngle - from.lidAngle) * k,
        });
        frame.current = t < 1 ? requestAnimationFrame(step) : null;
      };
      frame.current = requestAnimationFrame(step);
    },
    [stop],
  );

  const showPreset = useCallback((presetId: string) => animateTo(viewFromPreset(catalog, presetId)), [animateTo, catalog]);

  const rotateBy = useCallback(
    (dAzimuth: number, dElevation: number) => {
      stop();
      setView((v) => ({
        ...v,
        azimuth: (((v.azimuth + dAzimuth) % 360) + 360) % 360,
        elevation: clampElevation(catalog, v.elevation + dElevation),
      }));
    },
    [catalog, stop],
  );

  useEffect(() => stop, [stop]);

  return { view, showPreset, rotateBy, animateTo };
};
