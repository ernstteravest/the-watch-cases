/**
 * Textures for the printed logo, drawn from the stored logo image so the
 * preview, the thumbnail and the final render agree.
 *   • full colour: the image as it is;
 *   • one colour:  the logo's shape (the material supplies the colour). White
 *     areas well inside the logo (white text in a coloured shape) are left
 *     open, otherwise they would merge into the shape and disappear.
 * The pixel maths is pure and tested in Node; the canvas helpers run in the browser.
 */

/** Edge smoothing around a white area is at most this wide; it doesn't make the area "inside". */
const RIM_PX = 3;

const isWhite = (rgba: Uint8ClampedArray, p: number) => {
  const r = rgba[p * 4];
  const g = rgba[p * 4 + 1];
  const b = rgba[p * 4 + 2];
  const lo = Math.min(r, g, b);
  return lo >= 215 && Math.max(r, g, b) - lo <= 35;
};

/** Pixels within RIM_PX of an empty pixel or of the image's edge. */
const nearEmpty = (solid: (p: number) => boolean, w: number, h: number): Uint8Array => {
  const depth = new Uint8Array(w * h).fill(255);
  const queue = new Int32Array(w * h);
  let tail = 0;
  for (let p = 0; p < w * h; p++) {
    const x = p % w;
    if (!solid(p) || x === 0 || x === w - 1 || p < w || p >= w * (h - 1)) {
      depth[p] = 0;
      queue[tail++] = p;
    }
  }
  for (let head = 0; head < tail; head++) {
    const p = queue[head];
    if (depth[p] >= RIM_PX) continue;
    const x = p % w;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
      if (q >= 0 && q < w * h && depth[q] > depth[p] + 1) {
        depth[q] = depth[p] + 1;
        queue[tail++] = q;
      }
    }
  }
  return depth.map((d) => (d <= RIM_PX ? 1 : 0));
};

/** Coverage (0–255 per pixel) of the logo printed in one colour. */
export const oneColourAlpha = (rgba: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray => {
  const alpha = new Uint8ClampedArray(w * h);
  for (let p = 0; p < w * h; p++) alpha[p] = rgba[p * 4 + 3];
  const solid = (p: number) => alpha[p] >= 128;
  const near = nearEmpty(solid, w, h);
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || !solid(start) || !isWhite(rgba, start)) continue;
    let tail = 0;
    queue[tail++] = start;
    seen[start] = 1;
    let inside = true;
    for (let head = 0; head < tail; head++) {
      const p = queue[head];
      if (near[p]) inside = false;
      const x = p % w;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q >= 0 && q < w * h && !seen[q] && solid(q) && isWhite(rgba, q)) {
          seen[q] = 1;
          queue[tail++] = q;
        }
      }
    }
    if (inside) for (let i = 0; i < tail; i++) alpha[queue[i]] = 0;
  }
  return alpha;
};

/* ------------------------------------------------------------------ */
/* Browser-only canvas helpers                                         */
/* ------------------------------------------------------------------ */

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const context2d = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas is not available for the logo.");
  return ctx;
};

/**
 * Texture for the printed logo. Full colour: the image. One colour: the
 * shape in white (tinted by the material), or in `tint` for a thumbnail.
 */
export const drawLogoTexture = (
  image: CanvasImageSource,
  width: number,
  height: number,
  mode: "full-color" | "one-color",
  tint: [number, number, number] = [255, 255, 255],
): HTMLCanvasElement => {
  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  ctx.drawImage(image, 0, 0, width, height);
  if (mode === "full-color") return canvas;
  const pixels = ctx.getImageData(0, 0, width, height);
  const alpha = oneColourAlpha(pixels.data, width, height);
  for (let p = 0; p < alpha.length; p++) pixels.data.set([tint[0], tint[1], tint[2], alpha[p]], p * 4);
  ctx.putImageData(pixels, 0, 0);
  return canvas;
};

/** Preview placeholder while no logo has been uploaded: a dashed frame marking the print area. */
export const drawLogoPlaceholder = (widthCm: number, heightCm: number, pxPerCm = 96): HTMLCanvasElement => {
  const w = Math.round(widthCm * pxPerCm);
  const h = Math.round(heightCm * pxPerCm);
  const canvas = createCanvas(w, h);
  const ctx = context2d(canvas);
  const line = Math.max(3, Math.round(pxPerCm * 0.05));
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineWidth = line;
  ctx.setLineDash([line * 3, line * 2.2]);
  ctx.beginPath();
  ctx.roundRect(line, line, w - 2 * line, h - 2 * line, pxPerCm * 0.25);
  ctx.stroke();
  ctx.setLineDash([]);
  const fontPx = Math.min(h * 0.22, w * 0.12);
  ctx.font = `600 ${fontPx}px "Instrument Sans Variable", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("YOUR LOGO", w / 2, h / 2);
  return canvas;
};
