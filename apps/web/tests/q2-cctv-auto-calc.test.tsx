import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ApiClient, SystemRecommendation } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTO_CALC_DEBOUNCE_MS, SystemBuilderDrawer } from "../src/components/quotes/cpq/SystemBuilderDrawer";
import { he } from "../src/i18n/he";
import { designerStatus } from "../src/lib/cctv-designer-summary";

function rec(): SystemRecommendation {
  return {
    system_type: "cctv",
    engine_version: 1,
    status: "OK",
    blocking: false,
    input: { cameraCount: 4, cctvTechnology: "ip", retentionDays: 14 },
    engineering: { recorder: { selectedChannelTier: 4 }, storage: { requiredTbWithOverhead: 2.9 } },
    components: [],
    unresolved: [],
  } as unknown as SystemRecommendation;
}

const recommendCctv = vi.fn(async () => rec());
const api = { recommendCctv } as unknown as ApiClient;

function renderDrawer() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <SystemBuilderDrawer open onClose={() => {}} workspaceId="ws" quoteId={null} api={api} onApply={() => {}} />
    </QueryClientProvider>,
  );
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  recommendCctv.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("Q2.3 one status", () => {
  it("maps the designer state to a single label", () => {
    const base = { valid: true, calculating: false, calcError: false, calcState: "fresh" as const, persistState: "saved" as const };
    expect(designerStatus({ ...base, valid: false }).label).toBe("חסרים נתונים לחישוב");
    expect(designerStatus({ ...base, calcState: "draft" }).label).toBe("יחושב אוטומטית");
    expect(designerStatus({ ...base, calculating: true }).label).toBe("מחשב…");
    expect(designerStatus({ ...base, calcError: true }).label).toBe("שגיאה בחישוב");
    expect(designerStatus(base).label).toBe("מחושב ונשמר");
    expect(designerStatus({ ...base, persistState: "idle" }).label).toBe("מחושב");
    expect(designerStatus({ ...base, persistState: "error" }).label).toBe("מחושב · שגיאה בשמירה");
  });
});

describe("Q2.3 automatic calculation", () => {
  it(`calculates ${AUTO_CALC_DEBOUNCE_MS} ms after opening, without a click, and stays on requirements`, async () => {
    renderDrawer();
    await advance(AUTO_CALC_DEBOUNCE_MS - 50);
    expect(recommendCctv).not.toHaveBeenCalled();
    expect(screen.getByTestId("cctv-calc-state")).toHaveTextContent("יחושב אוטומטית");
    await advance(100);
    expect(recommendCctv).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("cctv-designer-requirements-shell")).toBeInTheDocument();
    expect(screen.getByTestId("cctv-calc-state")).toHaveTextContent("מחושב");
  });

  it("debounces: several quick edits make one call with the latest values", async () => {
    renderDrawer();
    await advance(AUTO_CALC_DEBOUNCE_MS + 50);
    recommendCctv.mockClear();
    const inc = screen.getAllByRole("button", { name: he.cpqCctvStepperInc })[0]!;
    fireEvent.click(inc);
    await advance(200);
    fireEvent.click(inc);
    await advance(200);
    fireEvent.click(inc);
    expect(recommendCctv).not.toHaveBeenCalled();
    await advance(AUTO_CALC_DEBOUNCE_MS + 50);
    expect(recommendCctv).toHaveBeenCalledTimes(1);
    expect((recommendCctv.mock.calls as unknown as unknown[][])[0]![1]).toMatchObject({ camera_count: 7 });
  });

  it("shows one status only (no separate calc/save/readiness pills)", async () => {
    const { container } = renderDrawer();
    await advance(AUTO_CALC_DEBOUNCE_MS + 50);
    expect(container.querySelectorAll(".cpq-cctv-sum-pill")).toHaveLength(0);
    expect(screen.getAllByRole("status").filter((el) => el.getAttribute("data-testid") === "cctv-calc-state")).toHaveLength(1);
  });

  it("after an up-to-date result the button continues without calculating again", async () => {
    renderDrawer();
    await advance(AUTO_CALC_DEBOUNCE_MS + 50);
    expect(recommendCctv).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: he.cpqCctvContinueToEquipment }));
    await advance(10);
    expect(recommendCctv).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("cctv-designer-requirements-shell")).not.toBeInTheDocument();
  });
});

describe("Q2.3 first save on a new quote", () => {
  it("does not reload or recalculate when the quote id arrives from the drawer's own save", async () => {
    const design = { id: "d1", revision: 1, engine_type: "cctv", created_at: "2026-11-15T00:00:00Z", components: [] };
    const full = {
      recommendCctv,
      listSystemDesigns: vi.fn(async () => ({ items: [design] })),
      createSystemDesign: vi.fn(async () => design),
      patchSystemDesign: vi.fn(async () => ({ ...design, revision: 2 })),
      getSystemDesign: vi.fn(async () => design),
    } as unknown as ApiClient;
    const ensureQuoteId = vi.fn(async () => "q1");
    const client = new QueryClient();
    const view = (quoteId: string | null) => (
      <QueryClientProvider client={client}>
        <SystemBuilderDrawer open onClose={() => {}} workspaceId="ws" quoteId={quoteId} ensureQuoteId={ensureQuoteId} api={full} onApply={() => {}} />
      </QueryClientProvider>
    );
    const { rerender } = render(view(null));
    await advance(AUTO_CALC_DEBOUNCE_MS + 50);
    expect(ensureQuoteId).toHaveBeenCalledTimes(1);
    const listsBefore = (full.listSystemDesigns as ReturnType<typeof vi.fn>).mock.calls.length;
    rerender(view("q1")); // the parent now knows the quote it created for us
    await advance(AUTO_CALC_DEBOUNCE_MS * 3);
    expect(recommendCctv).toHaveBeenCalledTimes(1);
    expect(full.getSystemDesign).not.toHaveBeenCalled();
    expect((full.listSystemDesigns as ReturnType<typeof vi.fn>).mock.calls.length).toBe(listsBefore);
    expect(screen.getByTestId("cctv-designer-requirements-shell")).toBeInTheDocument();
  });
});
