"use client";

import { useEffect, useId, useRef, useState } from "react";
import { logoAcceptAttribute, type LogoArtwork, type LogoColor, type LogoRules, type Product } from "@/configurator/catalog";
import type { Labels } from "@/configurator/labels";
import { fileFromTransfer, isTextFieldTarget } from "@/configurator/logo/transfer";
import type { LogoState } from "@/configurator/logo/useLogo";
import { drawLogoTexture } from "@/configurator/scene/logo/logoArt";
import { cn } from "@/lib/utils";

export type LogoTexts = {
  none: string;
  fullColor: string;
  fullColorHelp: string;
  oneColor: string;
  oneColorHelp: string;
  dropPrompt: string;
  dropLabel: string;
  choose: string;
  replace: string;
  remove: string;
  removeBackground: string;
  backgroundWhite: string;
  backgroundBlack: string;
  keepInside: string;
  keepInsideHelp: string;
  asPrinted: string;
  reading: string;
  colour: string;
  area: string;
  showLogo: string;
  tip: string;
  notInLink: string;
};

/** Metallic colours read as foil on the chips. */
const inkFill = (c: Pick<LogoColor, "hex" | "finish">) =>
  c.finish === "metallic" ? `linear-gradient(135deg, #ffffff66 0%, transparent 45%, #00000033 100%), ${c.hex}` : c.hex;

const hexToRgb = (hex: string): [number, number, number] =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

/** The logo as printed in one colour, drawn with the same function as the 3D print. */
export function OneColourThumb({
  artwork,
  color,
  label,
  className = "max-h-24 max-w-[70%] object-contain",
}: {
  artwork: Pick<LogoArtwork, "dataUrl" | "width" | "height">;
  color: Pick<LogoColor, "hex">;
  label: string;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      const target = canvas.current;
      const ctx = target?.getContext("2d");
      if (cancelled || !target || !ctx) return;
      const art = drawLogoTexture(image, artwork.width, artwork.height, "one-color", hexToRgb(color.hex));
      target.width = artwork.width;
      target.height = artwork.height;
      ctx.clearRect(0, 0, target.width, target.height);
      ctx.drawImage(art, 0, 0);
    };
    image.src = artwork.dataUrl;
    return () => {
      cancelled = true;
    };
  }, [artwork, color.hex]);
  return <canvas ref={canvas} role="img" aria-label={label} className={className} />;
}

/**
 * The Logo step: no logo, full colour or one colour, printed in the middle of
 * the outside of the lid. Choose, paste (anywhere outside text fields) or drop
 * the file. The thumbnail on the exterior colour shows exactly what is printed.
 */
