import type { HddPackingResult, ReasonEntry } from "./types";

export type HddPackingInput = {
  requiredTb: number;
  availableCapacitiesTb: number[];
  driveBays: number | null | undefined;
  maxHddTb: number | null | undefined;
};

/**
 * Homogeneous HDD packing (all drives same capacity).
 *
 * Preference order:
 * 1. Satisfy required capacity
 * 2. Respect bay limit
 * 3. Respect max drive size (when known)
 * 4. Minimize excess capacity
 * 5. Prefer fewer drives when excess is equal
 * 6. Prefer smaller drive size when still tied
 *
 * V1: raw capacity (no RAID).
 * requiredTb must already include storage overhead.
 */
export function packHdds(input: HddPackingInput): HddPackingResult {
  const requiredTb = input.requiredTb;
  const reasons: ReasonEntry[] = [];
  const bayLimit = input.driveBays ?? null;
  const maxDriveTb = input.maxHddTb ?? null;

  const sizes = [
    ...new Set(
      (input.availableCapacitiesTb || [])
        .filter((n) => Number.isFinite(n) && n > 0)
        .map((n) => n),
    ),
  ].sort((a, b) => a - b);

  if (!sizes.length) {
    reasons.push({ code: "HDD_OPTIONS_EMPTY", params: { requiredTb } });
    return {
      status: "unresolved",
      requiredTb,
      driveCount: null,
      driveCapacityTb: null,
      totalCapacityTb: null,
      excessTb: null,
      baysUsed: null,
      bayLimit,
      maxDriveTb,
      reasons,
    };
  }

  if (bayLimit == null || !Number.isFinite(bayLimit) || bayLimit < 1) {
    reasons.push({ code: "HDD_BAYS_UNKNOWN", params: { requiredTb, bayLimit } });
    return {
      status: "unresolved",
      requiredTb,
      driveCount: null,
      driveCapacityTb: null,
      totalCapacityTb: null,
      excessTb: null,
      baysUsed: null,
      bayLimit,
      maxDriveTb,
      reasons,
    };
  }

  const maxBays = Math.floor(bayLimit);
  type Candidate = {
    driveCount: number;
    driveCapacityTb: number;
    totalCapacityTb: number;
    excessTb: number;
  };
  const candidates: Candidate[] = [];

  for (const size of sizes) {
    if (maxDriveTb != null && size > maxDriveTb) continue;
    for (let count = 1; count <= maxBays; count++) {
      const total = size * count;
      if (total + 1e-12 >= requiredTb) {
        candidates.push({
          driveCount: count,
          driveCapacityTb: size,
          totalCapacityTb: total,
          excessTb: total - requiredTb,
        });
      }
    }
  }

  if (!candidates.length) {
    reasons.push({
      code: "HDD_CAPACITY_IMPOSSIBLE",
      params: {
        requiredTb,
        bayLimit: maxBays,
        maxDriveTb,
        largestOption: sizes[sizes.length - 1] ?? null,
      },
    });
    return {
      status: "impossible",
      requiredTb,
      driveCount: null,
      driveCapacityTb: null,
      totalCapacityTb: null,
      excessTb: null,
      baysUsed: null,
      bayLimit: maxBays,
      maxDriveTb,
      reasons,
    };
  }

  candidates.sort((a, b) => {
    if (a.excessTb !== b.excessTb) return a.excessTb - b.excessTb;
    if (a.driveCount !== b.driveCount) return a.driveCount - b.driveCount;
    return a.driveCapacityTb - b.driveCapacityTb;
  });

  const best = candidates[0];
  reasons.push({
    code: "HDD_PACKED",
    params: {
      requiredTb,
      driveCount: best.driveCount,
      driveCapacityTb: best.driveCapacityTb,
      totalCapacityTb: best.totalCapacityTb,
      excessTb: best.excessTb,
    },
  });

  return {
    status: "ok",
    requiredTb,
    driveCount: best.driveCount,
    driveCapacityTb: best.driveCapacityTb,
    totalCapacityTb: best.totalCapacityTb,
    excessTb: best.excessTb,
    baysUsed: best.driveCount,
    bayLimit: maxBays,
    maxDriveTb,
    reasons,
  };
}

export function checkHddCompatibility(opts: {
  driveCount: number;
  driveCapacityTb: number;
  bayLimit: number | null | undefined;
  maxHddTb: number | null | undefined;
}): { ok: boolean | null; reasons: ReasonEntry[] } {
  const reasons: ReasonEntry[] = [];
  if (opts.bayLimit == null) {
    return { ok: null, reasons: [{ code: "HDD_BAYS_UNKNOWN", params: {} }] };
  }
  let ok = opts.driveCount <= opts.bayLimit;
  if (opts.maxHddTb != null && opts.driveCapacityTb > opts.maxHddTb) ok = false;
  return {
    ok,
    reasons: [
      {
        code: ok ? "HDD_PACKED" : "HDD_CAPACITY_IMPOSSIBLE",
        params: {
          driveCount: opts.driveCount,
          bayLimit: opts.bayLimit,
          driveCapacityTb: opts.driveCapacityTb,
          maxHddTb: opts.maxHddTb ?? null,
        },
      },
    ],
  };
}
