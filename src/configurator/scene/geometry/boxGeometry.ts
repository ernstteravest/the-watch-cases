/**
 * Builds every mesh of the watch box from the blueprint layout. Pure: no React,
 * no WebGL — the same function feeds the live preview and the final render,
 * and is unit-tested for dimensional accuracy.
 *
 * All geometry is created in its assembly's coordinates (base, or lid in its
 * closed position) so the procedural leather grain and the analytic ambient
 * occlusion can work in object space.
 */
import { BufferGeometry, CylinderGeometry, Matrix4, SphereGeometry, TorusGeometry, Vector3 } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Construction } from "../../catalog/schema";
import type { BoxLayout } from "../../geometry/layout";
import { pointAt, samplePath, type ContourPoint, type RoundedRect } from "../../geometry/roundedRect";
import { arc, AXES_X, bridge, fill, line, MeshBuilder, profile, ribbon, roundedSlab, sweep, type ProfilePoint, type V3 } from "./meshBuilder";

export const AO_MAX = 10;

export type AoType = "solid" | "cavity" | "ground";

/** Signed-distance primitive used by the shader's analytic ambient occlusion. */
export interface AoPrimitive {
  type: AoType;
  center: V3;
  half: V3;
  radius: number;
  /** Surfaces skip primitives of their own group (no self-occlusion). */
  group: number;
}

export const AO_GROUP = {
  none: -1,
  cavity: 0,
  divider: 1,
  cushion: 2,
  ground: 3,
  pocket: 4,
  flap: 5,
  strap: 6,
} as const;

export interface BoxGeometries {
  base: {
    shell: BufferGeometry;
    band: BufferGeometry;
    lining: BufferGeometry;
    dividers: BufferGeometry;
    cushions: BufferGeometry;
    hinge: BufferGeometry;
    tape: BufferGeometry;
    teeth: Matrix4[];
    slider: BufferGeometry;
    pullLink: BufferGeometry;
    pullTab: BufferGeometry;
    stitches: Matrix4[];
  };
  lid: {
    shell: BufferGeometry;
    band: BufferGeometry;
    lining: BufferGeometry;
    pocket: BufferGeometry;
    flap: BufferGeometry;
    strap: BufferGeometry;
    snap: BufferGeometry;
    tape: BufferGeometry;
    teeth: Matrix4[];
    stitches: Matrix4[];
    pocketStitches: Matrix4[];
    flapStitches: Matrix4[];
  };
  shared: { tooth: BufferGeometry; stitch: BufferGeometry };
  ao: { base: AoPrimitive[]; baseExterior: AoPrimitive[]; lid: AoPrimitive[] };
  dispose: () => void;
}

const TAPE_LIFT = 0.006;
const TOOTH = { along: 0.11, height: 0.075, across: 0.28 };

/* ------------------------------------------------------------------ */
/* Instance helpers                                                    */
/* ------------------------------------------------------------------ */

const frameMatrix = (position: V3, xAxis: V3, yAxis: V3, scale: V3 = [1, 1, 1]): Matrix4 => {
  const x = new Vector3(...xAxis).normalize();
  const y = new Vector3(...yAxis).normalize();
  const z = new Vector3().crossVectors(x, y).normalize();
  const m = new Matrix4().makeBasis(x.multiplyScalar(scale[0]), y.multiplyScalar(scale[1]), z.multiplyScalar(scale[2]));
  m.setPosition(position[0], position[1], position[2]);
  return m;
};

const stitchScale = (c: Construction): V3 => [c.stitch.length / 2, 0.022, c.stitch.width / 2];

/** Stitches on a vertical wall following a contour at height y. */
const wallStitches = (rect: RoundedRect, y: number, c: Construction): Matrix4[] => {
  const pts = samplePath(rect, 0, perimeterOf(rect) - c.stitch.spacing * 0.5, c.stitch.spacing);
  return pts.map((p) =>
    frameMatrix([p.u + p.nu * 0.004, y, p.v + p.nv * 0.004], [p.tu, 0, p.tv], [p.nu, 0, p.nv], stitchScale(c)),
  );
};

