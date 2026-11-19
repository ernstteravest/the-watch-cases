/**
 * The shared 3D scene: studio lighting, floor, camera and the watch box.
 * Rendered inside <ThreeCanvas> by the Remotion still composition, which is
 * the very same component the configurator's live preview plays.
 */
import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useDelayRender, useRemotionEnvironment } from "remotion";
import {
  CanvasTexture,
  Color,
  DoubleSide,
  Matrix4,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  NoColorSpace,
  SRGBColorSpace,
  Vector3,
  type BufferGeometry,
  type DirectionalLight,
  type InstancedMesh,
  type Material,
  type PerspectiveCamera,
} from "three";
import type { ResolvedMaterial } from "../catalog/configuration";
import type { BoxLayout, EngravingAnchor } from "../geometry/layout";
import type { CameraSetup } from "./camera";
import type { LogoDescription, SceneDescription } from "./describeScene";
import type { EngravingMaps } from "./engraving/engravingMaps";
import { AO_GROUP, buildBoxGeometries, type AoPrimitive } from "./geometry/boxGeometry";
import { useEngravingMaps, useLeather, useLogoTexture, useStudioEnvironment } from "./hooks";
import { createMetalMaterial, createTapeMaterial, createThreadMaterial, type AoSettings } from "./materials/leatherMaterial";

const DEG = Math.PI / 180;

/* ------------------------------------------------------------------ */
/* Camera, lights, floor                                               */
/* ------------------------------------------------------------------ */

const CameraRig: React.FC<{ camera: CameraSetup }> = ({ camera }) => {
  const cam = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    cam.fov = camera.fov;
    cam.near = camera.near;
    cam.far = camera.far;
    cam.aspect = size.width / size.height;
    cam.position.set(...camera.position);
    cam.lookAt(...camera.target);
    cam.updateProjectionMatrix();
    invalidate();
  }, [cam, camera, size.width, size.height, invalidate]);
  return null;
};

/** Key light whose shadow matches the overhead softbox of the studio environment. */
const KeyLight: React.FC<{ layout: BoxLayout }> = ({ layout }) => {
  const ref = useRef<DirectionalLight>(null);
  const extent = Math.max(layout.outer.hx, layout.outer.hz) + 14;
  useLayoutEffect(() => {
    const light = ref.current;
    if (!light) return;
    const cam = light.shadow.camera;
    cam.left = -extent;
    cam.right = extent;
    cam.top = extent;
    cam.bottom = -extent;
    cam.near = 1;
    cam.far = 220;
    cam.updateProjectionMatrix();
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.radius = 9;
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.02;
    light.target.position.set(0, 2, 0);
    light.target.updateMatrixWorld();
  }, [extent]);
  return <directionalLight ref={ref} position={[34, 90, 22]} intensity={1.35} castShadow />;
};

const contactShadowTexture = (layout: BoxLayout): CanvasTexture => {
  const { hx, hz, cornerRadius } = layout.outer;
  const pad = 5; // cm around the footprint
  const pxPerCm = 16;
  const w = Math.round((2 * hx + 2 * pad) * pxPerCm);
  const h = Math.round((2 * hz + 2 * pad) * pxPerCm);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  const rr = (inset: number) => {
    const x = (pad + inset) * pxPerCm;
    const y = (pad + inset) * pxPerCm;
    const rw = (2 * hx - 2 * inset) * pxPerCm;
    const rh = (2 * hz - 2 * inset) * pxPerCm;
    ctx.beginPath();
    ctx.roundRect(x, y, rw, rh, Math.max(0, cornerRadius - inset) * pxPerCm);
  };
  // alphaMap reads luminance (green channel): white = shadow, black = none.
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.filter = `blur(${2.4 * pxPerCm}px)`;
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  rr(-0.8);
  ctx.fill();
  ctx.filter = `blur(${0.45 * pxPerCm}px)`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  rr(0.2);
  ctx.fill();
  ctx.filter = "none";
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = NoColorSpace;
  return texture;
};

const StudioFloor: React.FC<{ layout: BoxLayout }> = ({ layout }) => {
  const contact = useMemo(() => contactShadowTexture(layout), [layout]);
  const contactMaterial = useMemo(
    () => new MeshBasicMaterial({ color: new Color(0, 0, 0), alphaMap: contact, transparent: true, depthWrite: false, opacity: 0.62, toneMapped: false }),
    [contact],
  );
  useEffect(
    () => () => {
      contact.dispose();
      contactMaterial.dispose();
    },
    [contact, contactMaterial],
  );
  const pad = 5;
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow renderOrder={-2}>
        <planeGeometry args={[600, 600]} />
        <shadowMaterial transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.01} material={contactMaterial} renderOrder={-1}>
        <planeGeometry args={[2 * layout.outer.hx + 2 * pad, 2 * layout.outer.hz + 2 * pad]} />
      </mesh>
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Render gate: holds the Remotion render until the scene is complete   */
/* ------------------------------------------------------------------ */

