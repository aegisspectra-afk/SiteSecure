import type { SystemRecommendation } from "@site-secure/api-client";
import { describe, expect, it } from "vitest";
import { buildEngineeringSummary, formatReasonHe, formatUnresolvedRequirementHe } from "../src/lib/cctv-recommend-copy";
import { buildCalculatedMetrics } from "../src/lib/cctv-designer-summary";
import { defaultCctvBuildRequirements } from "../src/lib/cctv-build-requirements";
import {
  COMMERCIAL_DISK_SIZES_TB,
  commercialDisk,
  commercialDiskLabel,
  formatTb,
  storageBitrateAssumptionHe,
} from "../src/lib/cctv-storage-display";

function rec(storage: Record<string, unknown>, extra: Record<string, unknown> = {}): SystemRecommendation {
  return {
    system_type: "cctv",
    engine_version: 1,
    status: "OK",
    blocking: false,
    input: { cameraCount: 4, cctvTechnology: "ip", retentionDays: 14 },
    engineering: { storage, ...extra },
    components: [],
    unresolved: [],
  } as unknown as SystemRecommendation;
}

describe("Q2.4 disk rounds up to the next commercial size", () => {
  it("uses 1/2/4/6/8/10/12 TB", () => {
    expect(COMMERCIAL_DISK_SIZES_TB).toEqual([1, 2, 4, 6, 8, 10, 12]);
    expect(commercialDiskLabel(0.4)).toBe("1TB");
    expect(commercialDiskLabel(1)).toBe("1TB");
    expect(commercialDiskLabel(2.1)).toBe("4TB");
    expect(commercialDiskLabel(3.6288)).toBe("4TB");
    expect(commercialDiskLabel(4.2)).toBe("6TB");
    expect(commercialDiskLabel(11.9)).toBe("12TB");
  });

  it("above 12 TB uses several 12 TB disks", () => {
    expect(commercialDisk(13)).toEqual({ driveCount: 2, driveTb: 12 });
    expect(commercialDiskLabel(30)).toBe("3 × 12TB");
    expect(commercialDiskLabel(0)).toBeNull();
  });
});

describe("Q2.4 every TB display has one decimal", () => {
  it("formats", () => {
    expect(formatTb(3.6288)).toBe("3.6");
    expect(formatTb(4)).toBe("4");
    expect(formatTb(3.96)).toBe("4");
  });

  it("the catalog-gap reason no longer prints 3.6288", () => {
    const text = formatReasonHe({ code: "HDD_OPTIONS_EMPTY", params: { requiredTb: 3.6288 } });
    expect(text).toContain("≈3.6TB");
    expect(text).toContain("מוצע 4TB");
    expect(text).not.toContain("3.6288");
  });

  it("the unresolved storage line names the commercial disk", () => {
    const line = formatUnresolvedRequirementHe({
      role: "storage",
      technical_requirements: { requiredTb: 3.6288 },
    } as never);
    expect(line).toBe("כונן 4TB (נדרש ≈3.6TB)");
  });
});

describe("Q2.4 the storage assumption is shown", () => {
  it("states the bitrate per camera and the codec", () => {
    expect(storageBitrateAssumptionHe({ bitrateMbps: 4 })).toBe("≈4 Mbps למצלמה, H.265");
    expect(storageBitrateAssumptionHe({ bitrateMbps: 2.25 }, "h264")).toBe("≈2.3 Mbps למצלמה, H.264");
    expect(storageBitrateAssumptionHe({})).toBeNull();
  });

  it("summary metrics: rounded TB, commercial disk when the catalog has none, and the assumption", () => {
    const summary = buildEngineeringSummary(rec({ requiredTbWithOverhead: 3.6288, bitrateMbps: 4, bitrateSource: "ENGINEERING_DEFAULT" }));
    expect(summary.commercialDisk).toBe("4TB");
    expect(summary.bitrateAssumption).toBe("≈4 Mbps למצלמה, H.265");
    const metrics = buildCalculatedMetrics(rec({ requiredTbWithOverhead: 3.6288, bitrateMbps: 4 }), defaultCctvBuildRequirements().cctvTechnology);
    const storage = metrics.find((m) => m.id === "storage");
    expect(storage?.value).toBe("≈3.6 TB · 4TB");
    expect(metrics.find((m) => m.id === "storage-assumption")?.value).toBe("≈4 Mbps למצלמה, H.265");
  });

  it("prefers the engine's catalog packing when it found disks", () => {
    const summary = buildEngineeringSummary(
      rec({ requiredTbWithOverhead: 3.6288, bitrateMbps: 4 }, { hdd: { status: "ok", driveCount: 1, driveCapacityTb: 6 } }),
    );
    expect(summary.hddPacking).toBe("1 × 6TB");
  });
});
