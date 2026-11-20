/**
 * Browser-only image work for the logo upload: decoding the file, reading its
 * pixels and encoding the prepared logo as a PNG. Kept apart from
 * readLogoFile.ts (the steps, checks and messages) so tests can replace it;
 * jsdom has no image decoder or canvas.
 *
 * Uploaded SVGs are only ever drawn through an <img>, never inserted into the
 * page, so scripts or external references inside them don't run or load.
 */
import { svgIntrinsicSize, type LogoFormat } from "../catalog";

/** Longest side the upload is processed at (larger rasters are scaled down; vectors are drawn at this size). */
export const WORK_MAX_PX = 2048;

export type LogoProcessingFailure = "read_failed" | "decode_failed" | "too_detailed" | "timeout";

export class LogoProcessingError extends Error {
  constructor(
    public readonly failure: LogoProcessingFailure,
    message: string,
  ) {
    super(message);
    this.name = "LogoProcessingError";
  }
}

export interface DecodedLogo {
  /** Intrinsic size (CSS pixels for SVG); 0 × 0 if the file declares none. */
  width: number;
  height: number;
  /** Draws the image into a canvas of the given size. */
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  /** Releases object URLs. */
  release: () => void;
}

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new LogoProcessingError("decode_failed", "The image could not be decoded."));
    image.src = url;
  });

/** Sets an explicit size on the root <svg> (keeping its coordinate system) so every browser draws it at that size. */
export const svgWithSize = (text: string, intrinsic: { width: number; height: number }, width: number, height: number): string =>
  text.replace(/<svg\b([^>]*?)(\/?)>/i, (_match, attrs: string, selfClosing: string) => {
    const hasViewBox = /(^|\s)viewBox\s*=/i.test(attrs);
    const rest = attrs.replace(/(^|\s)(width|height)\s*=\s*(["']).*?\3/gi, "");
    const viewBox = hasViewBox ? "" : ` viewBox="0 0 ${intrinsic.width} ${intrinsic.height}"`;
    return `<svg${rest} width="${width}" height="${height}"${viewBox}${selfClosing}>`;
  });

const fromUrl = async (url: string): Promise<DecodedLogo> => {
  try {
    const image = await loadImage(url);
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw: (ctx, w, h) => {
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(image, 0, 0, w, h);
      },
      release: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
};

/** Decodes an uploaded PNG, JPG or SVG. Rejects with LogoProcessingError. */
export const decodeLogoImage = async (file: Blob, format: LogoFormat): Promise<DecodedLogo> => {
  if (format !== "svg") return fromUrl(URL.createObjectURL(file));
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new LogoProcessingError("read_failed", "The file could not be read.");
  }
  const intrinsic = svgIntrinsicSize(text);
  if (!intrinsic) return { width: 0, height: 0, draw: () => undefined, release: () => undefined };
  // Drawn at processing size, so the vector stays sharp.
  const scale = WORK_MAX_PX / Math.max(intrinsic.width, intrinsic.height);
  const sized = svgWithSize(text, intrinsic, Math.round(intrinsic.width * scale), Math.round(intrinsic.height * scale));
  const decoded = await fromUrl(URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" })));
  return { ...decoded, width: intrinsic.width, height: intrinsic.height };
};

const canvas2d = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new LogoProcessingError("decode_failed", "The browser could not prepare the image.");
  return { canvas, ctx };
};

/** The decoded logo's RGBA pixels at the given size. */
export const readLogoPixels = (decoded: DecodedLogo, width: number, height: number): Uint8ClampedArray => {
  const { ctx } = canvas2d(width, height);
  decoded.draw(ctx, width, height);
  return ctx.getImageData(0, 0, width, height).data;
};

/**
 * Encodes a prepared logo image as a PNG of the given size. If the PNG is
 * longer than `maxDataUrlLength`, it is redrawn smaller, down to 256 px on the
 * longest side.
 */
export const encodeLogoImage = (
  image: { rgba: Uint8ClampedArray; width: number; height: number },
  width: number,
  height: number,
  maxDataUrlLength: number,
): { dataUrl: string; width: number; height: number } => {
  const source = canvas2d(image.width, image.height);
  const pixels = source.ctx.createImageData(image.width, image.height);
  pixels.data.set(image.rgba);
  source.ctx.putImageData(pixels, 0, 0);

  let w = width;
  let h = height;
  for (;;) {
    const out = canvas2d(w, h);
    out.ctx.imageSmoothingQuality = "high";
    out.ctx.drawImage(source.canvas, 0, 0, w, h);
    const dataUrl = out.canvas.toDataURL("image/png");
    if (!dataUrl.startsWith("data:image/png")) throw new LogoProcessingError("decode_failed", "The browser could not prepare the image.");
    if (dataUrl.length <= maxDataUrlLength) return { dataUrl, width: w, height: h };
    w = Math.round(w * 0.75);
    h = Math.round(h * 0.75);
    if (Math.max(w, h) < 256) throw new LogoProcessingError("too_detailed", "The image is too detailed to prepare.");
  }
};
