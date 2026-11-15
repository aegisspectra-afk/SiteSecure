import type { SystemRecommendation } from "@site-secure/api-client";
import { describe, expect, it } from "vitest";
import { switchNeed, switchNeedLabelHe } from "../src/lib/cctv-poe-switch";
import { buildEngineeringSummary } from "../src/lib/cctv-recommend-copy";
import { canAddRecommendationToQuote, emptyReviewSelection, type ReviewSelectionState } from "../src/lib/cctv-recommend-projection";

function nvr(id: string, attributes: Record<string, unknown>) {
  return { id, name: id, sku: id, category_key: "nvr", unit: "unit", attributes };
}

function rec(opts: { conditional: boolean; recorderCandidates?: ReturnType<typeof nvr>[] }): SystemRecommendation {
  const candidates = (opts.recorderCandidates ?? []).map((product) => ({ product, confidence: "STRUCTURED", compatibility: {} }));
  return {
    system_type: "cctv",
    engine_version: 1,
    status: "OK",
    blocking: false,
    input: { cameraCount: 6, cctvTechnology: "ip" },
    engineering: {
      poe: { requiredPorts: 6, requiredBudgetW: 57.6 },
      poeArchitecture: { externalSwitchRequired: !opts.conditional, switchConditional: opts.conditional },
    },
    unresolved: [],
    components: [
      {
        role: "recorder",
        component_key: "recorder_main",
        label: "recorder",
        quantity: 1,
        optional: false,
        editable: true,
        blocking: true,
        resolution_status: candidates.length ? "RESOLVED" : "UNRESOLVED",
        technical_requirements: { minChannels: 8 },
        candidates,
        reason_codes: [],
      },
      {
        role: "poe_switch",
        component_key: "poe_switch_main",
        label: "poe_switch",
        quantity: 1,
        optional: opts.conditional,
        editable: true,
        blocking: !opts.conditional,
        resolution_status: "UNRESOLVED",
        technical_requirements: { minPoePorts: 6, minPoeBudgetW: 57.6 },
        candidates: [],
        reason_codes: [{ code: opts.conditional ? "SWITCH_CONDITIONAL_ON_RECORDER" : "EXTERNAL_SWITCH_REQUIRED", params: {} }],
      },
    ],
  } as unknown as SystemRecommendation;
}

function pick(productId: string): ReviewSelectionState {
  return { ...emptyReviewSelection(), selectedByComponentId: { recorder_main: productId } };
}

const NO_POE = nvr("n-nopoe", { channels: 8, poe_ports: 0 });
const FEW_PORTS = nvr("n-4", { channels: 8, poe_ports: 4, poe_budget_w: 120 });
const LOW_BUDGET = nvr("n-low", { channels: 8, poe_ports: 8, poe_budget_w: 40 });
const ENOUGH = nvr("n-ok", { channels: 8, poe_ports: 8, poe_budget_w: 120 });
const UNKNOWN_BUDGET = nvr("n-nobudget", { channels: 8, poe_ports: 8 });

describe("Q2.5 switch need follows the chosen recorder", () => {
  it("is conditional while no recorder is chosen", () => {
    expect(switchNeed(rec({ conditional: true }), emptyReviewSelection())).toBe("conditional");
  });

  it("is required when the recorder has no PoE, too few ports or too little budget", () => {
    for (const product of [NO_POE, FEW_PORTS, LOW_BUDGET]) {
      expect(switchNeed(rec({ conditional: true, recorderCandidates: [product] }), pick(product.id)), product.id).toBe("required");
    }
  });

  it("is not needed when the recorder covers ports and budget", () => {
    expect(switchNeed(rec({ conditional: true, recorderCandidates: [ENOUGH] }), pick(ENOUGH.id))).toBe("not_needed");
  });

  it("stays conditional when the recorder's PoE budget is unknown", () => {
    expect(switchNeed(rec({ conditional: true, recorderCandidates: [UNKNOWN_BUDGET] }), pick(UNKNOWN_BUDGET.id))).toBe("conditional");
  });

  it("server-required switch stays required", () => {
    expect(switchNeed(rec({ conditional: false }), emptyReviewSelection())).toBe("required");
    expect(switchNeedLabelHe("required")).toContain("נדרש");
  });
});

describe("Q2.5 add to quote", () => {
  const plannedKeys = (gate: ReturnType<typeof canAddRecommendationToQuote>) =>
    gate.ok ? gate.planned.map((p) => p.componentKey) : [];

  it("a conditional or unneeded switch is not added", () => {
    expect(plannedKeys(canAddRecommendationToQuote(rec({ conditional: true }), emptyReviewSelection()))).not.toContain("poe_switch_main");
    const ok = rec({ conditional: true, recorderCandidates: [ENOUGH] });
    expect(plannedKeys(canAddRecommendationToQuote(ok, pick(ENOUGH.id)))).not.toContain("poe_switch_main");
  });

  it("becomes a planned (required) line when the chosen recorder lacks PoE", () => {
    const r = rec({ conditional: true, recorderCandidates: [NO_POE] });
    const gate = canAddRecommendationToQuote(r, pick(NO_POE.id));
    expect(plannedKeys(gate)).toContain("poe_switch_main");
    expect(gate.ok && gate.incomplete).toBe(true);
  });

  it("the summary calls a conditional switch 'conditional', not integrated", () => {
    expect(buildEngineeringSummary(rec({ conditional: true })).architecture).toBe("conditional");
    expect(buildEngineeringSummary(rec({ conditional: false })).architecture).toBe("external_switch");
  });
});
