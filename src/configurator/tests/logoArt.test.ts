/**
 * The logo's shape when printed in one colour: the logo's own coverage, with
 * white areas well inside it (white text in a coloured shape) left open so
 * they stay visible. src/scene/logo/logoArt.ts
 */
import { describe, expect, it } from "vitest";
import { oneColourAlpha } from "../scene/logo/logoArt";
import { BLACK, CLEAR, TestImage, WHITE } from "./logoFixtures";

const at = (alpha: Uint8ClampedArray, w: number, x: number, y: number) => alpha[y * w + x];

describe("one-colour shape", () => {
  it("prints the whole logo, keeping its own coverage", () => {
    const img = new TestImage(100, 40, CLEAR).rect(10, 10, 20, 20, BLACK).rect(40, 15, 50, 10, [23, 92, 211, 128]);
    const alpha = oneColourAlpha(img.data, 100, 40);
    expect(at(alpha, 100, 20, 20)).toBe(255);
    expect(at(alpha, 100, 60, 20)).toBe(128);
    expect(at(alpha, 100, 5, 5)).toBe(0);
  });

  it("leaves white text inside a coloured shape open, so it stays readable", () => {
    const img = new TestImage(120, 120, CLEAR).circle(60, 60, 50, BLACK).rect(35, 52, 50, 16, WHITE);
    const alpha = oneColourAlpha(img.data, 120, 120);
    expect(at(alpha, 120, 60, 20)).toBe(255);
    expect(at(alpha, 120, 60, 60)).toBe(0);
  });

  it("prints white logos and white parts at the logo's edge, including anti-aliased letters", () => {
    const white = new TestImage(100, 40, CLEAR).rect(10, 10, 80, 20, WHITE);
    expect(at(oneColourAlpha(white.data, 100, 40), 100, 50, 20)).toBe(255);

    const letters = new TestImage(60, 30, CLEAR);
    for (let i = 0; i < 4; i++) letters.rect(5 + i * 13, 9, 9, 12, [135, 164, 152, 255]).rect(6 + i * 13, 10, 7, 10, WHITE);
    expect(at(oneColourAlpha(letters.data, 60, 30), 60, 9, 15)).toBe(255);
  });
});
