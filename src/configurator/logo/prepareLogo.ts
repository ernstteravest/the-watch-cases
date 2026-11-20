/**
 * Prepares an uploaded logo for printing. The logo itself is kept exactly as
 * it is; only a plain background around it can be removed, and the customer
 * chooses whether it is.
 *
 *  • original:   as uploaded (transparent margins trimmed).
 *  • removed:    a plain background removed: the colour filling the border of
 *                an opaque image (a JPG, a screenshot), or a plain panel a
 *                transparent logo sits on. Only what touches the outside goes
 *                (it's flood-filled from the edge); edges stay smooth and lose
 *                the background's tint. Areas inside the logo in the
 *                background colour (the inside of letters) are left open too.
 *  • removedKeepInside: as removed, but those inside areas are kept (white text
 *                in a coloured shape, for example).
 *
 * Pure, on RGBA pixels, so it's tested in Node.
 */

export interface LogoImageData {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
}

export type Rgb = [number, number, number];

export interface PreparedLogo {
  original: LogoImageData;
  /** null: no plain background to remove. */
  removed: LogoImageData | null;
  /** null: no areas inside the logo in the background colour. */
  removedKeepInside: LogoImageData | null;
  /** The background colour that can be removed. */
  background: Rgb | null;
  /** The upload already had transparency (then nothing is removed unless the customer asks). */
  transparent: boolean;
}

export type PrepareLogoFailure = "empty";

/** Colour distance (0–441) up to which a pixel counts as the background colour. */
const SAME = 40;
/** Distance below which a pixel is pure background (JPEG noise). */
const NOISE = 16;
/** Edge pixels are estimated against the strongest colour within this radius. */
const EDGE_RADIUS = 2;

const distance = (rgba: Uint8ClampedArray, p: number, c: Rgb) => {
  const dr = rgba[p * 4] - c[0];
  const dg = rgba[p * 4 + 1] - c[1];
  const db = rgba[p * 4 + 2] - c[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

/** Per-channel median of the given pixels' colours. */
const medianColour = (rgba: Uint8ClampedArray, pixels: number[]): Rgb => {
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  for (const p of pixels) for (let k = 0; k < 3; k++) hist[k][rgba[p * 4 + k]]++;
  const median = (h: Uint32Array) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += h[v];
      if (acc * 2 > pixels.length) return v;
    }
    return 255;
  };
  return [median(hist[0]), median(hist[1]), median(hist[2])];
};

/** True if any pixel is (partly) transparent. */
export const hasTransparency = (rgba: Uint8ClampedArray): boolean => {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 250) return true;
  return false;
};

const isEdge = (p: number, w: number, h: number) => {
  const x = p % w;
  return x === 0 || x === w - 1 || p < w || p >= w * (h - 1);
};

const neighbours = (p: number, w: number, h: number) => {
  const x = p % w;
  const out: number[] = [];
  if (x > 0) out.push(p - 1);
  if (x < w - 1) out.push(p + 1);
  if (p >= w) out.push(p - w);
  if (p < w * (h - 1)) out.push(p + w);
  return out;
};

/** Pixels reachable from the image's edge through pixels that pass `open`. */
const floodFromEdge = (open: (p: number) => boolean, w: number, h: number): Uint8Array => {
  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let tail = 0;
  for (let p = 0; p < w * h; p++) {
    if (isEdge(p, w, h) && open(p)) {
      seen[p] = 1;
      queue[tail++] = p;
    }
  }
  for (let head = 0; head < tail; head++) {
    for (const q of neighbours(queue[head], w, h)) {
      if (!seen[q] && open(q)) {
        seen[q] = 1;
        queue[tail++] = q;
      }
    }
  }
  return seen;
};

/** The colour of a plain background, or null if there isn't one. */
const findBackground = (rgba: Uint8ClampedArray, w: number, h: number, transparent: boolean): Rgb | null => {
  const solid = (p: number) => rgba[p * 4 + 3] >= 128;
  let candidates: number[];
  let share: number;
  if (!transparent) {
    // The colour filling the image's border.
    candidates = [];
    for (let p = 0; p < w * h; p++) if (isEdge(p, w, h)) candidates.push(p);
    share = 0.5;
  } else {
    // The colour around the outside of the content (a plain panel).
    const outside = floodFromEdge((p) => !solid(p), w, h);
    candidates = [];
    for (let p = 0; p < w * h; p++) {
      if (solid(p) && (isEdge(p, w, h) || neighbours(p, w, h).some((q) => outside[q]))) candidates.push(p);
    }
    share = 0.8;
  }
  if (candidates.length < 16) return null;
  const colour = medianColour(rgba, candidates);
  return candidates.filter((p) => distance(rgba, p, colour) < SAME).length >= candidates.length * share ? colour : null;
};

/** Largest value within EDGE_RADIUS (square window), per pixel. */
const localMax = (values: Float32Array, w: number, h: number): Float32Array => {
  const across = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = Math.max(0, x - EDGE_RADIUS); k <= Math.min(w - 1, x + EDGE_RADIUS); k++) m = Math.max(m, values[y * w + k]);
      across[y * w + x] = m;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = Math.max(0, y - EDGE_RADIUS); k <= Math.min(h - 1, y + EDGE_RADIUS); k++) m = Math.max(m, across[k * w + x]);
      out[y * w + x] = m;
    }
  }
  return out;
};

