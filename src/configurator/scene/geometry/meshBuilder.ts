/**
 * Small parametric mesh toolkit used to build the leather box from the
 * blueprint layout: profile sweeps around rounded-rectangle contours, flat
 * caps and annular bridges. Normals are analytic, so the soft leather edges
 * shade smoothly at any render resolution.
 */
import { BufferGeometry, Float32BufferAttribute, Matrix4, Vector3 } from "three";
import { offsetRect, sampleContour, samplePath, type ContourPoint, type RoundedRect } from "../../geometry/roundedRect";

export type V3 = [number, number, number];

/** Maps contour plane coordinates (u, v) and sweep height h to (x, y, z). */
export type AxisMap = (u: number, v: number, h: number) => V3;
/** Plan contour (u = x, v = z), swept upwards along y. */
export const AXES_Y: AxisMap = (u, v, h) => [u, h, v];
/** Cross-section contour (u = z, v = y), swept along x. */
export const AXES_X: AxisMap = (u, v, h) => [h, v, u];

export interface ProfilePoint {
  /** Offset from the contour along its outward normal. */
  o: number;
  /** Position along the sweep axis. */
  h: number;
  /** Surface normal in (o, h) space. */
  no: number;
  nh: number;
}

export interface SweepOptions {
  axes?: AxisMap;
  segmentsPerCorner?: number;
  edgeSubdivisions?: number;
}

const DEFAULTS = { segmentsPerCorner: 10, edgeSubdivisions: 1 };

export class MeshBuilder {
  private positions: number[] = [];
  private normals: number[] = [];
  private uvs: number[] = [];
  private indices: number[] = [];

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  vertex(p: V3, n: V3, uv: [number, number] = [0, 0]): number {
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    this.positions.push(p[0], p[1], p[2]);
    this.normals.push(n[0] / len, n[1] / len, n[2] / len);
    this.uvs.push(uv[0], uv[1]);
    return this.vertexCount - 1;
  }

  private read(attr: number[], i: number): V3 {
    return [attr[i * 3], attr[i * 3 + 1], attr[i * 3 + 2]];
  }

  /** Adds a triangle, winding it so the face agrees with the vertex normals. */
  triangle(a: number, b: number, c: number): void {
    const pa = this.read(this.positions, a);
    const pb = this.read(this.positions, b);
    const pc = this.read(this.positions, c);
    const e1: V3 = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
    const e2: V3 = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const fn: V3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const area2 = Math.hypot(fn[0], fn[1], fn[2]);
    if (area2 < 1e-12) return; // degenerate (e.g. zero-radius corner)
    const na = this.read(this.normals, a);
    const nb = this.read(this.normals, b);
    const nc = this.read(this.normals, c);
    const dot = fn[0] * (na[0] + nb[0] + nc[0]) + fn[1] * (na[1] + nb[1] + nc[1]) + fn[2] * (na[2] + nb[2] + nc[2]);
    if (dot >= 0) this.indices.push(a, b, c);
    else this.indices.push(a, c, b);
  }

  quad(a: number, b: number, c: number, d: number): void {
    this.triangle(a, b, c);
    this.triangle(a, c, d);
  }

  /** Applies a transform to every vertex added since `fromVertex`. */
  transform(matrix: Matrix4, fromVertex = 0): void {
    const normalMatrix = new Matrix4().copy(matrix).invert().transpose();
    const p = new Vector3();
    for (let i = fromVertex; i < this.vertexCount; i++) {
      p.set(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]).applyMatrix4(matrix);
      this.positions[i * 3] = p.x;
      this.positions[i * 3 + 1] = p.y;
      this.positions[i * 3 + 2] = p.z;
      p.set(this.normals[i * 3], this.normals[i * 3 + 1], this.normals[i * 3 + 2]).transformDirection(normalMatrix);
      this.normals[i * 3] = p.x;
      this.normals[i * 3 + 1] = p.y;
      this.normals[i * 3 + 2] = p.z;
    }
  }

  /** Moves vertices (positions only) with an arbitrary function — e.g. a gentle shear. */
  deform(fn: (p: V3) => V3, fromVertex = 0): void {
    for (let i = fromVertex; i < this.vertexCount; i++) {
      const out = fn(this.read(this.positions, i));
      this.positions[i * 3] = out[0];
      this.positions[i * 3 + 1] = out[1];
      this.positions[i * 3 + 2] = out[2];
    }
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute("normal", new Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute("uv", new Float32BufferAttribute(this.uvs, 2));
    geometry.setIndex(this.indices);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

/* ------------------------------------------------------------------ */
/* Profiles                                                            */
/* ------------------------------------------------------------------ */

/** Quarter (or any) arc in (o, h) space; normal points away from the centre. */
export const arc = (co: number, ch: number, r: number, a0: number, a1: number, segments = 8): ProfilePoint[] => {
  const pts: ProfilePoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = a0 + ((a1 - a0) * i) / segments;
    pts.push({ o: co + r * Math.cos(a), h: ch + r * Math.sin(a), no: Math.cos(a), nh: Math.sin(a) });
  }
  return pts;
};

export const line = (o0: number, h0: number, o1: number, h1: number, normal: [number, number], segments = 1): ProfilePoint[] => {
  const pts: ProfilePoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    pts.push({ o: o0 + (o1 - o0) * t, h: h0 + (h1 - h0) * t, no: normal[0], nh: normal[1] });
  }
  return pts;
};

/** Concatenates profile parts, dropping duplicated joints. */
export const profile = (...parts: ProfilePoint[][]): ProfilePoint[] => {
  const out: ProfilePoint[] = [];
  for (const part of parts) {
    for (const p of part) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.o - p.o) < 1e-9 && Math.abs(last.h - p.h) < 1e-9) continue;
      out.push(p);
    }
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

