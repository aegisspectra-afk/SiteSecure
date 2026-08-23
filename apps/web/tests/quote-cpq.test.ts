import { describe, expect, it } from "vitest";
import type { CatalogProduct, LeadOut, QuoteItemOut } from "@site-secure/api-client";
import {
  canSendWithGaps,
  filterEmptyQuoteMarginGaps,
  groupGapsByDomain,
  isPriceOverride,
  leadRequirementRows,
  mergeQuoteGaps,
  neighborSortOrders,
  softQuoteAdvisories,
} from "../src/lib/quote-cpq";
import { buildCctvRecommendation, defaultCctvInputFromLead } from "../src/lib/system-builder";

const lead = (partial: Partial<LeadOut> = {}): LeadOut => ({
  id: "l1",
  workspace_id: "w",
  title: "מערכת מצלמות",
  status: "visit_scheduling",
  source: "whatsapp",
  created_at: "2026-08-23T20:00:00Z",
  updated_at: "2026-08-23T20:00:00Z",
  requirements: {
    camera_count: 9,
    location: "פנים",
    infrastructure: "חדשה",
    recording: true,
    remote_viewing: true,
  },
  ...partial,
});

describe("quote-cpq helpers", () => {
  it("exposes lead requirements without inventing rows", () => {
    const rows = leadRequirementRows(lead());
    expect(rows.some((row) => row.id === "cameras" && row.value === "9")).toBe(true);
    expect(rows.some((row) => row.id === "recording" && row.value === "כן")).toBe(true);
    expect(leadRequirementRows(null)).toEqual([]);
  });

  it("detects price overrides from catalog snapshot", () => {
    const item: QuoteItemOut = {
      id: "i1",
      quote_id: "q1",
      description: "Camera",
      qty: 1,
      unit_price: 690,
      item_type: "catalog",
      catalog_snapshot: { list_price: 750 },
    };
    expect(isPriceOverride(item)).toBe(true);
    expect(isPriceOverride({ ...item, unit_price: 750 })).toBe(false);
  });

  it("blocks send only on critical gaps", () => {
    expect(
      canSendWithGaps([
        { field: "items", code: "advisory", message: "x", severity: "warning" },
        { field: "items", code: "info", message: "y", severity: "info" },
      ]),
    ).toBe(true);
    expect(canSendWithGaps([{ field: "title", code: "title", message: "חסר", severity: "critical" }])).toBe(false);
  });

  it("groups gaps and hides empty-quote margin noise", () => {
    const gaps = [
      { field: "title", code: "title", message: "t", severity: "critical" as const },
      { field: "items", code: "advisory_nvr", message: "n", severity: "warning" as const },
      { field: "margin", code: "margin_below_minimum", message: "m", severity: "warning" as const },
    ];
    expect(filterEmptyQuoteMarginGaps(gaps, 0).some((g) => g.code === "margin_below_minimum")).toBe(false);
    expect(filterEmptyQuoteMarginGaps(gaps, 2).some((g) => g.code === "margin_below_minimum")).toBe(true);
    const grouped = groupGapsByDomain(gaps);
    expect(grouped.completeness).toHaveLength(1);
    expect(grouped.technical).toHaveLength(1);
    expect(grouped.financial).toHaveLength(1);
  });

  it("soft advisories never auto-add equipment and warn on missing NVR/HDD", () => {
    const gaps = softQuoteAdvisories({ lead: lead(), items: [] });
    expect(gaps.some((g) => g.code === "advisory_nvr")).toBe(true);
    expect(gaps.some((g) => g.code === "advisory_hdd")).toBe(true);
    expect(gaps.every((g) => g.severity !== "critical")).toBe(true);
  });

  it("merges soft gaps without duplicating codes", () => {
    const merged = mergeQuoteGaps(
      [{ field: "items", code: "advisory_nvr", message: "server" }],
      softQuoteAdvisories({ lead: lead(), items: [] }),
    );
    expect(merged.filter((g) => g.code === "advisory_nvr")).toHaveLength(1);
  });

  it("computes neighbor sort orders for reorder", () => {
    const items: QuoteItemOut[] = [
      { id: "a", quote_id: "q", description: "A", qty: 1, unit_price: 1, sort_order: 10 },
      { id: "b", quote_id: "q", description: "B", qty: 1, unit_price: 1, sort_order: 20 },
    ];
    expect(neighborSortOrders(items, "b", "up")).toEqual({
      itemId: "b",
      sort_order: 10,
      swapId: "a",
      swap_order: 20,
    });
    expect(neighborSortOrders(items, "a", "up")).toBeNull();
  });
});

describe("system builder", () => {
  it("recommends catalog matches and marks missing as not configured", () => {
    const catalog: CatalogProduct[] = [
      { id: "c1", name: "IPC Camera Dome", sku: "CAM-1", unit: "ea", kind: "product", list_price: 700 },
      { id: "n1", name: "NVR 16CH", sku: "NVR-16", unit: "ea", kind: "product", list_price: 1200 },
    ];
    const plan = buildCctvRecommendation(
      {
        cameraCount: 9,
        cameraType: "dome",
        needsRecorder: true,
        needsStorage: true,
        needsPoe: false,
        needsCabling: false,
        needsInstallation: false,
        needsRemote: false,
      },
      catalog,
    );
    expect(plan.find((line) => line.role === "camera")?.product?.id).toBe("c1");
    expect(plan.find((line) => line.role === "nvr")?.product?.id).toBe("n1");
    expect(plan.find((line) => line.role === "storage")?.configured).toBe(false);
  });

  it("seeds CCTV input from lead without inventing camera counts as zero", () => {
    const input = defaultCctvInputFromLead({
      cameraCount: 9,
      recording: true,
      remoteViewing: true,
      infrastructure: "חדשה",
    });
    expect(input.cameraCount).toBe(9);
    expect(input.needsRemote).toBe(true);
    expect(input.needsCabling).toBe(true);
  });

  it("does not invent products when catalog is empty", () => {
    const plan = buildCctvRecommendation(defaultCctvInputFromLead({ cameraCount: 9 }), []);
    expect(plan.every((line) => !line.configured && line.product == null)).toBe(true);
  });
});
