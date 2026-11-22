/**
 * B4 — per-location camera rows in professional CCTV mode.
 * Aggregates sync into existing recommend fields (camera_count, indoor/outdoor, form_factor).
 */

import type { CctvBuildRequirements } from "./cctv-build-requirements";

export type CctvCameraPlacement = {
  id: string;
  label: string;
  count: number;
  environment: "indoor" | "outdoor" | "";
  formFactor: "" | "dome" | "bullet" | "turret" | "ptz";
  /** Optional tour photo URL/path — reserved for B6 wiring; not required. */
  photoRef?: string | null;
};

export function newCameraPlacement(partial?: Partial<CctvCameraPlacement>): CctvCameraPlacement {
  return {
    id: partial?.id ?? `loc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: partial?.label ?? "",
    count: partial?.count != null && partial.count > 0 ? Math.floor(partial.count) : 1,
    environment: partial?.environment ?? "",
    formFactor: partial?.formFactor ?? "",
    photoRef: partial?.photoRef ?? null,
  };
}

export function normalizeCameraPlacements(raw: unknown): CctvCameraPlacement[] {
  if (!Array.isArray(raw)) return [];
  const out: CctvCameraPlacement[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const count = Math.max(0, Math.floor(Number(r.count) || 0));
    if (count < 1) continue;
    const env = r.environment === "indoor" || r.environment === "outdoor" ? r.environment : "";
    const ff =
      r.formFactor === "dome" ||
      r.formFactor === "bullet" ||
      r.formFactor === "turret" ||
      r.formFactor === "ptz"
        ? r.formFactor
        : "";
    out.push({
      id: String(r.id || `loc-${out.length + 1}`),
      label: String(r.label ?? "").trim(),
      count,
      environment: env,
      formFactor: ff,
      photoRef: typeof r.photoRef === "string" ? r.photoRef : null,
    });
  }
  return out;
}

export type PlacementAggregates = {
  cameraCount: number;
  indoorCount: number;
  outdoorCount: number;
  environment: CctvBuildRequirements["environment"];
  formFactor: CctvBuildRequirements["formFactor"];
};

/** Derive recommend-facing aggregates from placement rows. Empty list → null (use form totals). */
export function derivePlacementAggregates(
  placements: CctvCameraPlacement[],
): PlacementAggregates | null {
  if (!placements.length) return null;
  let cameraCount = 0;
  let indoorCount = 0;
  let outdoorCount = 0;
  let unspecified = 0;
  const formVotes = new Map<Exclude<CctvCameraPlacement["formFactor"], "">, number>();

  for (const row of placements) {
    const n = Math.max(0, Math.floor(row.count));
    if (n < 1) continue;
    cameraCount += n;
    if (row.environment === "indoor") indoorCount += n;
    else if (row.environment === "outdoor") outdoorCount += n;
    else unspecified += n;
    if (row.formFactor) {
      formVotes.set(row.formFactor, (formVotes.get(row.formFactor) ?? 0) + n);
    }
  }
  if (cameraCount < 1) return null;

  let environment: CctvBuildRequirements["environment"] = "";
  if (indoorCount > 0 && outdoorCount > 0) environment = "indoor_outdoor";
  else if (outdoorCount > 0 && indoorCount === 0 && unspecified === 0) environment = "outdoor";
  else if (indoorCount > 0 && outdoorCount === 0 && unspecified === 0) environment = "indoor";
  else if (outdoorCount > 0 && indoorCount === 0) environment = "outdoor";
  else if (indoorCount > 0 && outdoorCount === 0) environment = "indoor";

  let formFactor: CctvBuildRequirements["formFactor"] = "";
  if (formVotes.size === 1) {
    formFactor = [...formVotes.keys()][0] ?? "";
  } else if (formVotes.size > 1) {
    formFactor = ""; // mixed — engine treats as unspecified
  }

  return { cameraCount, indoorCount, outdoorCount, environment, formFactor };
}

/** When placements exist, overwrite count/environment/formFactor on the requirements form. */
export function applyPlacementAggregates(req: CctvBuildRequirements): CctvBuildRequirements {
  const placements = normalizeCameraPlacements(req.cameraPlacements);
  const agg = derivePlacementAggregates(placements);
  if (!agg) {
    return { ...req, cameraPlacements: placements };
  }
  const next: CctvBuildRequirements = {
    ...req,
    cameraPlacements: placements,
    cameraCount: agg.cameraCount,
    environment: agg.environment || req.environment,
    formFactor: agg.formFactor,
  };
  if (req.cctvTechnology === "hybrid") {
    // Keep existing IP/analog split proportions when possible.
    const ip = Math.max(0, Math.floor(req.ipCameraCount));
    const an = Math.max(0, Math.floor(req.analogCameraCount));
    const prev = ip + an;
    if (prev > 0) {
      const ipShare = ip / prev;
      next.ipCameraCount = Math.max(0, Math.round(agg.cameraCount * ipShare));
      next.analogCameraCount = Math.max(0, agg.cameraCount - next.ipCameraCount);
      if (next.ipCameraCount < 1 && next.analogCameraCount >= 1) {
        next.ipCameraCount = 1;
        next.analogCameraCount = Math.max(0, agg.cameraCount - 1);
      }
      if (next.analogCameraCount < 1 && next.ipCameraCount >= 1) {
        next.analogCameraCount = 1;
        next.ipCameraCount = Math.max(0, agg.cameraCount - 1);
      }
    } else {
      next.ipCameraCount = Math.max(1, Math.ceil(agg.cameraCount / 2));
      next.analogCameraCount = Math.max(0, agg.cameraCount - next.ipCameraCount);
    }
  } else if (req.cctvTechnology === "analog_hd") {
    next.analogCameraCount = agg.cameraCount;
    next.ipCameraCount = 0;
  } else {
    next.ipCameraCount = agg.cameraCount;
    next.analogCameraCount = 0;
  }
  return next;
}

export function updatePlacement(
  req: CctvBuildRequirements,
  id: string,
  patch: Partial<CctvCameraPlacement>,
): CctvBuildRequirements {
  const placements = normalizeCameraPlacements(req.cameraPlacements).map((row) =>
    row.id === id ? { ...row, ...patch, id: row.id } : row,
  );
  return applyPlacementAggregates({ ...req, cameraPlacements: placements });
}

export function addPlacement(req: CctvBuildRequirements, partial?: Partial<CctvCameraPlacement>): CctvBuildRequirements {
  const placements = [...normalizeCameraPlacements(req.cameraPlacements), newCameraPlacement(partial)];
  return applyPlacementAggregates({ ...req, cameraPlacements: placements });
}

export function removePlacement(req: CctvBuildRequirements, id: string): CctvBuildRequirements {
  const placements = normalizeCameraPlacements(req.cameraPlacements).filter((row) => row.id !== id);
  return applyPlacementAggregates({ ...req, cameraPlacements: placements });
}