const contourOf = (rect: RoundedRect, opts: SweepOptions): ContourPoint[] =>
  sampleContour(rect, opts.segmentsPerCorner ?? DEFAULTS.segmentsPerCorner, opts.edgeSubdivisions ?? DEFAULTS.edgeSubdivisions);

/** Sweeps a profile around a closed rounded-rectangle contour. */
export const sweep = (builder: MeshBuilder, rect: RoundedRect, prof: ProfilePoint[], opts: SweepOptions = {}): void => {
  const axes = opts.axes ?? AXES_Y;
  const contour = contourOf(rect, opts);
  const n = contour.length;
  const rows: number[][] = [];
  let vAcc = 0;
  prof.forEach((pp, j) => {
    if (j > 0) vAcc += Math.hypot(pp.o - prof[j - 1].o, pp.h - prof[j - 1].h);
    rows.push(
      contour.map((c) =>
        builder.vertex(
          axes(c.u + pp.o * c.nu, c.v + pp.o * c.nv, pp.h),
          axes(pp.no * c.nu, pp.no * c.nv, pp.nh),
          [c.s, vAcc],
        ),
      ),
    );
  });
  for (let j = 0; j < rows.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const i2 = (i + 1) % n;
      builder.quad(rows[j][i], rows[j][i2], rows[j + 1][i2], rows[j + 1][i]);
    }
  }
};

/** Flat cap filling a (convex) contour offset by `offset`, at height h, facing ±axis. */
export const fill = (
  builder: MeshBuilder,
  rect: RoundedRect,
  offset: number,
  h: number,
  facing: 1 | -1,
  opts: SweepOptions = {},
): void => {
  const axes = opts.axes ?? AXES_Y;
  const contour = contourOf(rect, opts);
  const normal = axes(0, 0, facing);
  const center = builder.vertex(axes(rect.cu ?? 0, rect.cv ?? 0, h), normal, [rect.cu ?? 0, rect.cv ?? 0]);
  const ring = contour.map((c) => {
    const u = c.u + offset * c.nu;
    const v = c.v + offset * c.nv;
    return builder.vertex(axes(u, v, h), normal, [u, v]);
  });
  for (let i = 0; i < ring.length; i++) {
    builder.triangle(center, ring[i], ring[(i + 1) % ring.length]);
  }
};

/** Flat annulus between two contours (same sampling structure) at height h. */
export const bridge = (
  builder: MeshBuilder,
  outer: RoundedRect,
  outerOffset: number,
  inner: RoundedRect,
  innerOffset: number,
  h: number,
  facing: 1 | -1,
  opts: SweepOptions = {},
): void => {
  const axes = opts.axes ?? AXES_Y;
  const a = contourOf(outer, opts);
  const b = contourOf(inner, opts);
  if (a.length !== b.length) throw new Error("bridge(): contours must share a sampling structure");
  const normal = axes(0, 0, facing);
  const ra = a.map((c) => {
    const u = c.u + outerOffset * c.nu;
    const v = c.v + outerOffset * c.nv;
    return builder.vertex(axes(u, v, h), normal, [u, v]);
  });
  const rb = b.map((c) => {
    const u = c.u + innerOffset * c.nu;
    const v = c.v + innerOffset * c.nv;
    return builder.vertex(axes(u, v, h), normal, [u, v]);
  });
  for (let i = 0; i < ra.length; i++) {
    const i2 = (i + 1) % ra.length;
    builder.quad(ra[i], ra[i2], rb[i2], rb[i]);
  }
};

/** Flat ribbon following part of a contour (e.g. zip tape), between two offsets. */
export const ribbon = (
  builder: MeshBuilder,
  rect: RoundedRect,
  s0: number,
  s1: number,
  offsetA: number,
  offsetB: number,
  h: number,
  facing: 1 | -1,
  step = 0.1,
): void => {
  const pts = samplePath(rect, s0, s1, step);
  const normal = AXES_Y(0, 0, facing);
  const rowA = pts.map((c) => builder.vertex(AXES_Y(c.u + offsetA * c.nu, c.v + offsetA * c.nv, h), normal, [c.s, 0]));
  const rowB = pts.map((c) => builder.vertex(AXES_Y(c.u + offsetB * c.nu, c.v + offsetB * c.nv, h), normal, [c.s, 1]));
  for (let i = 0; i < pts.length - 1; i++) {
    builder.quad(rowA[i], rowA[i + 1], rowB[i + 1], rowB[i]);
  }
};

/**
 * A closed slab with soft edges: contour swept from y0 to y0 + thickness,
 * with separate bottom/top edge radii and flat caps.
 */
export const roundedSlab = (
  builder: MeshBuilder,
  rect: RoundedRect,
  y0: number,
  thickness: number,
  bottomRadius: number,
  topRadius: number,
  opts: SweepOptions = {},
): void => {
  // Edge radii can't exceed the plan corner radius, or the inset cap contour would self-intersect.
  const eb = Math.min(bottomRadius, thickness / 2, rect.r);
  const et = Math.min(topRadius, thickness / 2, rect.r);
  const y1 = y0 + thickness;
  sweep(
    builder,
    rect,
    profile(arc(-eb, y0 + eb, eb, -Math.PI / 2, 0, 5), line(0, y0 + eb, 0, y1 - et, [1, 0]), arc(-et, y1 - et, et, 0, Math.PI / 2, 5)),
    opts,
  );
  fill(builder, rect, -eb, y0, -1, opts);
  fill(builder, rect, -et, y1, 1, opts);
};

export { offsetRect };
