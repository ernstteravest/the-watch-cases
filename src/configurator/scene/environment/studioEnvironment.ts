/**
 * Studio lighting environment.
 *
 * By default an HDR studio is generated in code: a soft gradient dome plus
 * emissive softboxes (key, two rim strips, front fill) rendered into a
 * half-float cube map and prefiltered with PMREM. This is effectively a studio
 * HDRI that never fails to load and is identical for the live preview and the
 * final render. An equirectangular .hdr can be configured instead
 * (presentation.environment.hdriPath).
 */
import {
  BackSide,
  Color,
  DoubleSide,
  EquirectangularReflectionMapping,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  type DataTexture,
  type Texture,
  type WebGLRenderer,
} from "three";

interface Softbox {
  position: [number, number, number];
  size: [number, number];
  intensity: number;
  color?: string;
}

/** Positions in cm around the product (product centre ≈ origin). */
export const STUDIO_SOFTBOXES: Softbox[] = [
  // Large overhead key, slightly forward: soft top highlight on leather.
  { position: [4, 60, 18], size: [70, 46], intensity: 4.2 },
  // Front-right key at 45°: gives the long soft reflection on the front face.
  { position: [42, 28, 46], size: [30, 40], intensity: 3.2 },
  // Rim strips left and right behind the product: define the silhouette.
  { position: [-62, 22, -26], size: [10, 60], intensity: 3.4 },
  { position: [62, 22, -26], size: [10, 60], intensity: 2.6 },
  // Low front fill so interiors don't go muddy.
  { position: [-20, 10, 70], size: [80, 18], intensity: 1.1, color: "#fff8f0" },
];

const DOME_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const DOME_FRAGMENT = /* glsl */ `
varying vec3 vDir;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uFloor;
void main() {
  float y = vDir.y;
  vec3 c = y > 0.0 ? mix(uHorizon, uTop, pow(y, 0.6)) : mix(uHorizon, uFloor, pow(-y, 0.5));
  gl_FragColor = vec4(c, 1.0);
}`;

export const buildStudioScene = (): Scene => {
  const scene = new Scene();
  const dome = new Mesh(
    new SphereGeometry(400, 48, 24),
    new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      vertexShader: DOME_VERTEX,
      fragmentShader: DOME_FRAGMENT,
      uniforms: {
        uTop: { value: new Color(0.95, 0.95, 0.96) },
        uHorizon: { value: new Color(0.78, 0.78, 0.79) },
        uFloor: { value: new Color(0.42, 0.41, 0.4) },
      },
    }),
  );
  scene.add(dome);

  for (const box of STUDIO_SOFTBOXES) {
    const color = new Color(box.color ?? "#ffffff").multiplyScalar(box.intensity);
    const panel = new Mesh(new PlaneGeometry(box.size[0], box.size[1]), new MeshBasicMaterial({ color, side: DoubleSide, toneMapped: false }));
    panel.position.set(...box.position);
    panel.lookAt(0, 4, 0);
    scene.add(panel);
  }
  return scene;
};

const disposeScene = (scene: Scene) => {
  scene.traverse((obj) => {
    if (obj instanceof Mesh) {
      obj.geometry.dispose();
      (obj.material as MeshBasicMaterial).dispose();
    }
  });
};

/** Renders the procedural studio into a prefiltered environment map. */
export const createStudioEnvironment = (renderer: WebGLRenderer): Texture => {
  const pmrem = new PMREMGenerator(renderer);
  const scene = buildStudioScene();
  const target = pmrem.fromScene(scene, 0.025, 1, 1000);
  disposeScene(scene);
  pmrem.dispose();
  return target.texture;
};

/** Prefilters a loaded equirectangular HDR. */
export const createHdriEnvironment = (renderer: WebGLRenderer, hdr: DataTexture): Texture => {
  hdr.mapping = EquirectangularReflectionMapping;
  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(hdr);
  pmrem.dispose();
  return target.texture;
};
