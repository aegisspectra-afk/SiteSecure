import type { InfrastructureResult, ReasonEntry, ServiceRequirement } from "./types";

/**
 * Cable meters only when explicit distance is supplied.
 * Never invent meters from camera count.
 */
export function evaluateInfrastructure(cableDistanceMeters: number | null | undefined): InfrastructureResult {
  const reasons: ReasonEntry[] = [];
  if (cableDistanceMeters != null && Number.isFinite(cableDistanceMeters) && cableDistanceMeters > 0) {
    return {
      cableMeters: cableDistanceMeters,
      cableStatus: "ok",
      reasons,
    };
  }
  reasons.push({ code: "CABLE_DISTANCE_UNRESOLVED", params: {} });
  return {
    cableMeters: null,
    cableStatus: "unresolved",
    reasons,
  };
}

export function buildServiceRequirements(opts: {
  cameraCount: number;
  installationRequested?: boolean | null;
  remoteViewing?: boolean | null;
  testingRequested?: boolean | null;
  commissioningRequested?: boolean | null;
  upsRequested?: boolean | null;
}): ServiceRequirement[] {
  const out: ServiceRequirement[] = [];
  const install = opts.installationRequested !== false; // default on for typical CCTV build
  if (install) {
    out.push({ role: "camera_install", qty: opts.cameraCount });
    out.push({ role: "recorder_setup", qty: 1 });
  }
  if (opts.remoteViewing) out.push({ role: "remote_viewing_setup", qty: 1 });
  if (opts.testingRequested !== false && install) out.push({ role: "testing", qty: 1 });
  if (opts.commissioningRequested) out.push({ role: "commissioning", qty: 1 });
  if (opts.upsRequested) out.push({ role: "ups", qty: 1 });
  return out;
}
