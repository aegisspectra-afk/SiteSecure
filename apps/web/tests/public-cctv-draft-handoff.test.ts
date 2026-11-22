import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  PUBLIC_CCTV_DRAFT_KEY,
  consumePublicCctvDraft,
  mapPublicStorageToCctvRequirements,
} from "../src/lib/public-cctv-draft";

describe("public CCTV draft → wizard handoff", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  afterEach(() => {
    sessionStorage.clear();
  });

  it("maps calculator input into CCTV requirements", () => {
    const mapped = mapPublicStorageToCctvRequirements({
      camera_count: 12,
      resolution_mp: 4,
      retention_days: 14,
      recording_mode: "motion",
      codec: "h265",
    });
    expect(mapped.cameraCount).toBe(12);
    expect(mapped.retentionDays).toBe(14);
    expect(mapped.recordingMode).toBe("motion");
  });

  it("consumes draft once from sessionStorage", () => {
    sessionStorage.setItem(
      PUBLIC_CCTV_DRAFT_KEY,
      JSON.stringify({
        camera_count: 6,
        resolution_mp: 2,
        retention_days: 30,
        recording_mode: "continuous",
        codec: "h264",
      }),
    );
    const first = consumePublicCctvDraft();
    expect(first?.cameraCount).toBe(6);
    expect(sessionStorage.getItem(PUBLIC_CCTV_DRAFT_KEY)).toBeNull();
    expect(consumePublicCctvDraft()).toBeNull();
  });
});
