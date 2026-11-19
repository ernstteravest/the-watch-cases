import { describe, expect, it } from "vitest";
import {
  defaultConfiguration,
  defaultRenderProps,
  pieceColorChoices,
  validateConfiguration,
  validateRenderProps,
  type Configuration,
} from "../catalog";
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

  it("rejects unknown products, colours not offered and materials not offered", () => {
    expect(issueCodes(withChanges((c) => (c.product = "octet")))).toContain("unknown_product");
    expect(issueCodes(withChanges((c) => (c.exterior = "beige")))).toContain("color_not_offered");
    expect(issueCodes(withChanges((c) => (c.interior = "dark-brown")))).toContain("color_not_offered");
    expect(issueCodes(withChanges((c) => (c.pieces.cushions.material = "full-grain")))).toContain("material_not_offered");
    expect(issueCodes(withChanges((c) => (c.pieces.lining = { material: "suede", color: "beige" })))).toContain("unknown_piece");
  });

  it("fills missing pieces with their defaults", () => {
    const r = validateConfiguration(
      catalog,
      withChanges((c) => {
        delete c.pieces["zip-pull"];
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.configuration.pieces["zip-pull"]).toEqual({ material: "full-grain", color: "match:exterior" });
  });

  it("resolves match chains: snap cap → strap → interior", () => {
    const r = validateConfiguration(catalog, withChanges((c) => (c.interior = "mansory-orange")));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.appearance.pieces.strap.key).toBe("nappa/mansory-orange");
    expect(r.value.appearance.pieces["snap-cap"].key).toBe("nappa/mansory-orange");
    expect(r.value.appearance.pieces["zip-pull"].color.id).toBe(r.value.configuration.exterior);
  });

  it("lets each leather piece have its own colour and leather", () => {
    const r = validateConfiguration(
      catalog,
      withChanges((c) => {
        c.pieces.cushions = { material: "nappa", color: "cognac" };
        c.pieces.strap = { material: "full-grain", color: "black" };
        c.pieces["snap-cap"] = { material: "nappa", color: "red" };
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.appearance.pieces.cushions.key).toBe("nappa/cognac");
    expect(r.value.appearance.pieces.strap.key).toBe("full-grain/black");
    expect(r.value.appearance.pieces["snap-cap"].key).toBe("nappa/red");
  });

  it("detects circular matches created by a customer configuration", () => {
    expect(
      issueCodes(
        withChanges((c) => {
          c.pieces.strap.color = "match:snap-cap";
          c.pieces["snap-cap"].color = "match:strap";
        }),
      ),
    ).toContain("match_cycle");
  });

  it("validates personalization as part of the configuration", () => {
    expect(issueCodes(withChanges((c) => (c.personalization.text = "Hello 👋")))).toContain("invalid_characters");
    expect(issueCodes(withChanges((c) => (c.personalization.placement = "underside")))).toContain("unknown_placement");
  });

  it("offers only match options that resolve to an allowed colour", () => {
    const choices = pieceColorChoices(catalog, defaultConfiguration(catalog), "snap-cap");
    expect(choices.filter((c) => c.isMatch).map((c) => c.value)).toEqual(["match:interior", "match:exterior", "match:strap"]);
    const strapMatch = choices.find((c) => c.value === "match:strap");
    expect(strapMatch?.colorId).toBe("beige");
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
