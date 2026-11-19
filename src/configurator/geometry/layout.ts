/**
 * Blueprint geometry → concrete layout (all values in cm).
 *
 * Coordinate system used everywhere in the scene:
 *   x = length (left → right), y = up (0 = bottom of the box), z = depth (+z = front).
 * The lid is described in its *closed* position (y from baseHeight to height);
 * the scene rotates it open around the hinge at the outer back edge.
 */
import type { Construction, Dimensions, Issue } from "../catalog/schema";
import { arcLengthOnEndEdge, offsetRect, type RoundedRect } from "./roundedRect";

export type Vec3 = [number, number, number];

export interface Compartment {
  index: number;
  centerX: number;
  minX: number;
  maxX: number;
  width: number;
}

export interface Divider {
  index: number;
  centerX: number;
  minX: number;
  maxX: number;
  width: number;
}

export interface CushionLayout {
  index: number;
  center: Vec3;
  /** Full size: x = width (incl. oversize), y = height, z = depth. */
  size: Vec3;
}

/**
 * Surfaces personalization can be pressed into. "lid-inside" is the one offered
 * today; "lid-top" is kept as a ready alternative, and box-body placements can
 * be added here later without touching the scene.
 */
export const ENGRAVING_PLACEMENTS = ["lid-inside", "lid-top"] as const;
export type EngravingPlacement = (typeof ENGRAVING_PLACEMENTS)[number];

export interface EngravingAnchor {
  placement: EngravingPlacement;
  /** Which assembly the anchor belongs to (moves with it). */
  assembly: "lid" | "base";
  /** Whose leather the text is pressed into: "exterior" or a leather piece id. */
  surface: "exterior" | string;
  center: Vec3;
  /** Outward surface normal (towards the viewer of that surface). */
  normal: Vec3;
  /** Direction of the text baseline (left → right as read). */
  tangent: Vec3;
  /** Area the text is fitted into (set from the product by withEngravingArea). */
  widthCm: number;
  heightCm: number;
  /** Largest area that fits this surface without touching seams, strap or snap. */
  maxWidthCm: number;
  maxHeightCm: number;
}

export interface BoxLayout {
  outer: { length: number; depth: number; height: number; hx: number; hz: number; cornerRadius: number };
  /** Plan-view outer contour (u = x, v = z). */
  outerContour: RoundedRect;
  base: {
    height: number;
    floorY: number;
    cavity: RoundedRect & { minX: number; maxX: number; minZ: number; maxZ: number };
    compartments: Compartment[];
    dividers: Divider[];
    dividerHeight: number;
    cushions: CushionLayout[];
  };
  lid: {
    bottomY: number;
    topY: number;
    height: number;
    hinge: { y: number; z: number };
    cavity: RoundedRect;
    innerTopY: number;
    pocket: {
      centerX: number;
      centerZ: number;
      width: number;
      usableWidth: number;
      height: number;
      minZ: number;
      maxZ: number;
      /** Visible face (faces the watches, −y). */
      faceY: number;
      thickness: number;
      depth: number;
    };
    flap: { width: number; minZ: number; maxZ: number; faceY: number; thickness: number };
    strap: {
      x: number;
      width: number;
      thickness: number;
      /** Inner front edge of the lid, where the strap is sewn in. */
      rootZ: number;
      snapZ: number;
      tipZ: number;
      /** Where the strap steps from the flap onto the pocket face. */
      stepZ: number;
    };
    snap: { x: number; z: number; y: number; radius: number };
  };
  zip: {
    contour: RoundedRect;
    /** Arc-length range of the zip run along `contour` (front + both ends). */
    startS: number;
    endS: number;
    stopZ: number;
    pullSide: "left" | "right";
  };
  engraving: Record<EngravingPlacement, EngravingAnchor>;
  /** Index of the divider the strap/snap sits over. */
  strapDividerIndex: number;
}

