"use client";

import { Player, type ErrorFallback } from "@remotion/player";
import { useCallback, useMemo, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import type { Catalog, RenderProps } from "@/configurator/catalog";
import type { Labels } from "@/configurator/labels";
import { watchBoxComposition } from "@/configurator/remotion/composition";
import { SceneStatusContext, type SceneStatusApi } from "@/configurator/scene/SceneStatus";
import { cn } from "@/lib/utils";

type Texts = {
  stageLabel: string;
  dragHint: string;
  dragLabel: string;
  prevView: string;
  nextView: string;
  viewsLabel: string;
  webglTitle: string;
  webglHelp: string;
};

const Arrow = ({ dir }: { dir: "left" | "right" }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d={dir === "left" ? "M15 5 8 12l7 7" : "M9 5l7 7-7 7"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Live 3D preview: plays the configurator's still composition in a Remotion
 * <Player>, with drag/arrow-key rotation and a view carousel.
 */
export function PreviewStage({
  catalog,
  renderProps,
  notices,
  status,
  labels,
  texts,
  playerRef,
  onRotate,
  onPreset,
}: {
  catalog: Catalog;
  renderProps: RenderProps;
  notices: string[];
  status: SceneStatusApi;
  labels: Labels;
  texts: Texts;
  /** Wrapper element; the download reads the WebGL canvas inside it. */
  playerRef: RefObject<HTMLDivElement | null>;
  onRotate: (dAzimuth: number, dElevation: number) => void;
  onPreset: (presetId: string) => void;
}) {
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const views = catalog.presentation.views;
  const currentIndex = Math.max(0, views.findIndex((v) => v.id === renderProps.view.preset));
  const { center, edge } = catalog.presentation.background;

  const errorFallback: ErrorFallback = useMemo(
    () =>
      function PreviewError() {
        return (
          <div role="alert" className="grid h-full place-items-center p-8 text-center">
            <div>
              <p className="font-semibold">{texts.webglTitle}</p>
              <p className="mt-1 text-sm text-muted">{texts.webglHelp}</p>
            </div>
          </div>
        );
      },
    [texts.webglTitle, texts.webglHelp],
  );

  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);
  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!drag.current || drag.current.id !== e.pointerId) return;
      const dx = e.clientX - drag.current.x;
      const dy = e.clientY - drag.current.y;
      drag.current = { ...drag.current, x: e.clientX, y: e.clientY };
      onRotate(-dx * 0.45, dy * 0.25);
    },
    [onRotate],
  );
  const onPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  }, []);
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 15 : 5;
      const map: Record<string, [number, number]> = {
        ArrowLeft: [step, 0],
        ArrowRight: [-step, 0],
        ArrowUp: [0, step / 2],
        ArrowDown: [0, -step / 2],
      };
      const delta = map[e.key];
      if (delta) {
        e.preventDefault();
        onRotate(delta[0], delta[1]);
      }
    },
    [onRotate],
  );
  const goto = (offset: number) => onPreset(views[(currentIndex + offset + views.length) % views.length].id);

  return (
    <section
      aria-label={texts.stageLabel}
      className="relative h-full w-full overflow-hidden select-none"
      style={{ background: `radial-gradient(ellipse closest-side at 50% 48%, ${center} 0%, ${center} 30%, ${edge} 100%)` }}
    >
      <div ref={playerRef} className="absolute inset-0">
        <SceneStatusContext.Provider value={status}>
          <Player
            component={watchBoxComposition.component}
            inputProps={renderProps}
            compositionWidth={watchBoxComposition.width}
            compositionHeight={watchBoxComposition.height}
            durationInFrames={1}
            fps={30}
            controls={false}
            clickToPlay={false}
            doubleClickToFullscreen={false}
            spaceKeyToPlayOrPause={false}
            acknowledgeRemotionLicense
            errorFallback={errorFallback}
            style={{ width: "100%", height: "100%" }}
          />
        </SceneStatusContext.Provider>
      </div>

      {/* Transparent layer that turns the box on drag / arrow keys. */}
      <div
        role="application"
        tabIndex={0}
        aria-label={texts.dragLabel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="absolute inset-0 cursor-grab touch-none outline-offset-[-4px] active:cursor-grabbing"
      />

      {notices.length > 0 && (
        <div role="status" className="absolute inset-x-4 top-4 flex flex-col gap-2">
          {notices.map((n) => (
            <p key={n} className="rounded-card bg-paper/90 px-3 py-2 text-sm text-body shadow-sm">
              {n}
            </p>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => goto(-1)}
        aria-label={texts.prevView}
        className="absolute top-1/2 left-3 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-pill bg-paper/80 text-ink shadow-sm backdrop-blur hover:bg-paper"
      >
        <Arrow dir="left" />
      </button>
      <button
        type="button"
        onClick={() => goto(1)}
        aria-label={texts.nextView}
        className="absolute top-1/2 right-3 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-pill bg-paper/80 text-ink shadow-sm backdrop-blur hover:bg-paper"
      >
        <Arrow dir="right" />
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3 md:p-5">
        <p className="hidden items-center gap-2 text-sm text-muted md:flex">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <ellipse cx="12" cy="12" rx="9" ry="4" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M17.6 6.2 20 8.3l-3 .8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {texts.dragHint}
        </p>
        <nav aria-label={texts.viewsLabel} className="pointer-events-auto flex max-w-full gap-1 overflow-x-auto rounded-pill bg-paper/85 p-1 shadow-sm backdrop-blur [scrollbar-width:none]">
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={v.id === renderProps.view.preset}
              onClick={() => onPreset(v.id)}
              className={cn(
                "min-h-9 flex-none cursor-pointer rounded-pill px-3.5 text-sm font-semibold transition-colors",
                v.id === renderProps.view.preset ? "bg-ink text-paper" : "text-body hover:text-ink",
              )}
            >
              {labels.view(v.id)}
            </button>
          ))}
        </nav>
      </div>
    </section>
  );
}
