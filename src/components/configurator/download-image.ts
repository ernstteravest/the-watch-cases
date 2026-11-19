/**
 * Saves the current 3D view as a PNG, entirely in the browser (no server).
 * The WebGL canvas is transparent, so the studio backdrop is painted first,
 * the same radial gradient the preview shows behind it.
 */
export async function downloadPreviewImage(
  container: HTMLElement,
  background: { center: string; edge: string },
  fileName: string,
): Promise<void> {
  const source = container.querySelector("canvas");
  if (!source) throw new Error("No preview canvas found");

  const { width, height } = source;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");

  // "radial-gradient(ellipse closest-side at 50% 48%, center 0%, center 30%, edge 100%)"
  const cx = width / 2;
  const cy = height * 0.48;
  const rx = Math.min(cx, width - cx);
  const ry = Math.min(cy, height - cy);
  ctx.fillStyle = background.edge;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  gradient.addColorStop(0, background.center);
  gradient.addColorStop(0.3, background.center);
  gradient.addColorStop(1, background.edge);
  ctx.fillStyle = gradient;
  ctx.fillRect(-cx, -cy / (ry / rx), width, height / (ry / rx));
  ctx.restore();

  ctx.drawImage(source, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("PNG encoding failed");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
