/** Shared helpers for native PDF.js Template Studio preview (not browser embed). */

export const PDF_ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5] as const;

export const PDF_ZOOM_MIN = PDF_ZOOM_STEPS[0];
export const PDF_ZOOM_MAX = PDF_ZOOM_STEPS[PDF_ZOOM_STEPS.length - 1];

/** Stage horizontal padding (matches `.pdf-preview-stage` CSS). */
export const PDF_PREVIEW_STAGE_PAD_X = 24;

export function clampPdfZoom(scale: number): number {
  if (!Number.isFinite(scale)) return 0.75;
  return Math.min(PDF_ZOOM_MAX, Math.max(PDF_ZOOM_MIN, scale));
}

export function stepPdfZoom(current: number, direction: -1 | 1): number {
  const scale = clampPdfZoom(current);
  if (direction < 0) {
    const prev = [...PDF_ZOOM_STEPS].reverse().find((s) => s < scale - 0.001);
    return prev ?? PDF_ZOOM_MIN;
  }
  const next = PDF_ZOOM_STEPS.find((s) => s > scale + 0.001);
  return next ?? PDF_ZOOM_MAX;
}

/** Fit PDF page width into available stage width (CSS pixels).
 * Allows below the manual zoom floor so phones can truly fit A4. */
export function computeFitScale(pageWidthAtScale1: number, containerWidth: number, padX = PDF_PREVIEW_STAGE_PAD_X): number {
  if (!(pageWidthAtScale1 > 0) || !(containerWidth > 0)) return 0.75;
  const available = Math.max(64, containerWidth - padX);
  const raw = available / pageWidthAtScale1;
  return Math.min(PDF_ZOOM_MAX, Math.max(0.35, raw));
}

export function formatZoomPercent(scale: number): string {
  const pct = Math.round(Math.min(PDF_ZOOM_MAX, Math.max(0.35, scale)) * 100);
  return `${pct}%`;
}
