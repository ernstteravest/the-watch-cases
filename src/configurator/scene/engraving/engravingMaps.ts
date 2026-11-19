/**
 * Blind-debossed personalization: the text is rasterised into a height field,
 * softened to form the pressed edge, and turned into a tangent-space normal
 * map plus a colour/alpha map (pressed leather reads slightly darker).
 * Runs on a 2D canvas with the bundled font, so preview and render match.
 */

export interface EngravingSpec {
  text: string;
  widthCm: number;
  heightCm: number;
  /** CSS font-family list, bundled family first. */
  fontFamily: string;
  weight: number;
  letterSpacingEm: number;
  maxCapHeightCm: number;
  depth: number;
  darkening: number;
  edgeSoftnessCm: number;
  pxPerCm?: number;
}

export interface EngravingMaps {
  color: HTMLCanvasElement;
  normal: HTMLCanvasElement;
  /** Font size actually used, in cm (after fitting). */
  fontSizeCm: number;
}

type CanvasFactory = (width: number, height: number) => HTMLCanvasElement;

const defaultCanvas: CanvasFactory = (width, height) => {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
};

export const ENGRAVING_PX_PER_CM = 160;

/** Font size (px) that fits `text` into the area, capped by the maximum cap height. */
export const fitFontSize = (
  measure: (fontPx: number) => { width: number; capHeight: number },
  areaPx: { width: number; height: number },
  maxCapHeightPx: number,
): number => {
  const probe = 100;
  const m = measure(probe);
  if (m.width <= 0 || m.capHeight <= 0) return probe;
  const byCap = (maxCapHeightPx / m.capHeight) * probe;
  const byHeight = ((areaPx.height * 0.78) / m.capHeight) * probe;
  const byWidth = ((areaPx.width * 0.92) / m.width) * probe;
  return Math.max(4, Math.min(byCap, byHeight, byWidth));
};

export const drawEngravingMaps = (spec: EngravingSpec, createCanvas: CanvasFactory = defaultCanvas): EngravingMaps => {
  const pxPerCm = spec.pxPerCm ?? ENGRAVING_PX_PER_CM;
  const W = Math.max(16, Math.round(spec.widthCm * pxPerCm));
  const H = Math.max(16, Math.round(spec.heightCm * pxPerCm));

  const mask = createCanvas(W, H);
  const mctx = mask.getContext("2d", { willReadFrequently: true });
  if (!mctx) throw new Error("2D canvas is not available for the engraving.");

  const setFont = (px: number) => {
    mctx.font = `${spec.weight} ${px}px ${spec.fontFamily}`;
    mctx.letterSpacing = `${(spec.letterSpacingEm * px).toFixed(2)}px`;
  };
  const measure = (px: number) => {
    setFont(px);
    const m = mctx.measureText(spec.text);
    const cap = mctx.measureText("H");
    // letterSpacing also adds space after the last glyph.
    return { width: m.width - spec.letterSpacingEm * px, capHeight: cap.actualBoundingBoxAscent };
  };
  const fontPx = fitFontSize(measure, { width: W, height: H }, spec.maxCapHeightCm * pxPerCm);

  setFont(fontPx);
  mctx.fillStyle = "#000";
  mctx.fillRect(0, 0, W, H);
  mctx.fillStyle = "#fff";
  mctx.textAlign = "center";
  mctx.textBaseline = "alphabetic";
  const metrics = mctx.measureText(spec.text);
  const ascent = metrics.actualBoundingBoxAscent;
  const descent = metrics.actualBoundingBoxDescent;
  const baseline = H / 2 + (ascent - descent) / 2;
  mctx.fillText(spec.text, W / 2 + (spec.letterSpacingEm * fontPx) / 2, baseline);

  // Soft pressed edge.
  const height = createCanvas(W, H);
  const hctx = height.getContext("2d", { willReadFrequently: true });
  if (!hctx) throw new Error("2D canvas is not available for the engraving.");
  const blurPx = Math.max(0.5, spec.edgeSoftnessCm * pxPerCm);
  hctx.filter = `blur(${blurPx.toFixed(2)}px)`;
  hctx.drawImage(mask, 0, 0);
  hctx.filter = "none";

  const src = hctx.getImageData(0, 0, W, H).data;
  const h = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) h[i] = src[i * 4] / 255;

  const normal = createCanvas(W, H);
  const nctx = normal.getContext("2d");
  const color = createCanvas(W, H);
  const cctx = color.getContext("2d");
  if (!nctx || !cctx) throw new Error("2D canvas is not available for the engraving.");
  const nImg = nctx.createImageData(W, H);
  const cImg = cctx.createImageData(W, H);
  const at = (x: number, y: number) => h[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  const k = spec.depth;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const dx = (at(x + 1, y) - at(x - 1, y)) * 0.5;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 0.5;
      // Debossed: surface = −h. Tangent space: +u = right, +v = up (canvas y is down).
      let nx = dx * k;
      let ny = -dy * k;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      nImg.data[i * 4] = Math.round((nx * 0.5 + 0.5) * 255);
      nImg.data[i * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nImg.data[i * 4 + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      nImg.data[i * 4 + 3] = 255;

      const v = h[i];
      const shade = 1 - spec.darkening * Math.min(1, v * 1.15);
      const alpha = Math.min(1, Math.max(0, v / 0.22));
      cImg.data[i * 4] = Math.round(shade * 255);
      cImg.data[i * 4 + 1] = Math.round(shade * 255);
      cImg.data[i * 4 + 2] = Math.round(shade * 255);
      cImg.data[i * 4 + 3] = Math.round(alpha * alpha * (3 - 2 * alpha) * 255);
    }
  }
  nctx.putImageData(nImg, 0, 0);
  cctx.putImageData(cImg, 0, 0);
  return { color, normal, fontSizeCm: fontPx / pxPerCm };
};