const EPS = 1e-6;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-4;
const fmt = (n: number) => Number(n.toFixed(4)).toString();

/** Checks that blueprint dimensions are self-consistent. */
export const validateDimensions = (d: Dimensions, path = "dimensions"): Issue[] => {
  const issues: Issue[] = [];
  const add = (p: string, code: string, message: string) => issues.push({ path: `${path}.${p}`, code, message });

  if (!near(d.baseHeight + d.lidHeight, d.outer.height)) {
    add("baseHeight", "dimension_mismatch", `baseHeight (${d.baseHeight}) + lidHeight (${d.lidHeight}) must equal outer height (${d.outer.height}).`);
  }
  const { count, width, divider } = d.compartments;
  const along = 2 * d.walls.end + count * width + (count - 1) * divider;
  if (!near(along, d.outer.length)) {
    add(
      "compartments",
      "dimension_mismatch",
      `2 × end wall + ${count} × compartment + ${count - 1} × divider = ${fmt(along)} cm, but the outer length is ${d.outer.length} cm.`,
    );
  }
  const cavityDepth = d.outer.depth - 2 * d.walls.side;
  if (cavityDepth <= 0) {
    add("walls.side", "dimension_invalid", "Front/back walls leave no room for the compartments.");
  }
  if (d.cushion.depth > cavityDepth + EPS) {
    add("cushion.depth", "dimension_invalid", `Cushion depth ${d.cushion.depth} exceeds the compartment depth ${fmt(cavityDepth)}.`);
  }
  if (d.cushion.width > width + EPS) {
    add("cushion.width", "dimension_invalid", `Cushion width ${d.cushion.width} exceeds the compartment width ${width}.`);
  }
  if (d.floor + d.cushion.height > d.baseHeight + EPS) {
    add("cushion.height", "dimension_invalid", `Floor (${d.floor}) + cushion height (${d.cushion.height}) exceeds the base height (${d.baseHeight}).`);
  }
  if (d.zipInset >= Math.min(d.walls.side, d.walls.end) + EPS) {
    add("zipInset", "dimension_invalid", "The zip must sit on the rim (zipInset smaller than the wall thickness).");
  }

  const lid = d.lid;
  const lidInnerLength = d.outer.length - 2 * lid.wall;
  const lidInnerDepth = d.outer.depth - 2 * lid.wall;
  if (lid.pocket.width > lidInnerLength + EPS) {
    add("lid.pocket.width", "dimension_invalid", `Pocket width ${lid.pocket.width} exceeds the lid's inner length ${fmt(lidInnerLength)}.`);
  }
  if (lid.pocket.usableWidth > lid.pocket.width + EPS) {
    add("lid.pocket.usableWidth", "dimension_invalid", "Usable pocket width cannot exceed the pocket width.");
  }
  if (lid.flapHeight + lid.pocket.height > lidInnerDepth + EPS) {
    add(
      "lid.flapHeight",
      "dimension_invalid",
      `Flap (${lid.flapHeight}) + pocket (${lid.pocket.height}) exceed the lid's inner depth ${fmt(lidInnerDepth)}.`,
    );
  }
  if (lid.strap.snapFromEdge >= lid.flapHeight + lid.pocket.height) {
    add("lid.strap.snapFromEdge", "dimension_invalid", "The snap must land on the pocket front.");
  }
  if (lid.strap.snapFromEdge <= lid.flapHeight) {
    add("lid.strap.snapFromEdge", "dimension_invalid", "The snap must sit below the flap, on the pocket front.");
  }
  if (lid.padding + lid.board + lid.pocket.depth >= d.lidHeight) {
    add("lid.pocket.depth", "dimension_invalid", "Pocket depth + padding + board must fit inside the lid height.");
  }
  if (count < 2) {
    add("compartments.count", "no_divider", "At least two compartments are needed so the strap can sit over a divider.");
  } else if (lid.strap.width > divider + EPS) {
    add("lid.strap.width", "strap_over_crystal", `Strap (${lid.strap.width}) is wider than the divider (${divider}) and would overhang a watch.`);
  }
  return issues;
};

