/**
 * State of the Logo step: no logo, full colour or one colour; the one-colour
 * print colour; the uploaded logo in its versions (as uploaded / background
 * removed / background removed with inside areas kept) and the customer's
 * choice between them; upload progress and problems. `choice` is the logo part
 * of the configuration, in the canonical form validateLogo() returns, so the
 * preview props equal what the server renders.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { Catalog, Issue, LogoArtwork, LogoChoice, LogoMode } from "../catalog";
import { readLogoFile, type ReadLogo } from "./readLogoFile";

export interface LogoState {
  mode: LogoMode | "none";
  /** One-colour print colour; kept while switching modes. */
  color: string;
  upload: ReadLogo | null;
  /** Remove the plain background (when the upload has one). */
  removeBackground: boolean;
  /** Full colour: print the areas inside the logo that have the background colour. */
  keepInside: boolean;
  reading: boolean;
  issues: Issue[];
}

const NO_IMAGE_PASTED: Issue = {
  path: "logo.file",
  code: "logo_paste_no_image",
  message: "There's no image on the clipboard. Copy the logo image itself (not a link or file name), or choose the file.",
};

/** The version of the logo that is printed. One colour always leaves inside areas open (otherwise they'd disappear into the shape). */
export const printedArtwork = (state: Pick<LogoState, "mode" | "upload" | "removeBackground" | "keepInside">): LogoArtwork | null => {
  const { upload } = state;
  if (!upload) return null;
  if (!state.removeBackground || !upload.removed) return upload.original;
  if (state.mode === "full-color" && state.keepInside && upload.removedKeepInside) return upload.removedKeepInside;
  return upload.removed;
};

export const useLogo = (catalog: Catalog) => {
  const [state, setState] = useState<LogoState>(() => ({
    mode: "none",
    color: catalog.logo.defaultColor,
    upload: null,
    removeBackground: false,
    keepInside: false,
    reading: false,
    issues: [],
  }));
  // Results of an older upload (or one removed meanwhile) are ignored.
  const uploadId = useRef(0);

  const setMode = useCallback((mode: LogoState["mode"]) => setState((s) => ({ ...s, mode, issues: mode === "none" ? [] : s.issues })), []);
  const setColor = useCallback((color: string) => setState((s) => ({ ...s, color })), []);
  const setRemoveBackground = useCallback((removeBackground: boolean) => setState((s) => ({ ...s, removeBackground })), []);
  const setKeepInside = useCallback((keepInside: boolean) => setState((s) => ({ ...s, keepInside })), []);

  /** Uploading, pasting or dropping a logo also switches the logo on (full colour, unless one colour is chosen). */
  const upload = useCallback(
    async (file: File) => {
      const id = ++uploadId.current;
      setState((s) => ({ ...s, mode: s.mode === "none" ? "full-color" : s.mode, reading: true, issues: [] }));
      let result: Awaited<ReturnType<typeof readLogoFile>>;
      try {
        result = await readLogoFile(file, catalog.logo);
      } catch (e) {
        console.error("[logo]", e);
        result = { ok: false, issues: [{ path: "logo.file", code: "logo_read_failed", message: "The logo couldn't be uploaded. Try again." }] };
      }
      if (id !== uploadId.current) return;
      setState((s) =>
        result.ok
          ? { ...s, reading: false, issues: [], upload: result.value, removeBackground: result.value.removeByDefault, keepInside: false }
          : // A failed upload keeps the previous logo, as the preview does for invalid text.
            { ...s, reading: false, issues: result.issues },
      );
    },
    [catalog],
  );

  const pastedWithoutImage = useCallback(
    () => setState((s) => ({ ...s, mode: s.mode === "none" ? "full-color" : s.mode, issues: [NO_IMAGE_PASTED] })),
    [],
  );

  const remove = useCallback(() => {
    uploadId.current++;
    setState((s) => ({ ...s, upload: null, reading: false, issues: [] }));
  }, []);

  const artwork = printedArtwork(state);
  const choice = useMemo<LogoChoice | undefined>(() => {
    if (state.mode === "none") return undefined;
    return state.mode === "one-color" ? { mode: state.mode, color: state.color, artwork } : { mode: state.mode, artwork };
  }, [state.mode, state.color, artwork]);

  /** A final render needs the logo uploaded (or no logo). */
  const complete = state.mode === "none" || (state.upload !== null && !state.reading);

  return { state, artwork, choice, complete, setMode, setColor, setRemoveBackground, setKeepInside, upload, pastedWithoutImage, remove };
};
