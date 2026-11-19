import { createContext, useContext } from "react";

export interface SceneEvent {
  level: "warning" | "error";
  /** Stable code, e.g. FONT_FALLBACK, HDRI_FALLBACK, WEBGL_UNAVAILABLE. */
  code: string;
  message: string;
}

export interface SceneStatusApi {
  report: (event: SceneEvent) => void;
  clear: (code: string) => void;
}

/**
 * Lets the live preview surface scene warnings (e.g. asset fallbacks) in the UI.
 * Not provided during a Remotion render — there, failures fail the render.
 */
export const SceneStatusContext = createContext<SceneStatusApi | null>(null);

export const useSceneStatus = () => useContext(SceneStatusContext);
