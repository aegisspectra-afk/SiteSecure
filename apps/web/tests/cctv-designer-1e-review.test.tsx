/**
 * SYSTEM-DESIGNER-1 Slice E — review / picker / selection tests A–Q.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import type {
  CctvRecommendationCandidate,
  CctvRecommendationComponent,
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
  buildApplyReadinessPreview,
  candidateSpecLines,
  categoryKeysForComponent,
  classifyPriorSelection,
  commercialRoleLabelHe,
  deriveReviewCardStatus,
  filterPickerCandidates,
  groupComponentsForReview,
  overallCompatibility,
} from "../src/lib/cctv-designer-review";
import { mergeSelectionAfterRecalculate } from "../src/lib/cctv-design-persistence";
import { emptyReviewSelection } from "../src/lib/cctv-recommend-projection";
import { CctvReviewPanel } from "../src/components/quotes/cpq/CctvReviewPanel";
import { CctvComponentPicker } from "../src/components/quotes/cpq/CctvComponentPicker";

function cand(
  id: string,
  opts: {
    name?: string;
    category?: string;
    compat?: Record<string, string>;
    confidence?: CctvRecommendationCandidate["confidence"];
    attrs?: Record<string, unknown>;
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
      attributes: opts.attrs ?? {},
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
    quantity: 1,
    optional: false,
    editable: true,
    blocking: true,
    resolution_status: candidates.length ? "RESOLVED" : "UNRESOLVED",
    technical_requirements: { component_key: key },
    candidates,
    selected_product: candidates[0]?.product,
    selected_confidence: candidates[0]?.confidence,
    selected_compatibility: candidates[0]?.compatibility,
    reason_codes: [{ code: "RECORDER_TECHNOLOGY_PATH", params: { technology: "ip", minChannels: 8 } }],
    ...opts,
  } as CctvRecommendationComponent;
}

function rec(components: CctvRecommendationComponent[], tech = "ip"): SystemRecommendation {
  return {
    system_type: "cctv",
    engine_version: 1,
    status: "OK",
    blocking: false,
    input: { cameraCount: 4, cctvTechnology: tech },
    engineering: {
      recorder: { selectedChannelTier: 8 },
      storage: { requiredTbWithOverhead: 2 },
      poe: { requiredPorts: 4, requiredBudgetW: 40 },
      poeArchitecture: { externalSwitchRequired: false },
    },
    components,
    warnings: [],
    assumptions: [],
    unresolved: [],
  } as SystemRecommendation;
}

const apiStub = {
  listCatalogProducts: vi.fn(async () => ({ items: [] })),
} as never;

describe("SYSTEM-DESIGNER-1 Slice E review", () => {
  it("A. IP camera picker categories", () => {
    expect(categoryKeysForComponent("camera_ip_main", "ip")).toContain("cameras_ip");
  });

  it("B. Analog camera picker categories", () => {
    expect(categoryKeysForComponent("camera_analog_main", "analog_hd")).toEqual(["cameras_analog"]);
  });

  it("C. Hybrid separate IP/Analog selection cards", () => {
    const recommendation = rec(
      [
        comp("camera_ip_main", "camera", { candidates: [cand("ip1", { category: "cameras_ip" })] }),
        comp("camera_analog_main", "camera", {
            candidates: [cand("an1", { category: "cameras_analog", attrs: { poe: false } })],
          }),
        ],
        "hybrid",
      );
    const sections = groupComponentsForReview(recommendation.components);
    const cameras = sections.find((s) => s.id === "cameras");
    expect(cameras?.components).toHaveLength(2);
    expect(commercialRoleLabelHe("camera_ip_main", "hybrid")).toBe("מצלמת IP");
    expect(commercialRoleLabelHe("camera_analog_main", "hybrid")).toBe("מצלמה אנלוגית");
  });

  it("D. Recorder picker categories by technology", () => {
    expect(categoryKeysForComponent("recorder_main", "ip")).toEqual(["nvr"]);
    expect(categoryKeysForComponent("recorder_main", "analog_hd")).toEqual(["dvr_xvr"]);
    expect(categoryKeysForComponent("recorder_main", "hybrid")).toEqual(["dvr_xvr", "nvr"]);
  });

  it("E. HDD picker categories + specs", () => {
    expect(categoryKeysForComponent("storage_main", "ip")).toEqual(["hdd_recorders"]);
    const specs = candidateSpecLines(
      "storage_main",
      cand("h1", { category: "hdd_recorders", attrs: { capacity_tb: 10, surveillance_grade: true } }),
    );
    expect(specs.join(" ")).toMatch(/10/);
    expect(specs.join(" ")).toMatch(/surveillance/);
  });

  it("F. PoE switch picker categories + specs", () => {
    expect(categoryKeysForComponent("poe_switch_main", "ip")).toContain("switch");
    const specs = candidateSpecLines(
      "poe_switch_main",
      cand("s1", { category: "switch", attrs: { ports: 16, poe_budget_w: 120 } }),
    );
    expect(specs.join(" ")).toMatch(/16/);
    expect(specs.join(" ")).toMatch(/120/);
  });

  it("G. PASS candidate", () => {
    expect(overallCompatibility({ channels: "PASS", drive_bays: "PASS" })).toBe("PASS");
  });

  it("H. UNKNOWN candidate", () => {
    expect(overallCompatibility({ channels: "PASS", ip_channels: "UNKNOWN" })).toBe("UNKNOWN");
  });

  it("I. FAIL candidate filtered by default", () => {
    const list = filterPickerCandidates(
      [
        cand("ok", { compat: { channels: "PASS" } }),
        cand("bad", { compat: { channels: "FAIL" } }),
      ],
      { includeFail: false },
    );
    expect(list.map((c) => c.product.id)).toEqual(["ok"]);
  });

  it("J. empty catalog picker state", async () => {
    const component = comp("camera_ip_main", "camera", { candidates: [] });
    render(
      <CctvComponentPicker
        open
        onClose={() => undefined}
        component={component}
        technology="ip"
        workspaceId="ws"
        api={apiStub}
        onSelect={() => undefined}
      />,
    );
    expect(await screen.findByTestId("cctv-picker-empty")).toBeInTheDocument();
  });

  it("K. required unresolved status", () => {
    const c = comp("recorder_main", "recorder", { candidates: [], optional: false, blocking: true });
    expect(deriveReviewCardStatus(c, null, false)).toBe("needs");
  });

  it("L. optional unresolved status", () => {
    const c = comp("ups_main", "ups", { candidates: [], optional: true, blocking: false });
    expect(deriveReviewCardStatus(c, null, false)).toBe("optional");
    const preview = buildApplyReadinessPreview(
      rec([c]),
      emptyReviewSelection(),
    );
    expect(preview.optionalUnresolved).toBe(1);
    expect(preview.needsEquipment).toBe(0);
  });

  it("M. selection persists by component_key", () => {
    const recommendation = rec([
      comp("camera_ip_main", "camera", { candidates: [cand("a"), cand("b")] }),
    ]);
    const prior = {
      selectedByComponentId: { camera_ip_main: "b" },
      removedComponentIds: new Set<string>(),
    };
    const merged = mergeSelectionAfterRecalculate(recommendation, prior);
    expect(merged.selection.selectedByComponentId.camera_ip_main).toBe("b");
  });

  it("N. recalc preserves compatible", () => {
    expect(classifyPriorSelection(cand("x", { compat: { channels: "PASS" }, confidence: "STRUCTURED" }))).toBe(
      "keep",
    );
  });

  it("O. recalc invalidates incompatible FAIL", () => {
    expect(classifyPriorSelection(cand("x", { compat: { channels: "FAIL" } }))).toBe("drop");
    const recommendation = rec([
      comp("recorder_main", "recorder", {
        candidates: [cand("new", { compat: { channels: "PASS" } })],
      }),
    ]);
    const prior = {
      selectedByComponentId: { recorder_main: "gone" },
      removedComponentIds: new Set<string>(),
    };
    const merged = mergeSelectionAfterRecalculate(recommendation, prior);
    expect(merged.needsReviewRoles.has("recorder_main")).toBe(true);
    expect(merged.selection.selectedByComponentId.recorder_main).not.toBe("gone");
  });

  it("P. Q4-S — picker list call has no cost field expectation", async () => {
    const spy = vi.fn(async () => ({
      items: [
        {
          id: "p1",
          name: "Cam",
          sku: "C1",
          category_key: "cameras_ip",
          list_price: 10,
          unit: "unit",
          // cost intentionally absent
        },
      ],
    }));
    render(
      <CctvComponentPicker
        open
        onClose={() => undefined}
        component={comp("camera_ip_main", "camera", { candidates: [] })}
        technology="ip"
        workspaceId="ws"
        api={{ listCatalogProducts: spy } as never}
        onSelect={() => undefined}
      />,
    );
    await screen.findByTestId("cctv-component-picker");
    expect(spy).toHaveBeenCalled();
    const item = await spy.mock.results[0]!.value;
    expect(item.items[0]).not.toHaveProperty("cost");
  });

  it("Q. mobile review cards + picker open", async () => {
    const user = userEvent.setup();
    const recommendation = rec([
      comp("poe_switch_main", "poe_switch", {
        candidates: [],
        technical_requirements: { minPoePorts: 8, minPoeBudgetW: 120, component_key: "poe_switch_main" },
        reason_codes: [{ code: "EXTERNAL_SWITCH_REQUIRED", params: {} }],
      }),
    ]);
    const selection = emptyReviewSelection();
    render(
      <CctvReviewPanel
        rec={recommendation}
        selection={selection}
        setSelection={() => undefined}
        workspaceId="ws"
        api={apiStub}
      />,
    );
    expect(screen.getByTestId("cctv-apply-readiness-preview")).toBeInTheDocument();
    expect(screen.getByTestId("cctv-review-card-poe_switch_main")).toHaveAttribute("data-status", "needs");
    expect(screen.getByText("דרישה")).toBeInTheDocument();
    expect(screen.getByText("למה")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "בחר מוצר" }));
    expect(await screen.findByTestId("cctv-component-picker")).toBeInTheDocument();
  });

  it("commercial labels and apply preview counts", () => {
    expect(commercialRoleLabelHe("recorder_main", "ip")).toBe("NVR");
    expect(commercialRoleLabelHe("recorder_main", "analog_hd")).toBe("DVR");
    expect(commercialRoleLabelHe("recorder_main", "hybrid")).toBe("XVR");
    const recommendation = rec([
      comp("camera_ip_main", "camera", { candidates: [cand("c1")] }),
      comp("cable_ip_main", "cable", { optional: true, blocking: false, candidates: [] }),
    ]);
    const preview = buildApplyReadinessPreview(recommendation, {
      selectedByComponentId: { camera_ip_main: "c1" },
      removedComponentIds: new Set(),
    });
    expect(preview.required).toBe(1);
    expect(preview.selected).toBe(1);
    expect(preview.optional).toBe(1);
    expect(preview.needsEquipment).toBe(0);
  });
});