export class DimensionError extends Error {
  constructor(public readonly issues: Issue[]) {
    super(`Invalid box dimensions:\n${issues.map((i) => `• ${i.path}: ${i.message}`).join("\n")}`);
    this.name = "DimensionError";
  }
}

/** Validates construction constants against the product geometry. */
export const validateConstruction = (d: Dimensions, c: Construction, path = "construction"): Issue[] => {
  const issues: Issue[] = [];
  const hx = d.outer.length / 2;
  const hz = d.outer.depth / 2;
  if (c.cornerRadius >= Math.min(hx, hz)) {
    issues.push({ path: `${path}.cornerRadius`, code: "construction_invalid", message: "Corner radius is larger than the box." });
  }
  if (c.cornerRadius <= d.zipInset) {
    issues.push({ path: `${path}.cornerRadius`, code: "construction_invalid", message: "Corner radius must be larger than the zip inset." });
  }
  if (c.zip.endDistanceFromBackCm < c.cornerRadius) {
    issues.push({
      path: `${path}.zip.endDistanceFromBackCm`,
      code: "construction_invalid",
      message: "The zip must stop on the straight part of the end walls (≥ corner radius).",
    });
  }
  if (c.lidShellThickness + d.lid.pocket.depth + d.lid.padding + d.lid.board > d.lidHeight + EPS) {
    issues.push({ path: `${path}.lidShellThickness`, code: "construction_invalid", message: "Lid shell + pocket stack exceeds the lid height." });
  }
  if (c.cushionCornerRadius > Math.min(d.cushion.depth, d.cushion.height) / 2) {
    issues.push({ path: `${path}.cushionCornerRadius`, code: "construction_invalid", message: "Cushion corner radius is too large for the cushion." });
  }
  return issues;
};

