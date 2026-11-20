import { describe, expect, it } from "vitest";
import { defaultConfiguration, defaultPieces, defaultRenderProps, validateConfiguration, validateRenderProps, type Configuration } from "../catalog";
import { catalog } from "./helpers";

const withChanges = (change: (c: Configuration) => void, productId?: string) => {
  const c = structuredClone(defaultConfiguration(catalog, productId));
  change(c);
  return c;
};

const issueCodes = (input: unknown) => {
  const r = validateConfiguration(catalog, input);
  return r.ok ? [] : r.issues.map((i) => i.code);
};

describe("configuration validation", () => {
  it("accepts the default configuration for every product", () => {
    for (const p of catalog.products) {
      const r = validateConfiguration(catalog, defaultConfiguration(catalog, p.id));
      expect(r.ok, p.id).toBe(true);
    }
  });

  it("keeps exterior and interior independent", () => {
    for (const ext of catalog.exterior.colors) {
      for (const int of catalog.interior.colors) {
        const r = validateConfiguration(
          catalog,
          withChanges((c) => {
            c.exterior = ext;
            c.interior = int;
          }),
        );
        expect(r.ok, `${ext}/${int}`).toBe(true);
      }
    }
  });

  it("rejects malformed input", () => {
    expect(issueCodes(null).length).toBeGreaterThan(0);
    expect(issueCodes({ product: 3 }).length).toBeGreaterThan(0);
  });

  it("rejects unknown products and colours not offered", () => {
    expect(issueCodes(withChanges((c) => (c.product = "octet")))).toContain("unknown_product");
    expect(issueCodes(withChanges((c) => (c.exterior = "beige")))).toContain("color_not_offered");
    expect(issueCodes(withChanges((c) => (c.interior = "dark-brown")))).toContain("color_not_offered");
  });

  it("validates personalization as part of the configuration", () => {
    expect(issueCodes(withChanges((c) => (c.personalization.text = "Hello 👋")))).toContain("invalid_characters");
    expect(issueCodes(withChanges((c) => (c.personalization.placement = "underside")))).toContain("unknown_placement");
  });
});

describe("leather pieces (Leather details step removed)", () => {
  it("are not part of a new configuration", () => {
    expect(defaultConfiguration(catalog)).not.toHaveProperty("pieces");
  });

  it("can't be customised: every piece, material or colour change is rejected", () => {
    for (const piece of catalog.pieces) {
      const otherMaterial = piece.materials.find((m) => m !== piece.default.material) ?? piece.default.material;
      const otherColor = piece.colors.find((c) => c !== piece.default.color) ?? "black";
      expect(issueCodes(withChanges((c) => (c.pieces = { [piece.id]: { ...piece.default, material: otherMaterial } }))), piece.id).toContain(
        "piece_not_selectable",
      );
      expect(issueCodes(withChanges((c) => (c.pieces = { [piece.id]: { ...piece.default, color: otherColor } }))), piece.id).toContain(
        "piece_not_selectable",
      );
    }
    expect(issueCodes(withChanges((c) => (c.pieces = { lining: { material: "suede", color: "beige" } })))).toContain("unknown_piece");
  });

  it("accepts saved configurations that list the default pieces, and drops them", () => {
    const r = validateConfiguration(catalog, withChanges((c) => (c.pieces = defaultPieces(catalog))));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.configuration).not.toHaveProperty("pieces");
  });

  it("always use their defaults in the scene: cushions, pocket, flap, strap and snap cap follow the interior, the pull tab the exterior", () => {
    const r = validateConfiguration(catalog, withChanges((c) => (c.interior = "signal-orange")));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const keys = Object.fromEntries(Object.entries(r.value.appearance.pieces).map(([id, m]) => [id, m.key]));
    expect(keys).toEqual({
      cushions: "suede/signal-orange",
      pocket: "suede/signal-orange",
      flap: "suede/signal-orange",
      strap: "nappa/signal-orange",
      "snap-cap": "nappa/signal-orange",
      "zip-pull": `full-grain/${r.value.configuration.exterior}`,
    });
  });
});

describe("render props validation", () => {
  it("accepts the default render props and normalises azimuth", () => {
    const props = defaultRenderProps(catalog);
    const r = validateRenderProps(catalog, { ...props, view: { ...props.view, azimuth: -30 } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.view.azimuth).toBe(330);
  });

  it("rejects camera views outside the allowed range", () => {
    const props = defaultRenderProps(catalog);
    const r = validateRenderProps(catalog, { ...props, view: { ...props.view, elevation: 95, lidAngle: 180 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.path)).toEqual(expect.arrayContaining(["view.elevation", "view.lidAngle"]));
  });
});
