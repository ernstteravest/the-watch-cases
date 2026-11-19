/**
 * Rounded-rectangle contours in a 2D (u, v) plane.
 *
 * The parameterisation starts at the lower end of the +u edge and runs
 * counter-clockwise: +u edge → (+u,+v) corner → +v edge → (−u,+v) corner →
 * −u edge → (−u,−v) corner → −v edge → (+u,−v) corner.
 *
 * For box plan views u = x (length) and v = z (depth, +z = front), so the
 * order is: right end → front-right → front → front-left → left end →
 * back-left → back → back-right.
 */

export interface RoundedRect {
  /** Half extent along u. */
  hu: number;
  /** Half extent along v. */
  hv: number;
  /** Corner radius. */
  r: number;
  /** Centre offset (defaults to 0, 0). */
  cu?: number;
  cv?: number;
}

export interface ContourPoint {
  u: number;
  v: number;
  /** Outward unit normal. */
  nu: number;
  nv: number;
  /** Unit tangent in the direction of travel. */
  tu: number;
  tv: number;
  /** Arc length from the start of the contour. */
  s: number;
}

export const offsetRect = (rect: RoundedRect, offset: number): RoundedRect => ({
  ...rect,
  hu: rect.hu + offset,
  hv: rect.hv + offset,
  r: Math.max(rect.r + offset, 0),
});

const straightU = (rect: RoundedRect) => Math.max(2 * (rect.hu - rect.r), 0);
const straightV = (rect: RoundedRect) => Math.max(2 * (rect.hv - rect.r), 0);
const cornerLength = (rect: RoundedRect) => (Math.PI / 2) * rect.r;

export const perimeter = (rect: RoundedRect): number =>
  2 * straightU(rect) + 2 * straightV(rect) + 4 * cornerLength(rect);

type Segment =
  | { kind: "line"; length: number; start: [number, number]; dir: [number, number]; normal: [number, number] }
  | { kind: "arc"; length: number; center: [number, number]; a0: number };

const segmentsOf = (rect: RoundedRect): Segment[] => {
  const { hu, hv, r } = rect;
  const cu = rect.cu ?? 0;
  const cv = rect.cv ?? 0;
  const su = hu - r;
  const sv = hv - r;
  const arc = (center: [number, number], a0: number): Segment => ({
    kind: "arc",
    length: cornerLength(rect),
    center: [center[0] + cu, center[1] + cv],
    a0,
  });
  const line = (start: [number, number], dir: [number, number], normal: [number, number], length: number): Segment => ({
    kind: "line",
    length,
    start: [start[0] + cu, start[1] + cv],
    dir,
    normal,
  });
  return [
    line([hu, -sv], [0, 1], [1, 0], straightV(rect)),
    arc([su, sv], 0),
    line([su, hv], [-1, 0], [0, 1], straightU(rect)),
    arc([-su, sv], Math.PI / 2),
    line([-hu, sv], [0, -1], [-1, 0], straightV(rect)),
    arc([-su, -sv], Math.PI),
    line([-su, -hv], [1, 0], [0, -1], straightU(rect)),
    arc([su, -sv], (3 * Math.PI) / 2),
  ];
};

const pointOnSegment = (seg: Segment, local: number, r: number, s: number): ContourPoint => {
  if (seg.kind === "line") {
    return {
      u: seg.start[0] + seg.dir[0] * local,
      v: seg.start[1] + seg.dir[1] * local,
      nu: seg.normal[0],
      nv: seg.normal[1],
      tu: seg.dir[0],
      tv: seg.dir[1],
      s,
    };
  }
  const t = seg.length > 0 ? local / seg.length : 0;
  const a = seg.a0 + t * (Math.PI / 2);
  const c = Math.cos(a);
  const sn = Math.sin(a);
  return { u: seg.center[0] + r * c, v: seg.center[1] + r * sn, nu: c, nv: sn, tu: -sn, tv: c, s };
};

/** Point at arc length `s` (wrapped) along the contour. */
export const pointAt = (rect: RoundedRect, s: number): ContourPoint => {
  const total = perimeter(rect);
  let remaining = total > 0 ? ((s % total) + total) % total : 0;
  const segs = segmentsOf(rect);
  for (const seg of segs) {
    if (remaining <= seg.length || seg === segs[segs.length - 1]) {
      return pointOnSegment(seg, Math.min(remaining, seg.length), rect.r, s);
    }
    remaining -= seg.length;
  }
  /* istanbul ignore next */
  return pointOnSegment(segs[0], 0, rect.r, s);
};

/**
 * Samples the full closed contour with a fixed structure (same point count
 * for any rect with the same options), so two contours can be bridged
 * point-by-point.
 */
export const sampleContour = (
  rect: RoundedRect,
  segmentsPerCorner: number,
  edgeSubdivisions = 1,
): ContourPoint[] => {
  const segs = segmentsOf(rect);
  const points: ContourPoint[] = [];
  let s = 0;
  for (const seg of segs) {
    if (seg.kind === "line") {
      // Interior points only; endpoints come from the neighbouring corners.
      for (let i = 1; i < edgeSubdivisions; i++) {
        const local = (seg.length * i) / edgeSubdivisions;
        points.push(pointOnSegment(seg, local, rect.r, s + local));
      }
    } else {
      for (let i = 0; i <= segmentsPerCorner; i++) {
        const local = (seg.length * i) / segmentsPerCorner;
        points.push(pointOnSegment(seg, local, rect.r, s + local));
      }
    }
    s += seg.length;
  }
  return points;
};

/** Evenly spaced points between arc lengths s0 and s1 (s1 may exceed the perimeter). */
export const samplePath = (rect: RoundedRect, s0: number, s1: number, spacing: number): ContourPoint[] => {
  const length = s1 - s0;
  const count = Math.max(1, Math.floor(length / spacing));
  const step = length / count;
  const points: ContourPoint[] = [];
  for (let i = 0; i <= count; i++) {
    points.push(pointAt(rect, s0 + i * step));
  }
  return points;
};

/**
 * Arc length where the contour crosses v = `v` on the +u edge (side "positive")
 * or the −u edge (side "negative"). Used to find where the zip stops on the end walls.
 */
export const arcLengthOnEndEdge = (rect: RoundedRect, side: "positive" | "negative", v: number): number => {
  const sv = rect.hv - rect.r;
  const cv = rect.cv ?? 0;
  const local = v - cv;
  if (side === "positive") {
    return local + sv;
  }
  const startOfNegativeEdge = straightV(rect) + cornerLength(rect) + straightU(rect) + cornerLength(rect);
  return startOfNegativeEdge + (sv - local);
};
