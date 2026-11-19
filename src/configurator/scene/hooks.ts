import { useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRemotionEnvironment } from "remotion";
import type { Texture } from "three";
import type { ResolvedMaterial } from "../catalog/configuration";
import { assetFailurePolicy, engravingFontStack, loadEngravingFont, loadHdri } from "./assets";
import type { EngravingDescription, SceneDescription } from "./describeScene";
import { drawEngravingMaps, type EngravingMaps } from "./engraving/engravingMaps";
import { createHdriEnvironment, createStudioEnvironment } from "./environment/studioEnvironment";
import { createLeatherMaterial, type AoSettings } from "./materials/leatherMaterial";
import { useSceneStatus } from "./SceneStatus";

export interface AssetState<T = undefined> {
  ready: boolean;
  error: Error | null;
  value: T | null;
}

/** A leather/suede material that updates its colour in place and is disposed on unmount. */
export const useLeather = (resolved: ResolvedMaterial, ao: AoSettings | null) => {
  const invalidate = useThree((s) => s.invalidate);
  const materialId = resolved.material.id;
  // Recreated only when the leather type changes; colour/AO update in place.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handle = useMemo(() => createLeatherMaterial(resolved, ao), [materialId]);
  const aoKey = JSON.stringify(ao);
  useLayoutEffect(() => {
    handle.setColor(resolved.hex);
    invalidate();
  }, [handle, resolved.hex, invalidate]);
  useLayoutEffect(() => {
    handle.setAo(ao);
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, aoKey, invalidate]);
  useEffect(() => () => handle.material.dispose(), [handle]);
  return handle.material;
};

/** Generates (or loads) the studio environment and assigns it to the scene. */
export const useStudioEnvironment = (env: SceneDescription["environment"]): AssetState => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const { isRendering } = useRemotionEnvironment();
  const status = useSceneStatus();
  const [state, setState] = useState<AssetState>({ ready: false, error: null, value: null });

  useLayoutEffect(() => {
    let cancelled = false;
    let texture: Texture | null = null;
    const apply = (t: Texture) => {
      texture = t;
      scene.environment = t;
      scene.environmentIntensity = env.intensity;
      invalidate();
    };
    const procedural = () => {
      try {
        apply(createStudioEnvironment(gl));
        setState({ ready: true, error: null, value: null });
      } catch (e) {
        setState({ ready: false, error: e instanceof Error ? e : new Error(String(e)), value: null });
      }
    };
    if (!env.hdriPath) {
      procedural();
    } else {
      setState({ ready: false, error: null, value: null });
      loadHdri(env.hdriPath)
        .then((hdr) => {
          if (cancelled) return;
          apply(createHdriEnvironment(gl, hdr));
          hdr.dispose();
          status?.clear("HDRI_FALLBACK");
          setState({ ready: true, error: null, value: null });
        })
        .catch((err: Error) => {
          if (cancelled) return;
          if (assetFailurePolicy(isRendering) === "fail") {
            setState({ ready: false, error: err, value: null });
          } else {
            status?.report({
              level: "warning",
              code: "HDRI_FALLBACK",
              message: `Studio lighting file could not be loaded (${env.hdriPath}); showing the built-in studio. The final render will not proceed until the file is available.`,
            });
            procedural();
          }
        });
    }
    return () => {
      cancelled = true;
      if (texture && scene.environment === texture) scene.environment = null;
      texture?.dispose();
    };
  }, [gl, scene, env.hdriPath, env.intensity, isRendering, status, invalidate]);

  return state;
};

const engravingKey = (e: EngravingDescription | null) =>
  e ? JSON.stringify([e.text, e.anchor.widthCm, e.anchor.heightCm, e.font, e.deboss]) : "none";

/** Loads the engraving font and rasterises the deboss maps. */
export const useEngravingMaps = (engraving: EngravingDescription | null): AssetState<EngravingMaps> => {
  const { isRendering } = useRemotionEnvironment();
  const status = useSceneStatus();
  const key = engravingKey(engraving);
  const [state, setState] = useState<AssetState<EngravingMaps>>({ ready: engraving === null, error: null, value: null });

  useEffect(() => {
    if (!engraving) {
      setState({ ready: true, error: null, value: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, ready: false }));
    loadEngravingFont(engraving.font)
      .then(() => {
        status?.clear("FONT_FALLBACK");
        return false;
      })
      .catch((err: Error) => {
        if (assetFailurePolicy(isRendering) === "fail") throw err;
        status?.report({
          level: "warning",
          code: "FONT_FALLBACK",
          message: "The engraving font could not be loaded; the preview uses a fallback typeface. The final render requires the engraving font.",
        });
        return true;
      })
      .then((useFallback) => {
        if (cancelled) return;
        const maps = drawEngravingMaps({
          text: engraving.text,
          widthCm: engraving.anchor.widthCm,
          heightCm: engraving.anchor.heightCm,
          fontFamily: engravingFontStack(engraving.font, useFallback),
          weight: engraving.font.weight,
          letterSpacingEm: engraving.font.letterSpacingEm,
          maxCapHeightCm: engraving.deboss.maxCapHeightCm,
          depth: engraving.deboss.depth,
          darkening: engraving.deboss.darkening,
          edgeSoftnessCm: engraving.deboss.edgeSoftnessCm,
        });
        setState({ ready: true, error: null, value: maps });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ ready: false, error: err, value: null });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, isRendering, status]);

  return state;
};
