import { RECORDER_TIERS, type ReasonEntry, type RecorderSizingResult, type RecorderTier } from "./types";

/**
 * Apply expansion headroom then ceil before tier selection.
 * effective = ceil(requested * (1 + headroom))
 */
export function effectiveCameraCount(requested: number, headroom = 0): number {
  if (headroom <= 0) return requested;
  return Math.ceil(requested * (1 + headroom));
}

/**
 * Map effective camera count to a supported recorder tier.
 */
export function sizeRecorder(requestedCameras: number, expansionHeadroom = 0): RecorderSizingResult {
  const headroom = expansionHeadroom > 0 ? expansionHeadroom : 0;
  const effective = effectiveCameraCount(requestedCameras, headroom);
  const reasons: ReasonEntry[] = [];

  if (headroom > 0 && effective !== requestedCameras) {
    reasons.push({
      code: "RECORDER_HEADROOM_APPLIED",
      params: {
        requested: requestedCameras,
        headroom,
        effective,
      },
    });
  }

  if (effective > 64) {
    reasons.push({
      code: "RECORDER_UNSUPPORTED_COUNT",
      params: { effective, maxSupported: 64 },
    });
    return {
      status: "unsupported",
      requestedCameras,
      effectiveCameras: effective,
      selectedChannelTier: null,
      headroomApplied: headroom,
      reasons,
    };
  }

  let tier: RecorderTier = 4;
  for (const candidate of RECORDER_TIERS) {
    if (effective <= candidate) {
      tier = candidate;
      break;
    }
  }

  reasons.push({
    code: "RECORDER_TIER_SELECTED",
    params: {
      requested: requestedCameras,
      effective,
      tier,
    },
  });

  return {
    status: "ok",
    requestedCameras,
    effectiveCameras: effective,
    selectedChannelTier: tier,
    headroomApplied: headroom,
    reasons,
  };
}

export function checkChannelsCompatibility(
  cameraCount: number,
  recorderChannels: number | null | undefined,
): { ok: boolean | null; reasons: ReasonEntry[] } {
  if (recorderChannels == null || !Number.isFinite(recorderChannels)) {
    return {
      ok: null,
      reasons: [{ code: "COMPAT_CHANNELS_FAIL", params: { reason: "channels_unknown" } }],
    };
  }
  const ok = cameraCount <= recorderChannels;
  return {
    ok,
    reasons: [
      {
        code: ok ? "COMPAT_CHANNELS_OK" : "COMPAT_CHANNELS_FAIL",
        params: { cameras: cameraCount, channels: recorderChannels },
      },
    ],
  };
}
