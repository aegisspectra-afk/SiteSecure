import { render, screen, within } from "@testing-library/react";
import type { SystemRecommendation } from "@site-secure/api-client";
import { describe, expect, it, vi } from "vitest";
import { CctvEngineeringSummaryPanel } from "../src/components/quotes/cpq/CctvEngineeringSummaryPanel";
import { CctvReviewPanel } from "../src/components/quotes/cpq/CctvReviewPanel";
import { he } from "../src/i18n/he";
import { defaultCctvBuildRequirements } from "../src/lib/cctv-build-requirements";
import { emptyReviewSelection } from "../src/lib/cctv-recommend-projection";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => <a className={className}>{children}</a>,
}));

function comp(key: string, role: string, opts: { optional?: boolean; product?: boolean } = {}) {
  const product = opts.product ? { id: `p-${key}`, name: key, sku: key, category_key: "x", unit: "unit", attributes: {} } : null;
  return {
    role,
    component_key: key,
    label: role,
    quantity: 1,
    optional: Boolean(opts.optional),
    editable: true,
    blocking: !opts.optional,
    resolution_status: product ? "RESOLVED" : "UNRESOLVED",
    technical_requirements: {},
    candidates: product ? [{ product, confidence: "STRUCTURED", compatibility: {} }] : [],
    selected_product: product,
    selected_confidence: product ? "STRUCTURED" : undefined,
    reason_codes: [],
  };
}

function rec(): SystemRecommendation {
  return {
    system_type: "cctv",
    engine_version: 1,
    status: "OK",
    blocking: false,
    input: { cameraCount: 4, cctvTechnology: "ip" },
    engineering: {},
    unresolved: [],
    components: [
      comp("camera_ip_main", "camera", { product: true }),
      comp("recorder_main", "recorder", { product: true }),
      comp("storage_main", "storage"),
      comp("ups_main", "ups", { optional: true }),
    ],
  } as unknown as SystemRecommendation;
}

describe("Q2.8 simple counter", () => {
  it("shows 'X מתוך Y נבחרו' for required components, optional ones aside", () => {
    render(
      <CctvReviewPanel
        rec={rec()}
        selection={emptyReviewSelection()}
        setSelection={() => {}}
        needsReviewKeys={new Set()}
        onNeedsReviewKeysChange={() => {}}
        applyError={null}
        focusComponentKey={null}
        workspaceId="ws"
        api={{} as never}
      />,
    );
    const box = screen.getByTestId("cctv-apply-readiness-preview");
    expect(within(box).getByTestId("cctv-selected-counter")).toHaveTextContent(he.cpqCctvSelectedOf(2, 3));
    expect(box).toHaveTextContent(he.cpqCctvOptionalCount(1));
    expect(box.textContent).not.toContain("דורשים ציוד");
  });
});

describe("Q2.8 severity labels in Hebrew with an icon", () => {
  it("renders חוסם / אזהרה / מידע with an icon, never BLOCKER / WARNING / INFO", () => {
    render(
      <CctvEngineeringSummaryPanel
        req={{ ...defaultCctvBuildRequirements(), cableMetersPerCamera: "" }}
        recommendation={null}
        calcState="draft"
        readiness="planning_draft"
        persistState="idle"
        stale={false}
      />,
    );
    const center = screen.getByTestId("cctv-validation-center");
    expect(center.textContent).not.toMatch(/BLOCKER|WARNING|INFO/);
    const warning = within(center).getAllByTestId("cctv-severity-warning")[0]!;
    expect(warning).toHaveTextContent(he.cpqSeverityWarning);
    expect(warning.querySelector("svg")).not.toBeNull();
    const info = within(center).getAllByTestId("cctv-severity-info")[0]!;
    expect(info).toHaveTextContent(he.cpqSeverityInfo);
    expect(info.querySelector("svg")).not.toBeNull();
    expect(he.cpqSeverityBlocker).toBe("חוסם");
  });
});