const RenderGate: React.FC<{ ready: boolean; error: Error | null }> = ({ ready, error }) => {
  const { isRendering } = useRemotionEnvironment();
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const advance = useThree((s) => s.advance);
  const invalidate = useThree((s) => s.invalidate);
  const handle = useRef<number | null>(null);

  useLayoutEffect(() => {
    handle.current = delayRender("Preparing the watch box scene (environment, engraving font, logo)", { timeoutInMilliseconds: 120_000 });
    return () => {
      if (handle.current !== null) continueRender(handle.current);
      handle.current = null;
    };
  }, [delayRender, continueRender]);

  useEffect(() => {
    if (error) {
      if (isRendering) cancelRender(error);
      return;
    }
    if (!ready) return;
    // frameloop is "never" while rendering: draw the finished scene explicitly.
    if (isRendering) advance(performance.now());
    else invalidate();
    if (handle.current !== null) {
      continueRender(handle.current);
      handle.current = null;
    }
  }, [ready, error, isRendering, advance, invalidate, continueRender, cancelRender]);
  return null;
};

/* ------------------------------------------------------------------ */
/* Box model                                                           */
/* ------------------------------------------------------------------ */

const Instanced: React.FC<{ geometry: BufferGeometry; material: Material; matrices: Matrix4[]; castShadow?: boolean }> = ({
  geometry,
  material,
  matrices,
  castShadow,
}) => {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);
  if (matrices.length === 0) return null;
  return <instancedMesh key={matrices.length} ref={ref} args={[geometry, material, matrices.length]} castShadow={castShadow} />;
};

const useSimpleMaterial = <T extends Material>(factory: () => T, update: (m: T) => void, deps: unknown[]): T => {
  const invalidate = useThree((s) => s.invalidate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const material = useMemo(factory, []);
  useLayoutEffect(() => {
    update(material);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => () => material.dispose(), [material]);
  return material;
};

const aoInterior = (primitives: AoPrimitive[], selfGroup: number): AoSettings => ({
  primitives,
  selfGroup,
  radius: 1.5,
  strength: 0.62,
  direct: 0.55,
});

/** Debossed text: same leather as the surface it is pressed into, pressed smoother and darker. */
const EngravingDecal: React.FC<{ anchor: EngravingAnchor; maps: EngravingMaps; surface: ResolvedMaterial; roughnessFactor: number }> = ({
  anchor,
  maps,
  surface,
  roughnessFactor,
}) => {
  const invalidate = useThree((s) => s.invalidate);
  const textures = useMemo(() => {
    const color = new CanvasTexture(maps.color);
    color.colorSpace = SRGBColorSpace;
    color.anisotropy = 8;
    const normal = new CanvasTexture(maps.normal);
    normal.colorSpace = NoColorSpace;
    normal.anisotropy = 8;
    return { color, normal };
  }, [maps]);
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        map: textures.color,
        normalMap: textures.normal,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
        side: DoubleSide,
      }),
    [textures],
  );
  useLayoutEffect(() => {
    const p = surface.material.pbr;
    material.color.set(surface.hex);
    material.roughness = Math.min(1, p.roughness * roughnessFactor);
    material.clearcoat = p.clearcoat;
    material.clearcoatRoughness = p.clearcoatRoughness;
    // Pressing flattens suede nap / leather grain: less sheen than the surrounding surface.
    material.sheen = p.sheen * 0.6;
    material.sheenRoughness = p.sheenRoughness;
    material.sheenColor.set(surface.hex).lerp(new Color(1, 1, 1), 0.12);
    material.specularIntensity = p.specularIntensity;
    material.needsUpdate = true;
    invalidate();
  }, [material, surface, roughnessFactor, invalidate]);
  useEffect(
    () => () => {
      textures.color.dispose();
      textures.normal.dispose();
      material.dispose();
    },
    [textures, material],
  );
  // Orient the plane: local x → text direction, local z → surface normal.
  const matrix = useMemo(() => {
    const n = new Vector3(...anchor.normal).normalize();
    const t = new Vector3(...anchor.tangent).normalize();
    const b = new Vector3().crossVectors(n, t);
    const m = new Matrix4().makeBasis(t, b, n);
    const c = new Vector3(...anchor.center).addScaledVector(n, 0.003);
    m.setPosition(c);
    return m;
  }, [anchor]);
  return (
    <mesh matrix={matrix} matrixAutoUpdate={false} material={material} renderOrder={2}>
      <planeGeometry args={[anchor.widthCm, anchor.heightCm]} />
    </mesh>
  );
};

