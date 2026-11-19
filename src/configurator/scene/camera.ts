/**
 * Camera framing: computes where to put the camera so the whole box — with
 * the lid at its current angle — fills the frame with a fixed margin.
 * Pure maths, unit-tested; shared by the preview and the render.
 */
import type { BoxLayout, Vec3 } from "../geometry/layout";

export interface CameraSetup {
  position: Vec3;
  target: Vec3;
  fov: number;
  near: number;
  far: number;
}

const deg = (d: number) => (d * Math.PI) / 180;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(a[0], a[1], a[2]));

/** Unit vector from the target towards the camera. Azimuth 0 = front (+z), positive turns to the right (+x). */
export const viewDirection = (azimuthDeg: number, elevationDeg: number): Vec3 => {
  const az = deg(azimuthDeg);
  const el = deg(elevationDeg);
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
};

/** Rotates a point of the closed lid open by `lidAngleDeg` around the hinge. */
export const openLidPoint = (layout: BoxLayout, p: Vec3, lidAngleDeg: number): Vec3 => {
  const a = deg(lidAngleDeg);
  const dy = p[1] - layout.lid.hinge.y;
  const dz = p[2] - layout.lid.hinge.z;
  // rotation.x = −angle
  return [p[0], layout.lid.hinge.y + dy * Math.cos(a) + dz * Math.sin(a), layout.lid.hinge.z + dz * Math.cos(a) - dy * Math.sin(a)];
};

/** Corner points that bound the visible product for a given lid angle. */
export const productCorners = (layout: BoxLayout, lidAngleDeg: number, pullExtent = 2): Vec3[] => {
  const { hx, hz } = layout.outer;
  const xs = [-hx - (layout.zip.pullSide === "left" ? pullExtent : 0), hx + (layout.zip.pullSide === "right" ? pullExtent : 0)];
  const corners: Vec3[] = [];
  for (const x of xs)
    for (const y of [0, layout.base.height])
      for (const z of [-hz, hz]) corners.push([x, y, z]);
  for (const x of [-hx, hx])
    for (const y of [layout.lid.bottomY, layout.lid.topY])
      for (const z of [-hz, hz]) corners.push(openLidPoint(layout, [x, y, z], lidAngleDeg));
  return corners;
};

interface Fit {
  distance: number;
  target: Vec3;
}

const fitOnce = (corners: Vec3[], target: Vec3, dir: Vec3, tanV: number, tanH: number, margin: number): Fit & { offset: [number, number] } => {
  const forward = scale(dir, -1);
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const k = 1 - margin;
  let distance = 0;
  for (const c of corners) {
    const q = sub(c, target);
    const along = dot(q, dir);
    const need = along + Math.max(Math.abs(dot(q, right)) / (tanH * k), Math.abs(dot(q, up)) / (tanV * k));
    distance = Math.max(distance, need);
  }
  // Re-centre: shift the target so the projected bounds are centred.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    const q = sub(c, target);
    const depth = distance - dot(q, dir);
    const x = dot(q, right) / depth;
    const y = dot(q, up) / depth;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const offset: [number, number] = [(minX + maxX) / 2, (minY + maxY) / 2];
  const shifted = add(add(target, scale(right, offset[0] * distance)), scale(up, offset[1] * distance));
  return { distance, target: shifted, offset };
};

export const fitCamera = (
  corners: Vec3[],
  azimuth: number,
  elevation: number,
  fov: number,
  aspect: number,
  margin: number,
): Fit => {
  const dir = viewDirection(azimuth, elevation);
  const tanV = Math.tan(deg(fov) / 2);
  const tanH = tanV * aspect;
  const center: Vec3 = [0, 0, 0];
  for (const c of corners) {
    center[0] += c[0] / corners.length;
    center[1] += c[1] / corners.length;
    center[2] += c[2] / corners.length;
  }
  let fit = fitOnce(corners, center, dir, tanV, tanH, margin);
  for (let i = 0; i < 3; i++) fit = fitOnce(corners, fit.target, dir, tanV, tanH, margin);
  return { distance: fit.distance, target: fit.target };
};

/**
 * Camera for a view. Distance is blended with the widest distance over a full
 * turn, so a 360° drag doesn't "breathe" too much while presets stay tight.
 */
export const computeCamera = (
  layout: BoxLayout,
  view: { azimuth: number; elevation: number; lidAngle: number },
  options: { fov: number; aspect: number; margin: number; verticalOffset?: number },
): CameraSetup => {
  const corners = productCorners(layout, view.lidAngle);
  const own = fitCamera(corners, view.azimuth, view.elevation, options.fov, options.aspect, options.margin);
  let widest = own.distance;
  for (let a = 0; a < 360; a += 30) {
    widest = Math.max(widest, fitCamera(corners, a, view.elevation, options.fov, options.aspect, options.margin).distance);
  }
  const distance = own.distance * 0.8 + widest * 0.2;
  const dir = viewDirection(view.azimuth, view.elevation);
  // Shift the camera down along its up vector so the product sits a bit higher,
  // leaving floor in front of it for the contact shadow.
  const forward = scale(dir, -1);
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const shift = scale(up, -2 * (options.verticalOffset ?? 0) * distance * Math.tan(deg(options.fov) / 2));
  const target = add(own.target, shift);
  return {
    position: add(target, scale(dir, distance)),
    target,
    fov: options.fov,
    near: Math.max(1, distance * 0.05),
    far: distance * 6 + 200,
  };
};

/**
 * Whether a personalization surface faces the camera in a given view (the
 * inside of the lid is only visible with the lid open). Used by the UI to
 * turn the box when the customer starts typing.
 */
export const isAnchorVisible = (
  layout: BoxLayout,
  anchor: { assembly: "lid" | "base"; normal: Vec3 },
  view: { azimuth: number; elevation: number; lidAngle: number },
  minFacing = 0.3,
): boolean => {
  let n = anchor.normal;
  if (anchor.assembly === "lid") {
    const a = deg(view.lidAngle);
    // Same rotation as openLidPoint, applied to a direction.
    n = [n[0], n[1] * Math.cos(a) + n[2] * Math.sin(a), n[2] * Math.cos(a) - n[1] * Math.sin(a)];
  }
  return dot(n, viewDirection(view.azimuth, view.elevation)) > minFacing;
};
