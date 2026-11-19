/**
 * Composition definition shared by Remotion (Root.tsx → Studio/renders) and by
 * the configurator's <Player>. Importing the same object in both places is
 * what guarantees the live preview and the final image use the same scene.
 */
import { catalogResult, defaultRenderProps, renderPropsSchema, type RenderProps } from "../catalog";
import { WATCH_BOX_COMPOSITION_ID } from "./constants";
import { WatchBoxStill } from "./WatchBoxStill";

const output = catalogResult.ok ? catalogResult.value.presentation.output : { width: 1600, height: 1000, renderScale: 2 };

export const watchBoxComposition = {
  id: WATCH_BOX_COMPOSITION_ID,
  component: WatchBoxStill,
  width: output.width,
  height: output.height,
  renderScale: output.renderScale,
  schema: renderPropsSchema,
  defaultProps: (catalogResult.ok
    ? defaultRenderProps(catalogResult.value)
    : {
        configuration: { product: "", exterior: "", interior: "", pieces: {}, personalization: { text: "", placement: "lid" } },
        view: { preset: "open", azimuth: 0, elevation: 30, lidAngle: 0 },
      }) satisfies RenderProps,
} as const;
