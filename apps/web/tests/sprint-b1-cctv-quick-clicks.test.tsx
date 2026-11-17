import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ApiClient, SystemRecommendation } from "@site-secure/api-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTO_CALC_DEBOUNCE_MS, SystemBuilderDrawer } from "../src/components/quotes/cpq/SystemBuilderDrawer";
import { he } from "../src/i18n/he";

const camera = { id: "p-cam", name: "מצלמה 4MP", sku: "CAM", category_key: "cameras_ip", unit: "unit", attributes: {} };

function rec(): SystemRecommendation {
  return {
    system_type: "cctv",
    engine_version: 1,
    status: "OK",
    blocking: false,
    input: { cameraCount: 4, cctvTechnology: "ip", retentionDays: 14 },
    engineering: { recorder: { selectedChannelTier: 8 }, storage: { requiredTbWithOverhead: 2.9 } },
    unresolved: [],
    components: [
      {
        role: "camera",
        component_key: "camera_ip_main",
        label: "camera",
        quantity: 4,
        optional: false,
        editable: true,
        blocking: true,
        resolution_status: "RESOLVED",
        technical_requirements: {},
        candidates: [{ product: camera, confidence: "STRUCTURED", compatibility: {} }],
        selected_product: camera,
        selected_confidence: "STRUCTURED",
        reason_codes: [],
      },
    ],
  } as unknown as SystemRecommendation;
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Count a real user click (not timer/auto-calc). */
function click(el: Element) {
  fireEvent.click(el);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Sprint B.1 quick mode empty → full quote under 10 clicks", () => {
  it("reaches an applied quote with fewer than 10 user clicks", async () => {
    let clicks = 0;
    const design = { id: "d1", revision: 1, engine_type: "cctv", created_at: "2026-11-16T00:00:00Z", components: [] };
    const quote = { id: "q1", items: [{ id: "i1" }], sections: [], total_gross: 3200 };
    const api = {
      recommendCctv: vi.fn(async () => rec()),
      listSystemDesigns: vi.fn(async () => ({ items: [] })),
      createSystemDesign: vi.fn(async () => design),
      patchSystemDesign: vi.fn(async () => ({ ...design, revision: 2 })),
      getSystemDesign: vi.fn(async () => design),
      applySystemDesign: vi.fn(async () => ({ design: { ...design, revision: 3 }, quote })),
    } as unknown as ApiClient;
    const ensureQuoteId = vi.fn(async () => "q1");
    const onAppliedQuote = vi.fn();

    render(
      <QueryClientProvider client={new QueryClient()}>
        <SystemBuilderDrawer
          open
          onClose={() => {}}
          workspaceId="ws"
          quoteId={null}
          ensureQuoteId={ensureQuoteId}
          api={api}
          onApply={() => {}}
          onAppliedQuote={onAppliedQuote}
        />
      </QueryClientProvider>,
    );

    // 1–2: set indoor/outdoor (select open is not needed with change; count as 1 interaction)
    const env = screen.getByLabelText(he.cpqCctvEnvironment);
    fireEvent.change(env, { target: { value: "indoor" } });
    clicks += 1;

    // Auto-calc — no click
    await advance(AUTO_CALC_DEBOUNCE_MS + 50);
    expect(api.recommendCctv).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: he.cpqCctvCalculate })).not.toBeInTheDocument();

    // 3: continue to equipment
    const cont = screen.getByRole("button", { name: he.cpqCctvContinueToEquipment });
    expect(cont).toBeEnabled();
    click(cont);
    clicks += 1;
    await advance(50);

    // 4: add plan to quote
    const footer = document.querySelector(".cpq-cctv-designer-footer")!;
    const add = within(footer as HTMLElement)
      .getAllByRole("button")
      .find((b) => !b.hasAttribute("disabled") && (b.textContent ?? "").includes("הצעה"));
    expect(add).toBeTruthy();
    click(add!);
    clicks += 1;
    await advance(50);

    expect(onAppliedQuote).toHaveBeenCalledWith(quote);
    expect(screen.getByTestId("cctv-apply-success")).toBeInTheDocument();
    expect(ensureQuoteId).toHaveBeenCalledTimes(1);
    expect(clicks).toBeLessThan(10);
  });
});