export const computeBoxLayout = (d: Dimensions, c: Construction): BoxLayout => {
  const issues = [...validateDimensions(d), ...validateConstruction(d, c)];
  if (issues.length > 0) {
    throw new DimensionError(issues);
  }

  const hx = d.outer.length / 2;
  const hz = d.outer.depth / 2;
  const outerContour: RoundedRect = { hu: hx, hv: hz, r: c.cornerRadius };

  /* ---------- base ---------- */
  const cavityHx = hx - d.walls.end;
  const cavityHz = hz - d.walls.side;
  const { count, width, divider } = d.compartments;

  const compartments: Compartment[] = [];
  const dividers: Divider[] = [];
  let cursor = -cavityHx;
  for (let i = 0; i < count; i++) {
    compartments.push({ index: i, minX: cursor, maxX: cursor + width, centerX: cursor + width / 2, width });
    cursor += width;
    if (i < count - 1) {
      dividers.push({ index: i, minX: cursor, maxX: cursor + divider, centerX: cursor + divider / 2, width: divider });
      cursor += divider;
    }
  }

  const cushionWidth = d.cushion.width + d.cushion.oversize;
  const cushions: CushionLayout[] = compartments.map((comp) => ({
    index: comp.index,
    center: [comp.centerX, d.floor + d.cushion.height / 2, 0],
    size: [Math.min(cushionWidth, comp.width + d.cushion.oversize), d.cushion.height, d.cushion.depth],
  }));

  /* ---------- lid ---------- */
  const lidCavity: RoundedRect = { hu: hx - d.lid.wall, hv: hz - d.lid.wall, r: c.cavityCornerRadius };
  const bottomY = d.baseHeight;
  const topY = d.outer.height;
  const innerTopY = topY - c.lidShellThickness;
  const pocketThickness = d.lid.padding + d.lid.board;
  const pocketFaceY = bottomY + c.pocketFaceRecess;
  // Hinge side (back, −z) holds the pocket; the flap sits towards the front edge.
  const pocketMinZ = -lidCavity.hv;
  const pocketMaxZ = pocketMinZ + d.lid.pocket.height;
  const flapMaxZ = lidCavity.hv;
  const flapMinZ = flapMaxZ - d.lid.flapHeight;

  // Strap sits over the divider nearest the centre: never above a crystal.
  let strapDivider = dividers[0];
  for (const div of dividers) {
    if (Math.abs(div.centerX) < Math.abs(strapDivider.centerX) - EPS) strapDivider = div;
  }
  const strapX = strapDivider.centerX;
  const strapRootZ = lidCavity.hv;
  const snapZ = strapRootZ - d.lid.strap.snapFromEdge;
  const strapThickness = c.strapThickness;

  /* ---------- zip ---------- */
  const zipContour = offsetRect(outerContour, -d.zipInset);
  const stopZ = -hz + c.zip.endDistanceFromBackCm;
  const startS = arcLengthOnEndEdge(zipContour, "positive", stopZ);
  const endS = arcLengthOnEndEdge(zipContour, "negative", stopZ);

  return {
    outer: { length: d.outer.length, depth: d.outer.depth, height: d.outer.height, hx, hz, cornerRadius: c.cornerRadius },
    outerContour,
    base: {
      height: d.baseHeight,
      floorY: d.floor,
      cavity: {
        hu: cavityHx,
        hv: cavityHz,
        r: c.cavityCornerRadius,
        minX: -cavityHx,
        maxX: cavityHx,
        minZ: -cavityHz,
        maxZ: cavityHz,
      },
      compartments,
      dividers,
      dividerHeight: d.cushion.height + c.dividerHeightOffset,
      cushions,
    },
    lid: {
      bottomY,
      topY,
      height: d.lidHeight,
      hinge: { y: bottomY, z: -hz },
      cavity: lidCavity,
      innerTopY,
      pocket: {
        centerX: 0,
        centerZ: (pocketMinZ + pocketMaxZ) / 2,
        width: d.lid.pocket.width,
        usableWidth: d.lid.pocket.usableWidth,
        height: d.lid.pocket.height,
        minZ: pocketMinZ,
        maxZ: pocketMaxZ,
        faceY: pocketFaceY,
        thickness: pocketThickness,
        depth: d.lid.pocket.depth,
      },
      flap: {
        width: d.lid.pocket.width,
        minZ: flapMinZ,
        maxZ: flapMaxZ,
        faceY: pocketFaceY + c.flapRecess,
        thickness: 0.1,
      },
      strap: {
        x: strapX,
        width: d.lid.strap.width,
        thickness: strapThickness,
        rootZ: strapRootZ,
        snapZ,
        tipZ: snapZ - d.lid.strap.width / 2,
        stepZ: pocketMaxZ,
      },
      snap: { x: strapX, z: snapZ, y: pocketFaceY - strapThickness, radius: c.snapCapRadius },
    },
    zip: { contour: zipContour, startS, endS, stopZ, pullSide: c.zip.pullSide },
    engraving: {
      // Inside of the lid: the exact centre is taken by the snap fastener (blueprint:
      // snap 3.5 cm from the edge), so the text is centred left–right on the pocket
      // front, in the clear band between the strap tip and the pocket's lower stitching.
      // Faces −y in the closed lid; reads upright with the lid open (lid front edge on top).
      "lid-inside": (() => {
        const top = snapZ - d.lid.strap.width / 2 - 0.3;
        const bottom = pocketMinZ + c.stitch.pocketInset + 0.25;
        return {
          placement: "lid-inside" as const,
          assembly: "lid" as const,
          surface: "pocket",
          center: [0, pocketFaceY, (top + bottom) / 2] as Vec3,
          normal: [0, -1, 0] as Vec3,
          tangent: [1, 0, 0] as Vec3,
          widthCm: 0,
          heightCm: 0,
          maxWidthCm: d.lid.pocket.width - 2 * (c.stitch.pocketInset + 0.3),
          maxHeightCm: top - bottom,
        };
      })(),
      "lid-top": {
        placement: "lid-top",
        assembly: "lid",
        surface: "exterior",
        center: [0, topY, 0],
        normal: [0, 1, 0],
        tangent: [1, 0, 0],
        widthCm: 0,
        heightCm: 0,
        maxWidthCm: 2 * (hx - c.lidTopEdgeRadius),
        maxHeightCm: 2 * (hz - c.lidTopEdgeRadius),
      },
    },
    strapDividerIndex: strapDivider.index,
  };
};

