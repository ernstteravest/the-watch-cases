/**
 * The still composition. This one component is:
 *   • played by @remotion/player as the configurator's live preview, and
 *   • screenshotted by renderStill() for the final PNG.
 * Same scene, materials, lighting and camera code for both — only the pixel
 * density differs (preview at 1×, final render at presentation.output.renderScale).
 */
import { ThreeCanvas } from "@remotion/three";
import { useMemo } from "react";
import { AbsoluteFill, useRemotionEnvironment, useVideoConfig } from "remotion";
import { NeutralToneMapping, PCFShadowMap } from "three";
import { getCatalog, InvalidConfigurationError, validateRenderProps, type RenderProps } from "../catalog";
import { describeScene } from "../scene/describeScene";
import { WatchBoxScene } from "../scene/WatchBoxScene";

const SHADOWS = { enabled: true, type: PCFShadowMap } as const;

export const WatchBoxStill: React.FC<RenderProps> = (props) => {
  const catalog = getCatalog(); // throws CatalogValidationError for a broken config/options.ts
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();

  const propsKey = JSON.stringify(props);
  const description = useMemo(() => {
    const valid = validateRenderProps(catalog, props);
    if (!valid.ok) throw new InvalidConfigurationError(valid.issues);
    return describeScene(catalog, valid.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, propsKey]);

  const { center, edge } = description.background;
  const gl = useMemo(
    () => ({
      antialias: true,
      alpha: true,
      // Keeps the last frame readable so the website can save it as a PNG in the browser.
      preserveDrawingBuffer: true,
      toneMapping: NeutralToneMapping,
      toneMappingExposure: description.environment.exposure,
    }),
    [description.environment.exposure],
  );

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse closest-side at 50% 48%, ${center} 0%, ${center} 30%, ${edge} 100%)` }}>
      <ThreeCanvas
        width={width}
        height={height}
        // Final render: full device scale (e.g. 2×). Preview: 1× of the composition size.
        dpr={isRendering ? window.devicePixelRatio : 1}
        shadows={SHADOWS}
        gl={gl}
        frameloop="demand"
      >
        <WatchBoxScene description={description} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
