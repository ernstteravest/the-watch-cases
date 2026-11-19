/** Synthetic logo images (RGBA pixels) for the clean-up and Logo step tests. */

export type Rgba = [number, number, number, number];

export const WHITE: Rgba = [255, 255, 255, 255];
export const BLACK: Rgba = [20, 20, 22, 255];
export const CLEAR: Rgba = [0, 0, 0, 0];

export class TestImage {
  readonly data: Uint8ClampedArray;

  constructor(
    readonly width: number,
    readonly height: number,
    fill: Rgba = CLEAR,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
    for (let p = 0; p < width * height; p++) this.data.set(fill, p * 4);
  }

  /** Fills pixels x..x+w-1, y..y+h-1. */
  rect(x: number, y: number, w: number, h: number, c: Rgba): this {
    for (let yy = Math.max(0, y); yy < Math.min(this.height, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(this.width, x + w); xx++) this.data.set(c, (yy * this.width + xx) * 4);
    }
    return this;
  }

  /** A rectangle in fractions of the image size. */
  relRect(fx: number, fy: number, fw: number, fh: number, c: Rgba): this {
    return this.rect(Math.round(fx * this.width), Math.round(fy * this.height), Math.round(fw * this.width), Math.round(fh * this.height), c);
  }

  circle(cx: number, cy: number, r: number, c: Rgba): this {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (x >= 0 && y >= 0 && x < this.width && y < this.height && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.data.set(c, (y * this.width + x) * 4);
      }
    }
    return this;
  }

  /** Every pixel a different colour (a photo-like border). */
  noise(seed = 1): this {
    let s = seed;
    for (let i = 0; i < this.data.length; i += 4) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      this.data.set([s & 255, (s >> 8) & 255, (s >> 16) & 255, 255], i);
    }
    return this;
  }
}

/** Logo images by file name, drawn at any size (the Logo step tests' fake decoder uses these). */
export const logoFixtures: Record<string, { width: number; height: number; draw: (w: number, h: number) => TestImage }> = {
  // JPG: dark red mark and name on a white background; the mark has a white inside area.
  "nordic.jpg": {
    width: 1000,
    height: 420,
    draw: (w, h) =>
      new TestImage(w, h, WHITE)
        .relRect(0.08, 0.25, 0.2, 0.5, [170, 20, 40, 255])
        .relRect(0.14, 0.4, 0.08, 0.2, WHITE)
        .relRect(0.34, 0.35, 0.58, 0.3, [170, 20, 40, 255]),
  },
  // Transparent PNG whose logo sits on a white panel.
  "acme-plate.png": {
    width: 900,
    height: 400,
    draw: (w, h) =>
      new TestImage(w, h, CLEAR)
        .relRect(0.02, 0.02, 0.96, 0.96, WHITE)
        .relRect(0.1, 0.3, 0.2, 0.4, [23, 92, 211, 255])
        .relRect(0.4, 0.4, 0.5, 0.2, BLACK),
  },
  // A clean transparent logo in one colour (what a pasted image often is).
  "image.png": {
    width: 800,
    height: 400,
    draw: (w, h) => new TestImage(w, h, CLEAR).relRect(0.1, 0.3, 0.8, 0.4, BLACK),
  },
  // A small logo on a large white canvas: too small once the background is removed.
  "big-canvas.png": {
    width: 2000,
    height: 2000,
    draw: (w, h) => new TestImage(w, h, WHITE).relRect(0.45, 0.48, 0.1, 0.04, BLACK),
  },
  // A photo: no plain background, kept as it is.
  "photo.jpg": { width: 800, height: 600, draw: (w, h) => new TestImage(w, h).noise() },
  // A blank image.
  "blank.png": { width: 600, height: 300, draw: (w, h) => new TestImage(w, h, WHITE) },
  // An SVG: intrinsic 300 × 120, drawn larger.
  "studio.svg": {
    width: 300,
    height: 120,
    draw: (w, h) => new TestImage(w, h, CLEAR).circle(w * 0.2, h * 0.5, h * 0.4, BLACK).relRect(0.42, 0.35, 0.5, 0.3, BLACK),
  },
};