/** Crops to the visible pixels (alpha > 5), with a small margin. null if nothing is visible. */
const trim = (rgba: Uint8ClampedArray, w: number, h: number): LogoImageData | null => {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  let visible = 0;
  for (let p = 0; p < w * h; p++) {
    if (rgba[p * 4 + 3] <= 5) continue;
    if (rgba[p * 4 + 3] >= 128) visible++;
    const x = p % w;
    const y = (p - x) / w;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  if (visible < Math.max(64, w * h * 0.0005)) return null;
  const margin = Math.max(2, Math.round(0.01 * Math.max(x1 - x0 + 1, y1 - y0 + 1)));
  const bx = Math.max(0, x0 - margin);
  const by = Math.max(0, y0 - margin);
  const bw = Math.min(w, x1 + margin + 1) - bx;
  const bh = Math.min(h, y1 + margin + 1) - by;
  const out = new Uint8ClampedArray(bw * bh * 4);
  for (let y = 0; y < bh; y++) out.set(rgba.subarray(((by + y) * w + bx) * 4, ((by + y) * w + bx + bw) * 4), y * bw * 4);
  return { rgba: out, width: bw, height: bh };
};

/**
 * Removes the pixels in `removed`, giving the pixels next to them a smooth
 * edge: their coverage is estimated from how far their colour is from the
 * background (relative to the strongest colour nearby), and the background's
 * tint is taken out of their colour.
 */
const removePixels = (rgba: Uint8ClampedArray, w: number, h: number, bg: Rgb, removed: Uint8Array, strength: Float32Array, nearby: Float32Array) => {
  const out = new Uint8ClampedArray(rgba);
  const near = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    if (!removed[p]) continue;
    out[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p - x) / w;
    for (let yy = Math.max(0, y - EDGE_RADIUS); yy <= Math.min(h - 1, y + EDGE_RADIUS); yy++) {
      for (let xx = Math.max(0, x - EDGE_RADIUS); xx <= Math.min(w - 1, x + EDGE_RADIUS); xx++) near[yy * w + xx] = 1;
    }
  }
  for (let p = 0; p < w * h; p++) {
    if (removed[p] || !near[p]) continue;
    const full = Math.max(nearby[p], 60);
    const a = Math.min(1, Math.max(0, (strength[p] - NOISE) / (full - NOISE)));
    if (a >= 1) continue;
    out[p * 4 + 3] = Math.round(a * rgba[p * 4 + 3]);
    if (a > 0) for (let k = 0; k < 3; k++) out[p * 4 + k] = bg[k] + (rgba[p * 4 + k] - bg[k]) / a;
  }
  return out;
};

export const prepareLogo = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): { ok: true; value: PreparedLogo } | { ok: false; failure: PrepareLogoFailure } => {
  const n = width * height;
  const transparent = hasTransparency(rgba);
  const background = findBackground(rgba, width, height, transparent);

  const original = transparent ? trim(rgba, width, height) : { rgba: new Uint8ClampedArray(rgba), width, height };
  if (!original) return { ok: false, failure: "empty" };
  if (!background) return { ok: true, value: { original, removed: null, removedKeepInside: null, background: null, transparent } };

  const solid = (p: number) => rgba[p * 4 + 3] >= 128;
  const strength = new Float32Array(n);
  for (let p = 0; p < n; p++) strength[p] = distance(rgba, p, background);
  const isBackground = (p: number) => solid(p) && strength[p] < SAME;

  // The background: everything of its colour connected to the image's edge (through transparent pixels too).
  const outside = floodFromEdge((p) => !solid(p) || isBackground(p), width, height);
  // Areas inside the logo in the background colour.
  const inside = new Uint8Array(n);
  let insideCount = 0;
  for (let p = 0; p < n; p++) {
    if (!outside[p] && isBackground(p)) {
      inside[p] = 1;
      insideCount++;
    }
  }
  const outsideOrInside = new Uint8Array(n);
  for (let p = 0; p < n; p++) outsideOrInside[p] = outside[p] || inside[p] ? 1 : 0;

  const nearby = localMax(strength, width, height);
  const removed = trim(removePixels(rgba, width, height, background, outsideOrInside, strength, nearby), width, height);
  if (!removed) {
    // Nothing left: an opaque image is blank; a transparent logo in one colour has no background to remove.
    if (!transparent) return { ok: false, failure: "empty" };
    return { ok: true, value: { original, removed: null, removedKeepInside: null, background: null, transparent } };
  }
  const removedKeepInside =
    insideCount >= Math.max(16, n * 0.0001) ? trim(removePixels(rgba, width, height, background, outside, strength, nearby), width, height) : null;
  return { ok: true, value: { original, removed, removedKeepInside, background, transparent } };
};

/** How to name the background colour to the customer. */
export const backgroundName = (c: Rgb | null): "white" | "black" | null => {
  if (!c) return null;
  const lo = Math.min(...c);
  const hi = Math.max(...c);
  if (lo >= 200 && hi - lo <= 40) return "white";
  if (hi <= 60) return "black";
  return null;
};