export function LogoField({
  rules,
  product,
  exteriorHex,
  state,
  artwork,
  errors,
  visibleInView,
  onModeChange,
  onColorChange,
  onRemoveBackgroundChange,
  onKeepInsideChange,
  onFile,
  onPasteWithoutImage,
  onRemove,
  onShowLogo,
  labels,
  texts,
  locale,
}: {
  rules: LogoRules;
  product: Product;
  exteriorHex: string;
  state: LogoState;
  artwork: LogoArtwork | null;
  errors: string[];
  visibleInView: boolean;
  onModeChange: (mode: LogoState["mode"]) => void;
  onColorChange: (color: string) => void;
  onRemoveBackgroundChange: (remove: boolean) => void;
  onKeepInsideChange: (keep: boolean) => void;
  onFile: (file: File) => void;
  onPasteWithoutImage: () => void;
  onRemove: () => void;
  onShowLogo: () => void;
  labels: Labels;
  texts: LogoTexts;
  locale: string;
}) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  const color = rules.colors.find((c) => c.id === state.color) ?? rules.colors[0];
  const hasError = errors.length > 0;
  const { upload } = state;
  const bg = upload?.backgroundName === "white" ? texts.backgroundWhite : upload?.backgroundName === "black" ? texts.backgroundBlack : null;
  const cm = (n: number) => n.toLocaleString(locale === "nl" ? "nl-NL" : "en-GB", { maximumFractionDigits: 1 });

  // Paste a logo anywhere on the page (text fields keep their own paste).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (isTextFieldTarget(e.target)) return;
      const file = fileFromTransfer(e.clipboardData, "paste");
      if (file) {
        e.preventDefault();
        onFile(file);
      } else if (state.mode !== "none") {
        onPasteWithoutImage();
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [onFile, onPasteWithoutImage, state.mode]);

  const modes = [
    { id: "none" as const, label: texts.none, help: "" },
    ...rules.modes.map((m) => ({
      id: m.id,
      label: m.id === "full-color" ? texts.fullColor : m.id === "one-color" ? texts.oneColor : m.label,
      help: m.id === "full-color" ? texts.fullColorHelp : m.id === "one-color" ? texts.oneColorHelp : m.description,
    })),
  ];
  const current = modes.find((m) => m.id === state.mode);

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Logo" className="inline-flex flex-wrap self-start rounded-pill border border-line-strong p-0.5">
        {modes.map((m) => (
          <label key={m.id} className="relative cursor-pointer has-[:focus-visible]:rounded-pill has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent">
            <input
              type="radio"
              name="logo-mode"
              value={m.id}
              checked={state.mode === m.id}
              onChange={() => onModeChange(m.id)}
              className="peer sr-only"
            />
            <span className="block min-h-9 rounded-pill px-3.5 py-2 text-sm font-semibold text-body peer-checked:bg-ink peer-checked:text-paper">
              {m.label}
            </span>
          </label>
        ))}
      </div>

      {state.mode === "none" || !current ? (
        <p className="text-sm text-muted">{texts.tip}</p>
      ) : (
        <>
          <p className="text-sm text-muted">{current.help}</p>

          <div
            role="group"
            aria-label={texts.dropLabel}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes("Files")) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = fileFromTransfer(e.dataTransfer, "drop");
              if (file) onFile(file);
            }}
            className={cn(
              "relative flex flex-col gap-3 rounded-card border border-dashed p-4 transition-colors",
              dragging ? "border-accent bg-sand" : "border-line-strong",
            )}
          >
            {artwork ? (
              <div className="grid h-32 place-items-center rounded-card" style={{ backgroundColor: exteriorHex }}>
                {state.mode === "one-color" ? (
                  <OneColourThumb artwork={artwork} color={color} label={`${artwork.name}, ${labels.logoColor(color.id)}`} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- local data URL preview, not an optimisable asset
                  <img src={artwork.dataUrl} alt={artwork.name} className="max-h-24 max-w-[70%] object-contain" />
                )}
              </div>
            ) : (
              <p className="text-[15px] text-body">{texts.dropPrompt}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <input
                id={`${id}-file`}
                type="file"
                accept={logoAcceptAttribute(rules)}
                disabled={state.reading}
                aria-invalid={hasError || undefined}
                aria-describedby={`${id}-help ${id}-error`}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = ""; // choosing the same file again still triggers a change
                  if (file) onFile(file);
                }}
                className="peer sr-only"
              />
              <label
                htmlFor={`${id}-file`}
                aria-disabled={state.reading}
                className="inline-flex min-h-10 cursor-pointer items-center rounded-pill border border-ink px-5 text-[15px] font-semibold hover:bg-ink hover:text-paper peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 aria-disabled:pointer-events-none aria-disabled:opacity-50"
              >
                {artwork ? texts.replace : texts.choose}
              </label>
              {artwork && (
                <>
                  <span className="min-w-0 truncate text-sm text-muted">{artwork.name}</span>
                  <button type="button" onClick={onRemove} className="text-sm font-semibold text-accent underline-offset-4 hover:underline">
                    {texts.remove}
                  </button>
                </>
              )}
            </div>

            {upload?.removed && (
              <label className="flex cursor-pointer items-start gap-2 text-[15px]">
                <input
                  type="checkbox"
                  checked={state.removeBackground}
                  onChange={(e) => onRemoveBackgroundChange(e.target.checked)}
                  className="mt-1 size-4 accent-accent"
                />
                <span>
                  {texts.removeBackground}
                  {bg ? ` (${bg})` : ""}
                </span>
              </label>
            )}
            {state.mode === "full-color" && upload?.removedKeepInside && state.removeBackground && (
              <div>
                <label className="flex cursor-pointer items-start gap-2 text-[15px]">
                  <input
                    type="checkbox"
                    checked={state.keepInside}
                    onChange={(e) => onKeepInsideChange(e.target.checked)}
                    className="mt-1 size-4 accent-accent"
                  />
                  <span>
                    {texts.keepInside}
                    {bg ? ` (${bg})` : ""}
                  </span>
                </label>
                <p className="mt-1 ml-6 text-sm text-muted">{texts.keepInsideHelp}</p>
              </div>
            )}
            {artwork && !state.reading && <p className="text-sm text-muted">{texts.asPrinted}</p>}
          </div>

          <p role="status" className="text-sm text-muted empty:hidden">
            {state.reading ? texts.reading : ""}
          </p>
          <p id={`${id}-error`} role={hasError ? "alert" : undefined} className="text-sm font-semibold text-accent empty:hidden">
            {errors.join(" ")}
          </p>

          {state.mode === "one-color" && (
            <div role="radiogroup" aria-label={texts.colour} className="flex flex-wrap gap-3">
              {rules.colors.map((c) => (
                <label key={c.id} htmlFor={`${id}-color-${c.id}`} className="group relative flex cursor-pointer flex-col items-center gap-1">
                  <input
                    id={`${id}-color-${c.id}`}
                    type="radio"
                    name="logo-color"
                    value={c.id}
                    checked={state.color === c.id}
                    onChange={() => onColorChange(c.id)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-10 rounded-pill border border-ink/15 ring-offset-2 ring-offset-paper peer-focus-visible:ring-2 peer-focus-visible:ring-accent",
                      state.color === c.id && "ring-2 ring-ink",
                    )}
                    style={{ background: inkFill(c) }}
                  />
                  <span className="text-sm">{labels.logoColor(c.id)}</span>
                </label>
              ))}
            </div>
          )}

          <p id={`${id}-help`} className="text-sm leading-relaxed text-muted">
            {texts.area
              .replace("{w}", cm(product.logo.widthCm))
              .replace("{h}", cm(product.logo.heightCm))
              .replace("{mb}", String(rules.upload.maxFileSizeMb))
              .replace("{px}", String(rules.upload.minLongestSidePx))}{" "}
            {texts.notInLink}
          </p>
          {!visibleInView && (
            <button type="button" onClick={onShowLogo} className="self-start text-sm font-semibold text-accent underline-offset-4 hover:underline">
              {texts.showLogo}
            </button>
          )}
        </>
      )}
    </div>
  );
}
