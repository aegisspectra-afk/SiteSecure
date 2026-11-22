/** D3: hand off public CCTV storage calculator input into the quote wizard after signup. */

import type { PublicStorageInput } from "./public-marketing-api";
import { defaultCctvBuildRequirements, type CctvBuildRequirements } from "./cctv-build-requirements";

export const PUBLIC_CCTV_DRAFT_KEY = "ss.public-cctv-sizing-draft";

export type PublicCctvDraft = PublicStorageInput;

export function mapPublicStorageToCctvRequirements(input: PublicStorageInput): CctvBuildRequirements {
  const cameras = Math.max(1, Math.floor(Number(input.camera_count) || 1));
  const retention = Math.max(1, Math.floor(Number(input.retention_days) || 14));
  const recordingMode =
    input.recording_mode === "motion" ? ("motion" as const) : ("continuous" as const);
  const codec = input.codec === "h264" || input.codec === "h265" ? input.codec : ("" as const);
  const resolutionMp = Number(input.resolution_mp) > 0 ? Number(input.resolution_mp) : 4;
  const base = defaultCctvBuildRequirements({ cameraCount: cameras });
  return {
    ...base,
    cameraCount: cameras,
    ipCameraCount: cameras,
    retentionDays: retention,
    recordingMode,
    resolutionMp,
    codec,
  };
}

export function peekPublicCctvDraft(): PublicCctvDraft | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PUBLIC_CCTV_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PublicCctvDraft;
  } catch {
    return null;
  }
}

/** Read draft once and clear — used when opening the CCTV wizard after registration. */
export function consumePublicCctvDraft(): CctvBuildRequirements | null {
  const draft = peekPublicCctvDraft();
  if (!draft) return null;
  try {
    sessionStorage.removeItem(PUBLIC_CCTV_DRAFT_KEY);
  } catch {
    /* ignore */
  }
  return mapPublicStorageToCctvRequirements(draft);
}

export function savePublicCctvDraft(input: PublicStorageInput): void {
  try {
    sessionStorage.setItem(PUBLIC_CCTV_DRAFT_KEY, JSON.stringify(input));
  } catch {
    /* ignore */
  }
}
