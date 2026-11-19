/**
 * Asset loading with explicit failure reporting.
 *
 * Policy:
 *  • live preview  → fall back (fallback font / built-in studio) and show a warning;
 *  • final render  → fail the render with a clear message, so a customer never
 *                    receives an image that differs from what they approved.
 */
import { staticFile } from "remotion";
import type { DataTexture } from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import type { PersonalizationRules } from "../catalog/schema";

export type AssetKind = "font" | "hdri" | "environment" | "texture";

export class AssetLoadError extends Error {
  readonly code = "ASSET_LOAD_FAILED";
  constructor(
    public readonly asset: AssetKind,
    public readonly url: string,
    cause: unknown,
  ) {
    super(`[ASSET_LOAD_FAILED] Could not load ${asset} "${url}": ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "AssetLoadError";
  }
}

export type AssetFailurePolicy = "fail" | "fallback";

export const assetFailurePolicy = (isRendering: boolean): AssetFailurePolicy => (isRendering ? "fail" : "fallback");

/**
 * Resolves a path inside public/ for Remotion Studio, renders and the configurator app alike.
 * Outside Remotion (the configurator page, including the hosted preview served from a
 * sub-path) files are resolved against the page URL instead of the site root.
 */
export const publicUrl = (path: string): string => {
  const w = typeof window === "undefined" ? undefined : (window as Window & { remotion_staticBase?: string });
  if (w && !w.remotion_staticBase && typeof document !== "undefined") {
    return new URL(path.replace(/^\/+/, ""), document.baseURI).href;
  }
  return staticFile(path);
};

type FontRules = PersonalizationRules["font"];

const fontLoads = new Map<string, Promise<void>>();

/** CSS family list for the engraving: bundled face first, then the configured fallback. */
export const engravingFontStack = (font: FontRules, useFallbackOnly = false): string =>
  useFallbackOnly ? font.fallback : `"${font.family}", ${font.fallback}`;

/** Loads (once) the bundled engraving font faces. Rejects with AssetLoadError. */
export const loadEngravingFont = (font: FontRules, resolve: (path: string) => string = publicUrl): Promise<void> => {
  const key = `${font.family}/${font.weight}/${font.files.map((f) => f.path).join(",")}`;
  const existing = fontLoads.get(key);
  if (existing) return existing;
  if (typeof FontFace === "undefined" || typeof document === "undefined") {
    return Promise.reject(new AssetLoadError("font", font.files[0].path, new Error("FontFace API unavailable")));
  }
  const promise = Promise.all(
    font.files.map(async (file) => {
      const url = resolve(file.path);
      try {
        // Fetched explicitly so an HTTP failure surfaces as a clear error.
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.arrayBuffer();
        const face = new FontFace(font.family, data, {
          weight: String(font.weight),
          ...(file.unicodeRange ? { unicodeRange: file.unicodeRange } : {}),
        });
        const loaded = await face.load();
        document.fonts.add(loaded);
      } catch (e) {
        throw new AssetLoadError("font", file.path, e);
      }
    }),
  ).then(() => undefined);
  fontLoads.set(key, promise);
  promise.catch(() => fontLoads.delete(key)); // allow a retry later
  return promise;
};

/** Loads an equirectangular .hdr from public/. Rejects with AssetLoadError. */
export const loadHdri = async (path: string, resolve: (path: string) => string = publicUrl): Promise<DataTexture> => {
  try {
    return await new HDRLoader().loadAsync(resolve(path));
  } catch (e) {
    throw new AssetLoadError("hdri", path, e);
  }
};