/** Placeholder frame colour in full-colour mode (before an upload). */
const PLACEHOLDER_HEX = "#8d9096";

/**
 * The printed logo: a thin decal on the middle of the outside of the lid.
 * Full colour prints the image as it is; one colour prints its shape in ink
 * (wit, zwart) or metallic foil (zilver, goud).
 */
const LogoDecal: React.FC<{ logo: LogoDescription; texture: HTMLCanvasElement }> = ({ logo, texture }) => {
  const invalidate = useThree((s) => s.invalidate);
  const map = useMemo(() => {
    const t = new CanvasTexture(texture);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [texture]);
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        map,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      }),
    [map],
  );
  const ink = logo.ink;
  const placeholder = logo.artwork === null;
  const hex = ink ? ink.hex : placeholder ? PLACEHOLDER_HEX : "#ffffff";
  const metallic = ink?.finish === "metallic";
  const roughness = ink ? ink.roughness : logo.printRoughness;
  useLayoutEffect(() => {
    material.color.set(hex);
    material.metalness = metallic ? 1 : 0;
    material.roughness = roughness;
    material.clearcoat = metallic ? 0.3 : 0.08;
    material.opacity = placeholder ? 0.85 : 1;
    material.needsUpdate = true;
    invalidate();
  }, [material, hex, metallic, roughness, placeholder, invalidate]);
  useEffect(
    () => () => {
      map.dispose();
      material.dispose();
    },
    [map, material],
  );
  // Orient the plane: local x → reading direction, local z → surface normal.
  const { anchor } = logo;
  const matrix = useMemo(() => {
    const n = new Vector3(...anchor.normal).normalize();
    const t = new Vector3(...anchor.tangent).normalize();
    const b = new Vector3().crossVectors(n, t);
    const m = new Matrix4().makeBasis(t, b, n);
    m.setPosition(new Vector3(...anchor.center).addScaledVector(n, 0.004));
    return m;
  }, [anchor]);
  return (
    <mesh matrix={matrix} matrixAutoUpdate={false} material={material} renderOrder={2}>
      <planeGeometry args={[logo.widthCm, logo.heightCm]} />
    </mesh>
  );
};

