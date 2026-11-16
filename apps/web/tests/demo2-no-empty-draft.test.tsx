import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
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
    engineering: {},
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

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("DEMO-2.3 a quote is created only when it gets content", () => {
  it("adding the plan creates the quote once, saves the design, then applies", async () => {
    const order: string[] = [];
    const design = { id: "d1", revision: 1, engine_type: "cctv", created_at: "2026-11-16T00:00:00Z", components: [] };
    const quote = { id: "q1", items: [{ id: "i1" }], sections: [] };
    const api = {
      recommendCctv: vi.fn(async () => rec()),
      listSystemDesigns: vi.fn(async () => ({ items: [] })),
      createSystemDesign: vi.fn(async () => {
        order.push("design");
        return design;
      }),
      patchSystemDesign: vi.fn(async () => ({ ...design, revision: 2 })),
      getSystemDesign: vi.fn(async () => design),
      applySystemDesign: vi.fn(async () => {
        order.push("apply");
        return { design: { ...design, revision: 3 }, quote };
      }),
    } as unknown as ApiClient;
    const ensureQuoteId = vi.fn(async () => {
      order.push("quote");
      return "q1";
    });
    const onAppliedQuote = vi.fn();
    const client = new QueryClient();
    const view = (quoteId: string | null) => (
      <QueryClientProvider client={client}>
        <SystemBuilderDrawer
          open
          onClose={() => {}}
          workspaceId="ws"
          quoteId={quoteId}
          ensureQuoteId={ensureQuoteId}
          api={api}
          onApply={() => {}}
          onAppliedQuote={onAppliedQuote}
        />
      </QueryClientProvider>
    );
    const { rerender } = render(view(null));
    await advance(AUTO_CALC_DEBOUNCE_MS + 50);
    expect(ensureQuoteId).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: he.cpqCctvContinueToEquipment }));
    await advance(50);
    const add = screen
      .getAllByRole("button")
      .find((b) => b.closest(".cpq-cctv-designer-footer") && !b.hasAttribute("disabled") && b.textContent?.includes("הצעה"));
    expect(add).toBeTruthy();
    fireEvent.click(add!);
    await advance(50);
    expect(ensureQuoteId).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["quote", "design", "apply"]);
    expect(onAppliedQuote).toHaveBeenCalledWith(quote);
    expect(screen.getByTestId("cctv-apply-success")).toBeInTheDocument(); // the drawer stays open
    // The parent now knows the quote the drawer created: no reload, no recalculation.
    const calcs = (api.recommendCctv as ReturnType<typeof vi.fn>).mock.calls.length;
    rerender(view("q1"));
    await advance(AUTO_CALC_DEBOUNCE_MS * 3);
    expect(api.getSystemDesign).not.toHaveBeenCalled();
    expect((api.recommendCctv as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calcs);
    expect(screen.getByTestId("cctv-apply-success")).toBeInTheDocument();
  });
});
