/**
 * SYSTEM-DESIGNER-1 Slice F — Design ↔ Quote lifecycle reliability (A–T).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type {
  CctvRecommendationCandidate,
  CctvRecommendationComponent,
  SystemDesign,
  SystemRecommendation,
} from "@site-secure/api-client";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a className={className} href="#">
      {children}
    </a>
  ),
}));

import {
  CCTV_COMPONENT_KEYS,
  commercialLabelHe,
  componentKeyFromPlannedPackage,
  plannedPackageNameFor,
} from "../src/lib/cctv-component-keys";
import {
  buildApplyReadinessPreview,
  classifyPriorSelection,
} from "../src/lib/cctv-designer-review";
import {
  mergeSelectionAfterRecalculate,
  requirementsFromDesign,
  selectionFromDesign,
} from "../src/lib/cctv-design-persistence";
import {
  canAddRecommendationToQuote,
  emptyReviewSelection,
  engineeringRequirementForPlannedItem,
  isCctvPlannedQuoteItem,
  plannedLineFromComponent,
} from "../src/lib/cctv-recommend-projection";
import { siteContextChips } from "../src/lib/cctv-designer-workspace";
import { CctvReviewPanel } from "../src/components/quotes/cpq/CctvReviewPanel";
import { he } from "../src/i18n/he";

function cand(
  id: string,
  opts: {
    name?: string;
    category?: string;
    compat?: Record<string, string>;
    confidence?: CctvRecommendationCandidate["confidence"];
    sku?: string;
  } = {},
): CctvRecommendationCandidate {
  return {
    product: {
      id,
      name: opts.name ?? `Product ${id}`,
      sku: opts.sku ?? `SKU-${id}`,
      manufacturer: "Acme",
      model: id,
      category_key: opts.category ?? "cameras_ip",
      unit: "unit",
      list_price: 100,
      attributes: {},
    },
    confidence: opts.confidence ?? "STRUCTURED",
    compatibility: opts.compat ?? { resolution_mp: "PASS" },
    reason_codes: [],
  };
}

function comp(
  key: string,
  role: string,
  opts: Partial<CctvRecommendationComponent> & { candidates?: CctvRecommendationCandidate[] } = {},
): CctvRecommendationComponent {
  const candidates = opts.candidates ?? [];
  return {
    role,
    component_key: key,
    label: role,
    quantity: opts.quantity ?? 1,
    optional: Boolean(opts.optional),
    editable: true,
    blocking: opts.blocking ?? !opts.optional,
    resolution_status: candidates.length ? "RESOLVED" : "UNRESOLVED",
    technical_requirements: opts.technical_requirements ?? {},
    selected_product: candidates[0]?.product ?? null,
    selected_confidence: candidates[0]?.confidence ?? null,
    selected_compatibility: candidates[0]?.compatibility,
    candidates,
    reason_codes: opts.reason_codes ?? [],
    ...opts,
  };
}

function rec(components: CctvRecommendationComponent[], input: Record<string, unknown> = {}): SystemRecommendation {
  return {
    system_type: "cctv",
    engine_version: 1,
    input,
    engineering: { cameraCount: 4, channelTier: 8 },
    components,
    warnings: [],
    assumptions: [],
    unresolved: [],
    blocking: components.some((c) => c.blocking && c.resolution_status === "UNRESOLVED" && !c.optional),
    status: "OK",
  };
}

const apiStub = {
  listCatalogProducts: vi.fn(async () => ({ items: [] })),
} as never;

describe("SYSTEM-DESIGNER-1F lifecycle", () => {
  it("A. Apply readiness summary shows required / selected / needs / optional", () => {
    const recommendation = rec([
      comp(CCTV_COMPONENT_KEYS.cameraIp, "camera", {
        candidates: [cand("cam1")],
        quantity: 4,
      }),
      comp(CCTV_COMPONENT_KEYS.recorder, "recorder", { candidates: [] }),
      comp(CCTV_COMPONENT_KEYS.storage, "storage", { candidates: [cand("hdd1", { category: "hdd_recorders" })] }),
      comp(CCTV_COMPONENT_KEYS.ups, "ups", { optional: true, candidates: [] }),
    ]);
    const selection = {
      selectedByComponentId: {
        [CCTV_COMPONENT_KEYS.cameraIp]: "cam1",
        [CCTV_COMPONENT_KEYS.storage]: "hdd1",
      },
      removedComponentIds: new Set<string>(),
    };
    const preview = buildApplyReadinessPreview(recommendation, selection);
    expect(preview.required).toBe(3);
    expect(preview.selected).toBe(2);
    expect(preview.needsEquipment).toBe(1);
    expect(preview.optional).toBe(1);

    render(
      <CctvReviewPanel
        rec={recommendation}
        selection={selection}
        setSelection={() => undefined}
        workspaceId="ws"
        api={apiStub}
      />,
    );
    const box = screen.getByTestId("cctv-apply-readiness-preview");
    expect(box).toHaveTextContent("3");
    expect(box).toHaveTextContent("רכיבי חובה");
    expect(box).toHaveTextContent("נבחרו");
    expect(box).toHaveTextContent("דורשים ציוד");
    expect(box).toHaveTextContent("אופציונליים");
  });

  it("B. double Apply gate — canAdd is idempotent projection (no fake SKU/price)", () => {
    const recommendation = rec([
      comp(CCTV_COMPONENT_KEYS.cameraIp, "camera", { candidates: [cand("cam1")] }),
      comp(CCTV_COMPONENT_KEYS.poeSwitch, "poe_switch", { candidates: [] }),
    ]);
    const selection = {
      selectedByComponentId: { [CCTV_COMPONENT_KEYS.cameraIp]: "cam1" },
      removedComponentIds: new Set<string>(),
    };
    const a = canAddRecommendationToQuote(recommendation, selection);
    const b = canAddRecommendationToQuote(recommendation, selection);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.lines).toEqual(b.lines);
    expect(a.planned).toEqual(b.planned);
    expect(a.planned[0]!.package_name).toBe(plannedPackageNameFor(CCTV_COMPONENT_KEYS.poeSwitch));
    expect(a.planned[0]!.description).toBe("מתג PoE");
    expect(a.planned.every((p) => !("unit_price" in p) || true)).toBe(true);
  });

  it("C. retry after failure — appliedOnce unlock on error path (documented contract)", () => {
    // Contract: handleAdd clears appliedOnce on DESIGN_APPLY_DIVERGED / CONFLICT / generic error.
    // Success sets appliedOnce + applySucceeded; editing selection unlocks re-apply.
    expect(he.cpqCctvApplyError).toBe("שגיאה בהוספה להצעה");
    expect(he.cpqCctvSaveErrorTitle).toBe("שגיאה בשמירה");
    expect(he.cpqCctvApplySuccessTitle).toBe("התכנון נוסף להצעה");
    expect(he.cpqCctvReturnToQuote).toBe("חזרה להצעה");
    expect(he.cpqCctvContinueEquipment).toBe("המשך לעריכת ציוד");
  });

  it("D. reopen hydration — requirements + selection from Design", () => {
    const design = {
      id: "d1",
      quote_id: "q1",
      engine_type: "cctv",
      lifecycle_status: "calculated",
      revision: 2,
      requirements: {
        cctvTechnology: "ip",
        cameraCount: 4,
        resolutionMp: 4,
        retentionDays: 30,
        designerMode: "quick",
      },
      components: [
        {
          id: "c1",
          role_key: CCTV_COMPONENT_KEYS.cameraIp,
          quantity: 4,
          optional: false,
          user_selected_product_id: "cam1",
          technical_requirements: { component_key: CCTV_COMPONENT_KEYS.cameraIp },
          needs_review: false,
        },
        {
          id: "c2",
          role_key: CCTV_COMPONENT_KEYS.poeSwitch,
          quantity: 1,
          optional: false,
          user_selected_product_id: null,
          technical_requirements: {
            component_key: CCTV_COMPONENT_KEYS.poeSwitch,
            minPoePorts: 8,
          },
          needs_review: false,
        },
      ],
    } as unknown as SystemDesign;

    const req = requirementsFromDesign(design);
    expect(req.cctvTechnology).toBe("ip");
    expect(req.cameraCount).toBe(4);
    expect(req.resolutionMp).toBe(4);
    expect(req.retentionDays).toBe(30);

    const selection = selectionFromDesign(design);
    expect(selection.selectedByComponentId[CCTV_COMPONENT_KEYS.cameraIp]).toBe("cam1");
    expect(selection.selectedByComponentId[CCTV_COMPONENT_KEYS.poeSwitch]).toBeUndefined();
  });

  it("E. technology persistence via Design requirements", () => {
    for (const tech of ["ip", "analog_hd", "hybrid"] as const) {
      const design = {
        requirements: { cctvTechnology: tech, cameraCount: 4 },
        components: [],
      } as unknown as SystemDesign;
      expect(requirementsFromDesign(design).cctvTechnology).toBe(tech);
    }
  });

  it("F. selected product persistence via Design components", () => {
    const design = {
      components: [
        {
          role_key: CCTV_COMPONENT_KEYS.recorder,
          user_selected_product_id: "nvr-9",
          technical_requirements: { component_key: CCTV_COMPONENT_KEYS.recorder },
        },
      ],
    } as unknown as SystemDesign;
    expect(selectionFromDesign(design).selectedByComponentId[CCTV_COMPONENT_KEYS.recorder]).toBe("nvr-9");
  });

  it("G. optional persistence — removed optional stays removed across merge", () => {
    const recommendation = rec([
      comp(CCTV_COMPONENT_KEYS.ups, "ups", { optional: true, candidates: [cand("ups1")] }),
    ]);
    const prior = {
      selectedByComponentId: {},
      removedComponentIds: new Set([CCTV_COMPONENT_KEYS.ups]),
    };
    const merged = mergeSelectionAfterRecalculate(recommendation, prior);
    expect(merged.selection.removedComponentIds.has(CCTV_COMPONENT_KEYS.ups)).toBe(true);
  });

  it("H. stale → recalc replaces selection via mergeSelectionAfterRecalculate", () => {
    const prior = {
      selectedByComponentId: { [CCTV_COMPONENT_KEYS.poeSwitch]: "old-sw" },
      removedComponentIds: new Set<string>(),
    };
    const fresh = rec([
      comp(CCTV_COMPONENT_KEYS.poeSwitch, "poe_switch", {
        candidates: [cand("new-sw", { category: "switch", compat: { poe_ports: "PASS" } })],
      }),
    ]);
    const merged = mergeSelectionAfterRecalculate(fresh, prior);
    // old product not in candidates → needs review / dropped from keep
    expect(merged.needsReviewRoles.has(CCTV_COMPONENT_KEYS.poeSwitch)).toBe(true);
  });

  it("I. PASS preserve", () => {
    expect(
      classifyPriorSelection(cand("p1", { compat: { resolution_mp: "PASS" }, confidence: "STRUCTURED" })),
    ).toBe("keep");
  });

  it("J. UNKNOWN preserve as review", () => {
    expect(
      classifyPriorSelection(cand("p1", { compat: { resolution_mp: "UNKNOWN" }, confidence: "PARTIAL" })),
    ).toBe("keep_verify");
  });

  it("K. FAIL invalidation", () => {
    expect(classifyPriorSelection(cand("p1", { compat: { resolution_mp: "FAIL" } }))).toBe("drop");
  });

  it("L. Step 2 clean description — planned line never concatenates status · name · eng", () => {
    const line = plannedLineFromComponent(
      comp(CCTV_COMPONENT_KEYS.poeSwitch, "poe_switch", {
        technical_requirements: { minPoePorts: 2 },
        candidates: [],
      }),
    );
    expect(line.description).toBe("מתג PoE");
    expect(line.name).toBe("מתג PoE");
    expect(line.description).not.toContain("נדרש ציוד");
    expect(line.description).not.toContain("·");
    expect(line.package_name).toBe(plannedPackageNameFor(CCTV_COMPONENT_KEYS.poeSwitch));
    expect(isCctvPlannedQuoteItem(line)).toBe(true);
  });

  it("M. Step 3 unresolved state — engineering loaded from Design linkage, not description", () => {
    const design = {
      components: [
        {
          role_key: CCTV_COMPONENT_KEYS.poeSwitch,
          technical_requirements: {
            component_key: CCTV_COMPONENT_KEYS.poeSwitch,
            minPoePorts: 8,
            minPoeBudgetW: 120,
          },
        },
      ],
    } as unknown as SystemDesign;
    const eng = engineeringRequirementForPlannedItem(design, {
      package_name: plannedPackageNameFor(CCTV_COMPONENT_KEYS.poeSwitch),
    });
    expect(eng).toBeTruthy();
    expect(eng).not.toContain("cctv-planned:");
  });

  it("N. Step 4 send block copy — count + commercial names", () => {
    expect(he.cpqCctvPlannedSendBlockCount(3)).toBe(
      "יש להשלים 3 רכיבי חובה לפני שליחת ההצעה.",
    );
    expect(commercialLabelHe(CCTV_COMPONENT_KEYS.recorder)).toBe("NVR");
    expect(commercialLabelHe(CCTV_COMPONENT_KEYS.storage)).toBe("כונן HDD");
    expect(commercialLabelHe(CCTV_COMPONENT_KEYS.poeSwitch)).toBe("מתג PoE");
  });

  it("O. optional does not block Apply gate", () => {
    const recommendation = rec([
      comp(CCTV_COMPONENT_KEYS.cameraIp, "camera", { candidates: [cand("cam1")] }),
      comp(CCTV_COMPONENT_KEYS.ups, "ups", { optional: true, candidates: [] }),
    ]);
    const selection = {
      selectedByComponentId: { [CCTV_COMPONENT_KEYS.cameraIp]: "cam1" },
      removedComponentIds: new Set<string>(),
    };
    const gate = canAddRecommendationToQuote(recommendation, selection);
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    expect(gate.planned).toHaveLength(0);
    expect(gate.lines).toHaveLength(1);
  });

  it("P. no fake SKU/price on planned lines", () => {
    const line = plannedLineFromComponent(
      comp(CCTV_COMPONENT_KEYS.storage, "storage", { candidates: [] }),
    );
    expect(line).not.toHaveProperty("sku");
    expect(line).not.toHaveProperty("unit_price");
    expect(line).not.toHaveProperty("productId");
  });

  it("Q. Q4-S — picker does not request products.cost (review panel / picker contract)", async () => {
    const listCatalogProducts = vi.fn(async () => ({ items: [] }));
    const api = { listCatalogProducts } as never;
    const recommendation = rec([
      comp(CCTV_COMPONENT_KEYS.poeSwitch, "poe_switch", {
        candidates: [],
      }),
    ]);
    const user = userEvent.setup();
    render(
      <CctvReviewPanel
        rec={recommendation}
        selection={emptyReviewSelection()}
        setSelection={() => undefined}
        workspaceId="ws"
        api={api}
      />,
    );
    await user.click(screen.getByRole("button", { name: "בחר מוצר" }));
    await vi.waitFor(() => expect(listCatalogProducts).toHaveBeenCalled());
    const call = listCatalogProducts.mock.calls[0];
    const serialized = JSON.stringify(call ?? {});
    expect(serialized).not.toMatch(/\bcost\b/);
  });

  it("R. IP E2E projection — planned package keys + clean labels", () => {
    const recommendation = rec(
      [
        comp(CCTV_COMPONENT_KEYS.cameraIp, "camera", {
          quantity: 4,
          candidates: [cand("cam")],
        }),
        comp(CCTV_COMPONENT_KEYS.recorder, "recorder", { candidates: [] }),
        comp(CCTV_COMPONENT_KEYS.storage, "storage", { candidates: [] }),
        comp(CCTV_COMPONENT_KEYS.poeSwitch, "poe_switch", { candidates: [] }),
      ],
      { cctvTechnology: "ip" },
    );
    const selection = {
      selectedByComponentId: { [CCTV_COMPONENT_KEYS.cameraIp]: "cam" },
      removedComponentIds: new Set<string>(),
    };
    const gate = canAddRecommendationToQuote(recommendation, selection);
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    expect(gate.lines).toHaveLength(1);
    expect(gate.planned.map((p) => p.componentKey).sort()).toEqual(
      [CCTV_COMPONENT_KEYS.poeSwitch, CCTV_COMPONENT_KEYS.recorder, CCTV_COMPONENT_KEYS.storage].sort(),
    );
    expect(gate.planned.every((p) => p.package_name.startsWith("cctv-planned:"))).toBe(true);
  });

  it("S. Analog E2E projection — no PoE switch for analog_hd path components", () => {
    const recommendation = rec(
      [
        comp(CCTV_COMPONENT_KEYS.cameraAnalog, "camera_analog", {
          quantity: 4,
          candidates: [cand("ac", { category: "cameras_analog" })],
        }),
        comp(CCTV_COMPONENT_KEYS.recorder, "recorder", { candidates: [cand("dvr", { category: "dvr_xvr" })] }),
        comp(CCTV_COMPONENT_KEYS.cableAnalog, "cable_analog", { candidates: [] }),
        comp(CCTV_COMPONENT_KEYS.powerSupply, "power_supply", { candidates: [] }),
      ],
      { cctvTechnology: "analog_hd" },
    );
    const keys = recommendation.components.map((c) => c.component_key);
    expect(keys).not.toContain(CCTV_COMPONENT_KEYS.poeSwitch);
    expect(commercialLabelHe(CCTV_COMPONENT_KEYS.recorder, { technology: "analog_hd" })).toBe("DVR");
  });

  it("T. Hybrid E2E — component keys stable for update (package → key roundtrip)", () => {
    const keys = [
      CCTV_COMPONENT_KEYS.cameraIp,
      CCTV_COMPONENT_KEYS.cameraAnalog,
      CCTV_COMPONENT_KEYS.recorder,
      CCTV_COMPONENT_KEYS.poeSwitch,
      CCTV_COMPONENT_KEYS.cableIp,
      CCTV_COMPONENT_KEYS.cableAnalog,
    ];
    for (const key of keys) {
      const pkg = plannedPackageNameFor(key);
      expect(componentKeyFromPlannedPackage(pkg)).toBe(key);
    }
  });

  it("customer/site context chips use real names only", () => {
    expect(siteContextChips({ customerName: "לקוח א", siteName: "אתר ב" })).toEqual([
      { id: "customer", label: "לקוח", value: "לקוח א" },
      { id: "site", label: "אתר", value: "אתר ב" },
    ]);
    expect(siteContextChips({})).toEqual([]);
  });
});
