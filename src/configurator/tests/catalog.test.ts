import { describe, expect, it } from "vitest";
import { loadCatalog } from "../catalog";
import { cloneOptions } from "./helpers";

const codes = (raw: unknown) => {
  const result = loadCatalog(raw);
  return result.ok ? [] : result.issues.map((i) => i.code);
};

describe("options catalog validation (load time)", () => {
  it("accepts the shipped config/options.ts", () => {
    const result = loadCatalog(cloneOptions());
    expect(result.ok ? [] : result.issues).toEqual([]);
  });

  it("rejects structurally invalid values with a path", () => {
    const raw = cloneOptions();
    raw.colors[0].hex = "green";
    const result = loadCatalog(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].path).toBe("colors.0.hex");
  });

  it("rejects duplicate ids", () => {
    const raw = cloneOptions();
    raw.colors.push({ ...raw.colors[0] });
    expect(codes(raw)).toContain("duplicate_id");
  });

  it("rejects a default colour outside the palette", () => {
    const raw = cloneOptions();
    raw.exterior.default = "beige"; // beige is an interior-only colour
    expect(codes(raw)).toContain("default_not_in_palette");
  });

  it("rejects unknown colours and materials", () => {
    const raw = cloneOptions();
    raw.interior.colors.push("ultraviolet");
    raw.pieces[0].materials.push("alcantara");
    const c = codes(raw);
    expect(c).toContain("unknown_color");
    expect(c).toContain("unknown_material");
  });

  it("rejects circular colour matches between pieces", () => {
    const raw = cloneOptions();
    const strap = raw.pieces.find((p) => p.id === "strap");
    if (!strap) throw new Error("strap missing");
    strap.default.color = "match:snap-cap"; // snap-cap already matches the strap
    expect(codes(raw)).toContain("match_cycle");
  });

  it("rejects a match to a palette the piece does not offer", () => {
    const raw = cloneOptions();
    const cushions = raw.pieces.find((p) => p.id === "cushions");
    if (!cushions) throw new Error("cushions missing");
    cushions.colors = ["beige"]; // matches interior by default, but not all interior colours are offered
    expect(codes(raw)).toContain("match_palette_incomplete");
  });

  it("rejects blueprint dimensions that don't add up", () => {
    const raw = cloneOptions();
    raw.products[0].dimensions.outer.length = 17;
    expect(codes(raw)).toContain("dimension_mismatch");
  });

  it("rejects an invalid personalization regex and an unknown placement", () => {
    const raw = cloneOptions();
    raw.personalization.allowedPattern = "^[A-Z";
    raw.personalization.placements = [{ id: "box-bottom", label: "Bottom" }];
    raw.personalization.defaultPlacement = "box-bottom";
    const c = codes(raw);
    expect(c).toContain("invalid_regex");
    expect(c).toContain("unknown_placement");
  });

  it("rejects an engraving area that would collide with the strap/snap", () => {
    const raw = cloneOptions();
    raw.products[0].engraving.heightCm = 4; // only ~2 cm are free below the snap
    expect(codes(raw)).toContain("engraving_too_large");
  });

  it("rejects views that don't exist", () => {
    const raw = cloneOptions();
    raw.presentation.defaultView = "drone";
    expect(codes(raw)).toContain("unknown_view");
  });

  it("collects all issues instead of stopping at the first", () => {
    const raw = cloneOptions();
    raw.exterior.default = "beige";
    raw.products[0].dimensions.outer.length = 17;
    expect(codes(raw).length).toBeGreaterThanOrEqual(2);
  });
});