const WatchBoxModel: React.FC<{ description: SceneDescription; engravingMaps: EngravingMaps | null; logoTexture: HTMLCanvasElement | null }> = ({
  description,
  engravingMaps,
  logoTexture,
}) => {
  const { layout, construction, appearance } = description;
  const geometries = useMemo(() => buildBoxGeometries(layout, construction), [layout, construction]);
  useEffect(() => () => geometries.dispose(), [geometries]);
  const { ao } = geometries;

  const piece = (id: string) => appearance.pieces[id] ?? appearance.interior;

  // Leather & suede
  const exterior = useLeather(appearance.exterior, { primitives: ao.baseExterior, selfGroup: -1, radius: 1.2, strength: 0.4, direct: 0.3 });
  const lidExterior = useLeather(appearance.exterior, null);
  const rimBand = useLeather(appearance.exterior, aoInterior(ao.base, AO_GROUP.none));
  const lidRimBand = useLeather(appearance.exterior, aoInterior(ao.lid, AO_GROUP.none));
  const lining = useLeather(appearance.interior, aoInterior(ao.base, AO_GROUP.none));
  const dividers = useLeather(appearance.interior, aoInterior(ao.base, AO_GROUP.divider));
  const lidLining = useLeather(appearance.interior, aoInterior(ao.lid, AO_GROUP.none));
  const cushions = useLeather(piece("cushions"), aoInterior(ao.base, AO_GROUP.cushion));
  const pocket = useLeather(piece("pocket"), aoInterior(ao.lid, AO_GROUP.pocket));
  const flap = useLeather(piece("flap"), aoInterior(ao.lid, AO_GROUP.flap));
  const strap = useLeather(piece("strap"), aoInterior(ao.lid, AO_GROUP.strap));
  const snapCap = useLeather(piece("snap-cap"), null);
  const zipPull = useLeather(piece("zip-pull"), null);

  // Thread, tape, hardware
  const stitchExterior = useSimpleMaterial(() => createThreadMaterial(description.stitch.exterior), (m) => {
    m.color.set(description.stitch.exterior);
    m.sheenColor.set(description.stitch.exterior);
  }, [description.stitch.exterior]);
  const stitchPocket = useSimpleMaterial(() => createThreadMaterial(description.stitch.pocket), (m) => {
    m.color.set(description.stitch.pocket);
    m.sheenColor.set(description.stitch.pocket);
  }, [description.stitch.pocket]);
  const stitchFlap = useSimpleMaterial(() => createThreadMaterial(description.stitch.flap), (m) => {
    m.color.set(description.stitch.flap);
    m.sheenColor.set(description.stitch.flap);
  }, [description.stitch.flap]);
  const tape = useSimpleMaterial(() => createTapeMaterial(description.tapeHex), (m) => {
    m.color.set(description.tapeHex);
    m.sheenColor.set(description.tapeHex);
  }, [description.tapeHex]);
  const metal = useSimpleMaterial(() => createMetalMaterial(description.hardware.hex, description.hardware.roughness), (m) => {
    m.color.set(description.hardware.hex);
    m.roughness = description.hardware.roughness;
  }, [description.hardware.hex, description.hardware.roughness]);

  const g = geometries;
  const hinge = layout.lid.hinge;
  return (
    <group>
      {/* Base */}
      <group>
        <mesh geometry={g.base.shell} material={exterior} castShadow />
        <mesh geometry={g.base.band} material={rimBand} />
        <mesh geometry={g.base.lining} material={lining} />
        <mesh geometry={g.base.dividers} material={dividers} castShadow />
        <mesh geometry={g.base.cushions} material={cushions} castShadow />
        <mesh geometry={g.base.hinge} material={exterior} castShadow />
        <mesh geometry={g.base.tape} material={tape} />
        <Instanced geometry={g.shared.tooth} material={metal} matrices={g.base.teeth} />
        <mesh geometry={g.base.slider} material={metal} castShadow />
        <mesh geometry={g.base.pullLink} material={metal} castShadow />
        <mesh geometry={g.base.pullTab} material={zipPull} castShadow />
        <Instanced geometry={g.shared.stitch} material={stitchExterior} matrices={g.base.stitches} />
      </group>

      {/* Lid, rotated open around the hinge at the outer back edge */}
      <group position={[0, hinge.y, hinge.z]} rotation={[-description.lidAngle * DEG, 0, 0]}>
        <group position={[0, -hinge.y, -hinge.z]}>
          <mesh geometry={g.lid.shell} material={lidExterior} castShadow />
          <mesh geometry={g.lid.band} material={lidRimBand} />
          <mesh geometry={g.lid.lining} material={lidLining} />
          <mesh geometry={g.lid.pocket} material={pocket} />
          <mesh geometry={g.lid.flap} material={flap} />
          <mesh geometry={g.lid.strap} material={strap} castShadow />
          <mesh geometry={g.lid.snap} material={snapCap} castShadow />
          <mesh geometry={g.lid.tape} material={tape} />
          <Instanced geometry={g.shared.tooth} material={metal} matrices={g.lid.teeth} />
          <Instanced geometry={g.shared.stitch} material={stitchExterior} matrices={g.lid.stitches} />
          <Instanced geometry={g.shared.stitch} material={stitchPocket} matrices={g.lid.pocketStitches} />
          <Instanced geometry={g.shared.stitch} material={stitchFlap} matrices={g.lid.flapStitches} />
          {description.engraving && engravingMaps ? (
            <EngravingDecal
              anchor={description.engraving.anchor}
              maps={engravingMaps}
              surface={description.engraving.material}
              roughnessFactor={description.engraving.deboss.roughnessFactor}
            />
          ) : null}
          {description.logo && logoTexture ? <LogoDecal logo={description.logo} texture={logoTexture} /> : null}
        </group>
      </group>
    </group>
  );
};

/* ------------------------------------------------------------------ */

export const WatchBoxScene: React.FC<{ description: SceneDescription }> = ({ description }) => {
  const environment = useStudioEnvironment(description.environment);
  const engraving = useEngravingMaps(description.engraving);
  const logo = useLogoTexture(description.logo);
  const ready = environment.ready && engraving.ready && logo.ready;
  const error = environment.error ?? engraving.error ?? logo.error;
  return (
    <>
      <CameraRig camera={description.camera} />
      <KeyLight layout={description.layout} />
      <StudioFloor layout={description.layout} />
      <WatchBoxModel description={description} engravingMaps={engraving.value} logoTexture={logo.value} />
      <RenderGate ready={ready} error={error} />
    </>
  );
};
