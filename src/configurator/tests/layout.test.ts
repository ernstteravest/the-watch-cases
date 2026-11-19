import { describe, expect, it } from "vitest";
import { computeBoxLayout, DimensionError, isAboveCompartment, validateDimensions } from "../geometry/layout";
import { perimeter, pointAt } from "../geometry/roundedRect";
import { fitCamera, isAnchorVisible, productCorners, viewDirection } from "../scene/camera";
import { layoutFor } from "../scene/describeScene";
import { buildBoxGeometries } from "../scene/geometry/boxGeometry";
import { catalog, product } from "./helpers";

const c = catalog.construction;
const duo = product("duo");
const quartet = product("quartet-slim");

describe("Duo (2-watch) layout from the blueprint", () => {
  const l = computeBoxLayout(duo.dimensions, c);

  it("has two 5.5 cm compartments around one 1.5 cm divider and 1.75 cm end walls", () => {
    expect(l.base.compartments.map((x) => x.centerX)).toEqual([-3.5, 3.5]);
    expect(l.base.compartments.every((x) => x.width === 5.5)).toBe(true);
    expect(l.base.dividers).toHaveLength(1);
    expect(l.base.dividers[0]).toMatchObject({ centerX: 0, width: 1.5 });
    expect(l.base.cavity.minX).toBe(-8 + 1.75);
    expect(l.base.cavity.hv).toBe(4.5 - 1);
  });

  it("sizes cushions 5.5 × 6 × 4 cm plus the oversize cut, sitting on the 1 cm floor", () => {
    for (const cushion of l.base.cushions) {
      expect(cushion.size[0]).toBeCloseTo(5.5 + duo.dimensions.cushion.oversize);
      expect(cushion.size[1]).toBe(4);
      expect(cushion.size[2]).toBe(6);
      expect(cushion.center[1] - cushion.size[1] / 2).toBe(1);
      expect(cushion.size[2] / 2).toBeLessThanOrEqual(l.base.cavity.hv);
    }
  });

  it("places the 13.5 × 5.5 cm pocket on the hinge side and the 1.5 cm flap at the front", () => {
    expect(l.lid.pocket.width).toBe(13.5);
    expect(l.lid.pocket.maxZ - l.lid.pocket.minZ).toBe(5.5);
    expect(l.lid.flap.maxZ - l.lid.flap.minZ).toBe(1.5);
    expect(l.lid.pocket.minZ).toBeLessThan(l.lid.flap.minZ);
    expect(l.lid.hinge.z).toBe(-4.5);
    expect(l.lid.pocket.thickness).toBeCloseTo(0.3 + 0.1); // padded face + stiff board
  });

  it("puts the strap and snap over the centre divider, never above a crystal", () => {
    expect(l.lid.strap.x).toBe(0);
    expect(l.lid.strap.width).toBe(1.2);
    expect(isAboveCompartment(l, l.lid.snap.x, l.lid.snap.radius)).toBe(false);
    expect(isAboveCompartment(l, l.lid.strap.x, l.lid.strap.width / 2)).toBe(false);
    expect(l.lid.strap.rootZ - l.lid.snap.z).toBe(3.5);
  });

  it("stops the zip on the end walls 1.2 cm from the back, 0.5 cm in from the edge", () => {
    expect(l.zip.contour.hu).toBe(8 - 0.5);
    const start = pointAt(l.zip.contour, l.zip.startS);
    const end = pointAt(l.zip.contour, l.zip.endS);
    expect(start.u).toBeCloseTo(7.5);
    expect(end.u).toBeCloseTo(-7.5);
    expect(start.v).toBeCloseTo(-4.5 + 1.2);
    expect(end.v).toBeCloseTo(-4.5 + 1.2);
    expect(l.zip.endS - l.zip.startS).toBeLessThan(perimeter(l.zip.contour));
  });
});

describe("Quartet Slim (4-watch) layout from the blueprint", () => {
  const l = computeBoxLayout(quartet.dimensions, c);

  it("has four 5 cm compartments, three 1.5 cm dividers and 1 cm walls", () => {
    expect(l.base.compartments.map((x) => x.centerX)).toEqual([-9.75, -3.25, 3.25, 9.75]);
    expect(l.base.dividers.map((x) => x.centerX)).toEqual([-6.5, 0, 6.5]);
    expect(l.base.cavity.minX).toBe(-13.25 + 1);
    expect(l.base.cushions.every((x) => x.size[0] === 4.5 + quartet.dimensions.cushion.oversize)).toBe(true);
  });

  it("uses the middle divider for the strap and a 24 cm pocket", () => {
    expect(l.strapDividerIndex).toBe(1);
    expect(l.lid.strap.x).toBe(0);
    expect(isAboveCompartment(l, 0, 0.6)).toBe(false);
    expect(l.lid.pocket.width).toBe(24);
  });

  it("differs from the Duo only where the blueprints differ", () => {
    const d = computeBoxLayout(duo.dimensions, c);
    expect(l.outer.length - d.outer.length).toBe(10.5);
    expect(l.outer.depth).toBe(d.outer.depth);
    expect(l.lid.height).toBe(d.lid.height);
    expect(l.base.compartments.length - d.base.compartments.length).toBe(2);
  });
});