export const isEngravingPlacement = (id: string): id is EngravingPlacement => (ENGRAVING_PLACEMENTS as readonly string[]).includes(id);

/**
 * Applies a product's engraving area to the given placements and checks it
 * fits each surface (clear of stitching, strap and snap).
 */
export const withEngravingArea = (
  layout: BoxLayout,
  area: { widthCm: number; heightCm: number },
  placements: readonly string[] = ENGRAVING_PLACEMENTS,
): BoxLayout => {
  const issues: Issue[] = [];
  const engraving = { ...layout.engraving };
  for (const id of placements) {
    if (!isEngravingPlacement(id)) {
      issues.push({ path: "engraving", code: "unknown_placement", message: `No engraving surface "${id}" exists on the box.` });
      continue;
    }
    const anchor = layout.engraving[id];
    if (area.widthCm > anchor.maxWidthCm + EPS || area.heightCm > anchor.maxHeightCm + EPS) {
      issues.push({
        path: "engraving",
        code: "engraving_too_large",
        message: `Engraving area ${area.widthCm} × ${area.heightCm} cm does not fit "${id}" (max ${fmt(anchor.maxWidthCm)} × ${fmt(anchor.maxHeightCm)} cm).`,
      });
      continue;
    }
    engraving[id] = { ...anchor, widthCm: area.widthCm, heightCm: area.heightCm };
  }
  if (issues.length > 0) throw new DimensionError(issues);
  return { ...layout, engraving };
};

/**
 * Where the exterior logo goes: the middle of the outside of the lid (the
 * "lid-top" surface), centred, reading left to right seen from the front.
 * Throws a DimensionError if the area doesn't fit inside the lid's rounded top edge.
 */
export const logoAnchor = (layout: BoxLayout, area: { widthCm: number; heightCm: number }): EngravingAnchor => {
  const top = layout.engraving["lid-top"];
  if (area.widthCm > top.maxWidthCm + EPS || area.heightCm > top.maxHeightCm + EPS) {
    throw new DimensionError([
      {
        path: "logo",
        code: "logo_area_too_large",
        message: `Logo area ${area.widthCm} × ${area.heightCm} cm does not fit the top of the lid (max ${fmt(top.maxWidthCm)} × ${fmt(top.maxHeightCm)} cm).`,
      },
    ]);
  }
  return { ...top, widthCm: area.widthCm, heightCm: area.heightCm };
};

/** Size of a logo with the given aspect ratio (width / height), fitted inside its area. */
export const fitLogo = (area: { widthCm: number; heightCm: number }, aspect: number): { widthCm: number; heightCm: number } => {
  if (!Number.isFinite(aspect) || aspect <= 0) return { widthCm: area.widthCm, heightCm: area.heightCm };
  return aspect >= area.widthCm / area.heightCm
    ? { widthCm: area.widthCm, heightCm: area.widthCm / aspect }
    : { widthCm: area.heightCm * aspect, heightCm: area.heightCm };
};

/** True if x lies above any compartment (i.e. above a watch crystal). */
export const isAboveCompartment = (layout: BoxLayout, x: number, halfWidth = 0): boolean =>
  layout.base.compartments.some((c) => x + halfWidth > c.minX + EPS && x - halfWidth < c.maxX - EPS);
