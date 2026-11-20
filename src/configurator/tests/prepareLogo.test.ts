/**
 * Preparing an uploaded logo: the logo itself is never changed; a plain
 * background can be removed (flood-filled from the edge), with smooth,
 * tint-free edges, and areas inside the logo in the background colour can be
 * left open or kept. src/app/logo/prepareLogo.ts
 */
import { describe, expect, it } from "vitest";
import { backgroundName, hasTransparency, prepareLogo, type LogoImageData, type PreparedLogo } from "../logo/prepareLogo";
import { BLACK, CLEAR, TestImage, WHITE, type Rgba } from "./logoFixtures";

const prepare = (img: TestImage): PreparedLogo => {
  const r = prepareLogo(img.data, img.width, img.height);
  if (!r.ok) throw new Error(`prepare failed: ${r.failure}`);
  return r.value;
};

/** The pixel of a prepared image that came from (x, y) of the input, given the crop's offset. */
const pixel = (image: LogoImageData, x: number, y: number): Rgba => {
  const p = (y * image.width + x) * 4;
  return [image.rgba[p], image.rgba[p + 1], image.rgba[p + 2], image.rgba[p + 3]];
};

const RED: Rgba = [170, 20, 40, 255];
const BLUE: Rgba = [23, 92, 211, 255];

describe("prepareLogo", () => {
  it("keeps an opaque image as uploaded and offers it without its plain background", () => {
    const img = new TestImage(200, 100, WHITE)
      .rect(20, 30, 40, 40, RED) // mark
      .rect(35, 45, 10, 10, WHITE) // white area inside it
      .rect(80, 40, 100, 20, BLACK); // name
    const r = prepare(img);
    expect(r.transparent).toBe(false);
    expect(backgroundName(r.background)).toBe("white");
    expect(r.original).toEqual({ rgba: img.data, width: 200, height: 100 });

    // Background removed and trimmed: 20..179 × 30..69, with a 2 px margin → offset (18, 28).
    const removed = r.removed as LogoImageData;
    expect([removed.width, removed.height]).toEqual([164, 44]);
    expect(pixel(removed, 0, 0)[3]).toBe(0);
    expect(pixel(removed, 25 - 18, 35 - 28)).toEqual(RED);
    expect(pixel(removed, 100 - 18, 50 - 28)).toEqual(BLACK);
    expect(pixel(removed, 40 - 18, 50 - 28)[3]).toBe(0); // inside area left open

    const kept = r.removedKeepInside as LogoImageData;
    expect(pixel(kept, 40 - 18, 50 - 28)).toEqual(WHITE); // inside area kept
    expect(pixel(kept, 0, 0)[3]).toBe(0);
  });

  it("keeps a coloured shape with white text inside it whole; only the text is optional", () => {
    const img = new TestImage(200, 100, WHITE).rect(30, 20, 140, 60, BLUE).rect(60, 40, 80, 20, WHITE);
    const r = prepare(img);
    const removed = r.removed as LogoImageData;
    const kept = r.removedKeepInside as LogoImageData;
    // Offset: 30 - 2, 20 - 2.
    expect(pixel(removed, 35 - 28, 25 - 18)).toEqual(BLUE);
    expect(pixel(removed, 100 - 28, 50 - 18)[3]).toBe(0);
    expect(pixel(kept, 100 - 28, 50 - 18)).toEqual(WHITE);
  });

  it("keeps a transparent logo exactly as it is, panel included, and offers it without the panel", () => {
    const img = new TestImage(200, 120, CLEAR).rect(10, 10, 180, 100, WHITE).rect(30, 40, 40, 40, BLUE).rect(90, 50, 80, 20, BLACK);
    const r = prepare(img);
    expect(r.transparent).toBe(true);
    // Original: trimmed to 10..189 × 10..109 with a 2 px margin; the white panel stays.
    expect([r.original.width, r.original.height]).toEqual([184, 104]);
    expect(pixel(r.original, 15 - 8, 15 - 8)).toEqual(WHITE);
    const removed = r.removed as LogoImageData;
    expect([removed.width, removed.height]).toEqual([144, 44]);
    expect(pixel(removed, 50 - 28, 60 - 38)).toEqual(BLUE);
    expect(pixel(removed, 120 - 28, 60 - 38)).toEqual(BLACK);
  });

  it("never changes a badge: the white text inside stays in the original", () => {
    const img = new TestImage(120, 120, CLEAR).circle(60, 60, 50, BLACK).rect(35, 52, 50, 16, WHITE);
    const r = prepare(img);
    const o = r.original;
    // Trimmed by the margin only: offset 8 (10 - 2).
    expect(pixel(o, 60 - 8, 20 - 8)).toEqual(BLACK);
    expect(pixel(o, 60 - 8, 60 - 8)).toEqual(WHITE);
  });

  it("offers nothing to remove for a clean transparent logo or a photo", () => {
    const wordmark = prepare(new TestImage(100, 40, CLEAR).rect(10, 10, 20, 20, BLACK).rect(40, 15, 50, 10, BLACK));
    expect(wordmark.removed).toBeNull();
    expect(wordmark.removedKeepInside).toBeNull();

    const photo = new TestImage(60, 40).noise();
    const r = prepare(photo);
    expect(r.removed).toBeNull();
    expect(r.original.rgba).toEqual(photo.data);
  });

  it("removes the page around a screenshot's banner and keeps the banner", () => {
    const page: Rgba = [236, 238, 240, 255];
    const green: Rgba = [16, 74, 50, 255];
    const img = new TestImage(300, 200, page).rect(50, 50, 200, 100, green).rect(80, 90, 140, 20, WHITE);
    const r = prepare(img);
    const removed = r.removed as LogoImageData;
    const kept = r.removedKeepInside as LogoImageData;
    // Offset 48.
    expect(pixel(removed, 60 - 48, 60 - 48)).toEqual(green);
    expect(pixel(removed, 150 - 48, 100 - 48)[3]).toBe(0); // white text: an inside area in (almost) the page colour
    expect(pixel(kept, 150 - 48, 100 - 48)).toEqual(WHITE);
  });

  it("gives removed edges smooth coverage without the background's tint", () => {
    const img = new TestImage(100, 60, WHITE).rect(20, 20, 40, 20, BLACK).rect(60, 20, 1, 20, [128, 128, 128, 255]);
    const removed = prepare(img).removed as LogoImageData;
    const [r, g, b, a] = pixel(removed, 60 - 18, 30 - 18);
    expect(a).toBeGreaterThan(110);
    expect(a).toBeLessThan(160);
    expect(Math.max(r, g, b)).toBeLessThan(60); // dark, not a light fringe
  });

  it("fails for an empty image", () => {
    expect(prepareLogo(new TestImage(60, 40, WHITE).data, 60, 40)).toEqual({ ok: false, failure: "empty" });
    expect(prepareLogo(new TestImage(60, 40, CLEAR).data, 60, 40)).toEqual({ ok: false, failure: "empty" });
  });

  it("detects transparency and names plain backgrounds", () => {
    expect(hasTransparency(new TestImage(4, 4, WHITE).data)).toBe(false);
    expect(hasTransparency(new TestImage(4, 4, WHITE).rect(0, 0, 1, 1, CLEAR).data)).toBe(true);
    expect(backgroundName([250, 250, 248])).toBe("white");
    expect(backgroundName([12, 12, 14])).toBe("black");
    expect(backgroundName([16, 74, 50])).toBeNull();
    expect(backgroundName(null)).toBeNull();
  });
});