describe("dimension validation", () => {
  it("rejects compartments that don't add up to the outer length", () => {
    const issues = validateDimensions({ ...duo.dimensions, compartments: { ...duo.dimensions.compartments, width: 6 } });
    expect(issues.map((i) => i.code)).toContain("dimension_mismatch");
    expect(() => computeBoxLayout({ ...duo.dimensions, compartments: { ...duo.dimensions.compartments, width: 6 } }, c)).toThrow(DimensionError);
  });

  it("rejects a strap wider than the divider and boxes without a divider", () => {
    expect(
      validateDimensions({ ...duo.dimensions, lid: { ...duo.dimensions.lid, strap: { width: 2, snapFromEdge: 3.5 } } }).map((i) => i.code),
    ).toContain("strap_over_crystal");
    expect(
      validateDimensions({
        ...duo.dimensions,
        compartments: { count: 1, width: 12.5, divider: 1.5 },
      }).map((i) => i.code),
    ).toContain("no_divider");
  });

  it("rejects cushions deeper than the compartment", () => {
    expect(validateDimensions({ ...duo.dimensions, cushion: { ...duo.dimensions.cushion, depth: 7.5 } }).map((i) => i.code)).toContain(
      "dimension_invalid",
    );
  });
});

describe("personalization anchor (inside of the lid)", () => {
  for (const p of [duo, quartet]) {
    it(`${p.id}: centred left–right on the pocket front, clear of strap and snap`, () => {
      const l = layoutFor(catalog, p.id);
      const a = l.engraving["lid-inside"];
      expect(a.assembly).toBe("lid");
      expect(a.surface).toBe("pocket");
      expect(a.center[0]).toBe(0);
      expect(a.normal).toEqual([0, -1, 0]); // faces the watches
      expect(a.center[1]).toBe(l.lid.pocket.faceY);
      const top = a.center[2] + a.heightCm / 2;
      const bottom = a.center[2] - a.heightCm / 2;
      expect(top).toBeLessThan(l.lid.strap.tipZ); // below the strap tip / snap
      expect(bottom).toBeGreaterThan(l.lid.pocket.minZ + c.stitch.pocketInset); // inside the pocket stitching
      expect(a.widthCm).toBeLessThanOrEqual(l.lid.pocket.width - 2 * c.stitch.pocketInset);
    });
  }

  it("is visible with the lid open and hidden with it closed", () => {
    const l = layoutFor(catalog, "duo");
    const a = l.engraving["lid-inside"];
    expect(isAnchorVisible(l, a, { azimuth: 30, elevation: 31, lidAngle: 104 })).toBe(true);
    expect(isAnchorVisible(l, a, { azimuth: 30, elevation: 36, lidAngle: 0 })).toBe(false);
  });
});

describe("generated 3D geometry matches the blueprint", () => {
  for (const p of [duo, quartet]) {
    it(`${p.id}: outer shells have the blueprint size`, () => {
      const l = layoutFor(catalog, p.id);
      const g = buildBoxGeometries(l, c);
      const base = g.base.shell.boundingBox;
      const lid = g.lid.shell.boundingBox;
      if (!base || !lid) throw new Error("bounding boxes missing");
      const d = p.dimensions;
      expect(base.max.x - base.min.x).toBeCloseTo(d.outer.length, 5);
      expect(base.max.z - base.min.z).toBeCloseTo(d.outer.depth, 5);
      expect(base.max.y - base.min.y).toBeCloseTo(d.baseHeight, 5);
      expect(lid.min.y).toBeCloseTo(d.baseHeight, 5);
      expect(lid.max.y).toBeCloseTo(d.outer.height, 5);
      expect(g.base.teeth.length).toBeGreaterThan(50);
      expect(g.lid.teeth.length).toBeGreaterThan(50);
      g.dispose();
    });
  }

  it("keeps the cushions inside their compartments (up to the oversize cut)", () => {
    const l = layoutFor(catalog, "quartet-slim");
    const g = buildBoxGeometries(l, c);
    const bb = g.base.cushions.boundingBox;
    if (!bb) throw new Error("no bbox");
    expect(bb.min.x).toBeGreaterThanOrEqual(l.base.cavity.minX - quartet.dimensions.cushion.oversize);
    expect(bb.max.x).toBeLessThanOrEqual(l.base.cavity.maxX + quartet.dimensions.cushion.oversize);
    g.dispose();
  });
});

describe("camera framing", () => {
  it("keeps every corner of the box in frame for every preset", () => {
    for (const p of [duo, quartet]) {
      const l = layoutFor(catalog, p.id);
      for (const v of catalog.presentation.views) {
        const fov = catalog.presentation.camera.fov;
        const aspect = catalog.presentation.output.width / catalog.presentation.output.height;
        const fit = fitCamera(productCorners(l, v.lidAngle), v.azimuth, v.elevation, fov, aspect, 0.05);
        const dir = viewDirection(v.azimuth, v.elevation);
        const tanV = Math.tan(((fov / 2) * Math.PI) / 180);
        for (const corner of productCorners(l, v.lidAngle)) {
          const q = [corner[0] - fit.target[0], corner[1] - fit.target[1], corner[2] - fit.target[2]];
          const depth = fit.distance - (q[0] * dir[0] + q[1] * dir[1] + q[2] * dir[2]);
          expect(depth, `${p.id}/${v.id}`).toBeGreaterThan(0);
          const radial = Math.hypot(q[0], q[1], q[2]);
          expect(radial / depth).toBeLessThan(tanV * aspect * 1.5);
        }
      }
    }
  });
});
