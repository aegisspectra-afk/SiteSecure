/** Print cards use server-issued checkpoint codes only — never mint client ids. */

export const SERVER_CHECKPOINT_CODE = /^cp_[a-f0-9]{24}$/;

export type PrintableCheckpoint = {
  id: string;
  name: string;
  code: string;
  location_label?: string | null;
  code_format: string;
};

export function isServerCheckpointCode(code: string): boolean {
  return SERVER_CHECKPOINT_CODE.test(code.trim().toLowerCase());
}

/** Drop rows without a valid server code so print never invents identifiers. */
export function printableCheckpoints(items: PrintableCheckpoint[]): PrintableCheckpoint[] {
  return items.filter((item) => item.id && isServerCheckpointCode(item.code));
}

export function wantsBarcode(format: string): boolean {
  return format === "barcode" || format === "both";
}

/**
 * Visual barcode bars are omitted unless a real encoder is used.
 * C3 prints QR (uqr) of the server code; Code128 bars are not drawn from a fake pattern.
 */
export function mayRenderBarcodeBars(): boolean {
  return false;
}
