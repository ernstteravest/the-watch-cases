/** Finding a logo file in a paste or a drop. */

const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg" };

/**
 * The image in a paste (only images) or the file in a drop (any file, so an
 * unsupported one gets a clear message). Pasted images usually arrive as
 * "image.png"; they are named "pasted-logo.png" instead.
 */
export const fileFromTransfer = (data: DataTransfer | null, source: "paste" | "drop"): File | null => {
  const files = Array.from(data?.files ?? []);
  const file = files.find((f) => f.type.startsWith("image/")) ?? (source === "drop" ? files[0] : undefined);
  if (!file) return null;
  if (source === "paste" && (!file.name || /^image\.\w+$/i.test(file.name))) {
    return new File([file], `pasted-logo.${EXTENSIONS[file.type] ?? "png"}`, { type: file.type });
  }
  return file;
};

/** True if the paste is meant for a text field (not for the logo). */
export const isTextFieldTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest("input:not([type=file]), textarea, select, [contenteditable]:not([contenteditable=false])") !== null;