/** Stitches on a horizontal face (facing ±y) following a closed contour. */
const faceStitches = (rect: RoundedRect, y: number, facing: 1 | -1, c: Construction): Matrix4[] => {
  const pts = samplePath(rect, 0, perimeterOf(rect) - c.stitch.spacing * 0.5, c.stitch.spacing);
  return pts.map((p) => frameMatrix([p.u, y + 0.004 * facing, p.v], [p.tu, 0, p.tv], [0, facing, 0], stitchScale(c)));
};

const perimeterOf = (rect: RoundedRect) => {
  const su = Math.max(2 * (rect.hu - rect.r), 0);
  const sv = Math.max(2 * (rect.hv - rect.r), 0);
  return 2 * su + 2 * sv + 2 * Math.PI * rect.r;
};

/* ------------------------------------------------------------------ */

export const buildBoxGeometries = (layout: BoxLayout, c: Construction): BoxGeometries => {
  const outer = layout.outerContour;
  const Hb = layout.base.height;
  const H = layout.outer.height;
  const floor = layout.base.floorY;
  const cavity = layout.base.cavity;
  const fR = c.rimFilletRadius;
  const band = c.rimBandDepth;

  /* ---------------- base ---------------- */
  const shell = new MeshBuilder();
  const eT = c.baseTopEdgeRadius;
  const eB = c.baseBottomEdgeRadius;
  sweep(
    shell,
    outer,
    profile(arc(-eT, Hb - eT, eT, Math.PI / 2, 0, 8), line(0, Hb - eT, 0, eB, [1, 0]), arc(-eB, eB, eB, 0, -Math.PI / 2, 8)),
  );
  fill(shell, outer, -eB, 0, -1);
  bridge(shell, outer, -eT, cavity, fR, Hb, 1);

  const bandB = new MeshBuilder();
  sweep(bandB, cavity, profile(arc(fR, Hb - fR, fR, Math.PI / 2, Math.PI, 6), line(0, Hb - fR, 0, Hb - band, [-1, 0])));

  const lining = new MeshBuilder();
  sweep(lining, cavity, line(0, Hb - band, 0, floor, [-1, 0], 2));
  fill(lining, cavity, 0, floor, 1);

  const dividers = new MeshBuilder();
  for (const d of layout.base.dividers) {
    roundedSlab(
      dividers,
      { hu: d.width / 2, hv: cavity.hv - 0.02, r: Math.min(0.32, d.width / 2), cu: d.centerX, cv: 0 },
      floor,
      layout.base.dividerHeight,
      0.04,
      0.3,
    );
  }

  const cushions = new MeshBuilder();
  const eR = c.cushionEndRadius;
  const bulge = 0.12;
  for (const cushion of layout.base.cushions) {
    const [cx, cy, cz] = cushion.center;
    const [sx, sy, sz] = cushion.size;
    const rect: RoundedRect = { hu: sz / 2, hv: sy / 2, r: Math.min(c.cushionCornerRadius, sy / 2 - 0.01), cu: cz, cv: cy };
    const x0 = cx - sx / 2;
    const x1 = cx + sx / 2;
    const straight: ProfilePoint[] = [];
    const n = 12;
    const half = (x1 - x0 - 2 * eR) / 2;
    for (let i = 0; i <= n; i++) {
      const t = -1 + (2 * i) / n;
      const o = bulge * (1 - t * t) * (1 - t * t);
      const dodh = (-4 * bulge * t * (1 - t * t)) / half;
      const len = Math.hypot(1, dodh);
      straight.push({ o, h: cx + t * half, no: 1 / len, nh: -dodh / len });
    }
    sweep(
      cushions,
      rect,
      profile(arc(-eR, x0 + eR, eR, -Math.PI / 2, 0, 6), straight, arc(-eR, x1 - eR, eR, 0, Math.PI / 2, 6)),
      { axes: AXES_X, segmentsPerCorner: 14 },
    );
    fill(cushions, rect, -eR, x0, -1, { axes: AXES_X, segmentsPerCorner: 14 });
    fill(cushions, rect, -eR, x1, 1, { axes: AXES_X, segmentsPerCorner: 14 });
  }

  const hinge = new CylinderGeometry(0.24, 0.24, 2 * (layout.outer.hx - c.cornerRadius) + 0.6, 20, 1);
  hinge.rotateZ(Math.PI / 2);
  hinge.translate(0, Hb, -layout.outer.hz + 0.2);

  /* ---------------- zip ---------------- */
  const zip = layout.zip;
  const tapeHalf = c.zip.tapeWidth / 2;
  const baseTape = new MeshBuilder();
  ribbon(baseTape, zip.contour, zip.startS, zip.endS, -tapeHalf, tapeHalf, Hb + TAPE_LIFT, 1);
  const lidTape = new MeshBuilder();
  ribbon(lidTape, zip.contour, zip.startS, zip.endS, -tapeHalf, tapeHalf, Hb - TAPE_LIFT, -1);

  const toothPoints = (offset: number) => samplePath(zip.contour, zip.startS + offset, zip.endS - c.zip.toothPitch / 2 + offset, c.zip.toothPitch);
  const baseTeeth = toothPoints(0).map((p) =>
    frameMatrix([p.u, Hb + TAPE_LIFT + TOOTH.height / 2, p.v], [p.tu, 0, p.tv], [0, 1, 0]),
  );
  const lidTeeth = toothPoints(c.zip.toothPitch / 2).map((p) =>
    frameMatrix([p.u, Hb - TAPE_LIFT - TOOTH.height / 2, p.v], [p.tu, 0, p.tv], [0, 1, 0]),
  );

  // Slider and pull, parked at the end of the run on the pull side.
  const pullS = zip.pullSide === "left" ? zip.endS - 0.5 : zip.startS + 0.5;
  const pp: ContourPoint = pointAt(zip.contour, pullS);
  const nOut: V3 = [pp.nu, 0, pp.nv];
  const up: V3 = [0, 1, 0];
  const sliderBase = Hb + TAPE_LIFT;
  const pullFrame = (local: V3) => {
    // local x = outward normal, y = up, z = n × up
    const z = new Vector3(...nOut).cross(new Vector3(...up));
    return [
      pp.u + nOut[0] * local[0] + z.x * local[2],
      sliderBase + local[1],
      pp.v + nOut[2] * local[0] + z.z * local[2],
    ] as V3;
  };
  const slider = new RoundedBoxGeometry(0.62, 0.3, 0.78, 3, 0.09);
  slider.applyMatrix4(frameMatrix(pullFrame([0.05, 0.17, 0]), nOut, up));
  const pullLink = new RoundedBoxGeometry(1.05, 0.07, 0.24, 2, 0.03);
  pullLink.applyMatrix4(frameMatrix(pullFrame([0.55, 0.3, 0]), nOut, up));

  const tab = new MeshBuilder();
  roundedSlab(tab, { hu: 0.85, hv: 0.36, r: 0.3, cu: 0.85, cv: 0 }, -0.08, 0.16, 0.05, 0.05);
  const droop = new Matrix4().makeRotationZ((-18 * Math.PI) / 180);
  const toFrame = frameMatrix(pullFrame([1.02, 0.3, 0]), nOut, up);
  tab.transform(new Matrix4().multiplyMatrices(toFrame, droop));

  const baseStitches = [
    ...wallStitches(outer, Hb - c.stitch.baseTopFromRim, c),
    ...wallStitches(outer, c.stitch.baseBottomFromFloor, c),
  ];

  /* ---------------- lid (closed position) ---------------- */
  const lid = layout.lid;
  const lidCavity = lid.cavity;
  const eLB = c.lidBottomEdgeRadius;
  const eLT = c.lidTopEdgeRadius;

  const lidShell = new MeshBuilder();
  sweep(
    lidShell,
    outer,
    profile(
      arc(-eLB, Hb + eLB, eLB, -Math.PI / 2, 0, 8),
      line(0, Hb + eLB, 0, H - eLT, [1, 0]),
      arc(-eLT, H - eLT, eLT, 0, Math.PI / 2, 10),
    ),
  );
  fill(lidShell, outer, -eLT, H, 1);
  bridge(lidShell, outer, -eLB, lidCavity, fR, Hb, -1);

  const lidBand = new MeshBuilder();
  sweep(lidBand, lidCavity, profile(arc(fR, Hb + fR, fR, -Math.PI / 2, -Math.PI, 6), line(0, Hb + fR, 0, Hb + band, [-1, 0])));

  const lidLining = new MeshBuilder();
  sweep(lidLining, lidCavity, line(0, Hb + band, 0, lid.innerTopY, [-1, 0], 1));
  fill(lidLining, lidCavity, 0, lid.innerTopY, -1);

  const pocket = new MeshBuilder();
  const pk = lid.pocket;
  roundedSlab(pocket, { hu: pk.width / 2, hv: pk.height / 2 - 0.04, r: 0.3, cu: pk.centerX, cv: pk.centerZ }, pk.faceY, pk.thickness, 0.13, 0.04);

  const flap = new MeshBuilder();
  const fl = lid.flap;
  const flapZ0 = fl.minZ - 0.35;
  const flapZ1 = fl.maxZ - 0.05;
  roundedSlab(flap, { hu: fl.width / 2, hv: (flapZ1 - flapZ0) / 2, r: 0.1, cu: 0, cv: (flapZ0 + flapZ1) / 2 }, fl.faceY, fl.thickness, 0.05, 0.02);

  const strap = new MeshBuilder();
  const st = lid.strap;
  const T = st.thickness;
  const stadiumR = st.width / 2 - 0.002;
  // Segment on the pocket face, ending in the rounded tip that carries the snap.
  const bZ1 = st.stepZ + 0.3;
  roundedSlab(strap, { hu: st.width / 2, hv: (bZ1 - st.tipZ) / 2, r: stadiumR, cu: st.x, cv: (st.tipZ + bZ1) / 2 }, pk.faceY - T, T, 0.035, 0.035);
  // Segment rising over the flap to where it is sewn into the lid edge.
  const aStart = strap.vertexCount;
  const aZ0 = st.stepZ - 0.2;
  const aZ1 = st.rootZ + 0.5;
  roundedSlab(strap, { hu: st.width / 2, hv: (aZ1 - aZ0) / 2, r: stadiumR, cu: st.x, cv: (aZ0 + aZ1) / 2 }, fl.faceY - T - 0.004, T, 0.035, 0.035);
  const rise = fl.faceY - pk.faceY;
  strap.deform(([x, y, z]) => [x, y - rise * ((st.rootZ - z) / (st.rootZ - st.stepZ)), z], aStart);

  const snapDome = new SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  snapDome.scale(lid.snap.radius, lid.snap.radius * 0.42, lid.snap.radius);
  snapDome.computeVertexNormals();
  snapDome.rotateX(Math.PI);
  snapDome.translate(lid.snap.x, lid.snap.y, lid.snap.z);
  const snapRim = new TorusGeometry(lid.snap.radius * 0.97, 0.03, 8, 48);
  snapRim.rotateX(Math.PI / 2);
  snapRim.translate(lid.snap.x, lid.snap.y - 0.012, lid.snap.z);
  const snap = mergeGeometries([snapDome, snapRim]) ?? snapDome;
  snapRim.dispose();
  if (snap !== snapDome) snapDome.dispose();

  const lidStitches = wallStitches(outer, Hb + c.stitch.lidWallFromRim, c);
  const pocketStitches = faceStitches(
    { hu: pk.width / 2 - c.stitch.pocketInset, hv: pk.height / 2 - c.stitch.pocketInset, r: 0.22, cu: pk.centerX, cv: pk.centerZ },
    pk.faceY,
    -1,
    c,
  );
  const flapStitches: Matrix4[] = [];
  {
    const z = fl.maxZ - c.stitch.flapFromEdge;
    const x0 = -fl.width / 2 + 0.4;
    const x1 = fl.width / 2 - 0.4;
    const count = Math.floor((x1 - x0) / c.stitch.spacing);
    for (let i = 0; i <= count; i++) {
      const x = x0 + ((x1 - x0) * i) / count;
      if (Math.abs(x - st.x) < st.width / 2 + 0.05) continue; // hidden under the strap
      flapStitches.push(frameMatrix([x, fl.faceY - 0.004, z], [1, 0, 0], [0, -1, 0], stitchScale(c)));
    }
  }

  /* ---------------- shared instance shapes ---------------- */
  const tooth = new RoundedBoxGeometry(TOOTH.along, TOOTH.height, TOOTH.across, 2, 0.025);
  const stitch = new SphereGeometry(1, 10, 6);

  /* ---------------- analytic AO primitives ---------------- */
  const cav = layout.base.cavity;
  const aoBase: AoPrimitive[] = [
    { type: "cavity", center: [0, floor + 50, 0], half: [cav.hu, 50, cav.hv], radius: 0, group: AO_GROUP.cavity },
    ...layout.base.dividers.map<AoPrimitive>((d) => ({
      type: "solid",
      center: [d.centerX, floor + layout.base.dividerHeight / 2, 0],
      half: [d.width / 2, layout.base.dividerHeight / 2, cav.hv - 0.02],
      radius: 0.3,
      group: AO_GROUP.divider,
    })),
    ...layout.base.cushions.map<AoPrimitive>((cu) => ({
      type: "solid",
      center: cu.center,
      half: [cu.size[0] / 2, cu.size[1] / 2, cu.size[2] / 2],
      radius: Math.min(c.cushionCornerRadius, cu.size[1] / 2) * 0.8,
      group: AO_GROUP.cushion,
    })),
  ];
  const aoLid: AoPrimitive[] = [
    { type: "cavity", center: [0, lid.innerTopY - 50, 0], half: [lidCavity.hu, 50, lidCavity.hv], radius: 0, group: AO_GROUP.cavity },
    {
      type: "solid",
      center: [pk.centerX, pk.faceY + pk.thickness / 2, pk.centerZ],
      half: [pk.width / 2, pk.thickness / 2, pk.height / 2],
      radius: 0.12,
      group: AO_GROUP.pocket,
    },
    {
      type: "solid",
      center: [0, fl.faceY + fl.thickness / 2, (fl.minZ + fl.maxZ) / 2],
      half: [fl.width / 2, fl.thickness / 2, (fl.maxZ - fl.minZ) / 2],
      radius: 0.04,
      group: AO_GROUP.flap,
    },
    {
      type: "solid",
      center: [st.x, pk.faceY - T / 2, (st.tipZ + st.stepZ) / 2],
      half: [st.width / 2, T / 2, (st.stepZ - st.tipZ) / 2],
      radius: 0.05,
      group: AO_GROUP.strap,
    },
  ];
  const aoGround: AoPrimitive[] = [{ type: "ground", center: [0, 0, 0], half: [0, 0, 0], radius: 0, group: AO_GROUP.ground }];

  const result: BoxGeometries = {
    base: {
      shell: shell.build(),
      band: bandB.build(),
      lining: lining.build(),
      dividers: dividers.build(),
      cushions: cushions.build(),
      hinge,
      tape: baseTape.build(),
      teeth: baseTeeth,
      slider,
      pullLink,
      pullTab: tab.build(),
      stitches: baseStitches,
    },
    lid: {
      shell: lidShell.build(),
      band: lidBand.build(),
      lining: lidLining.build(),
      pocket: pocket.build(),
      flap: flap.build(),
      strap: strap.build(),
      snap,
      tape: lidTape.build(),
      teeth: lidTeeth,
      stitches: lidStitches,
      pocketStitches,
      flapStitches,
    },
    shared: { tooth, stitch },
    ao: { base: aoBase, baseExterior: aoGround, lid: aoLid },
    dispose: () => {
      const all = [
        ...Object.values(result.base),
        ...Object.values(result.lid),
        ...Object.values(result.shared),
      ].filter((g): g is BufferGeometry => g instanceof BufferGeometry);
      all.forEach((g) => g.dispose());
    },
  };
  return result;
};
