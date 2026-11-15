import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ApiClient, SystemRecommendation } from "@site-secure/api-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTO_CALC_DEBOUNCE_MS, SystemBuilderDrawer } from "../src/components/quotes/cpq/SystemBuilderDrawer";
import { he } from "../src/i18n/he";

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
      {
        role: "camera_install",
        component_key: "installation_camera",
        label: "camera_install",
        quantity: 4,
        optional: false,
        editable: true,
        blocking: false,
        resolution_status: "UNRESOLVED",
        technical_requirements: {},
        candidates: [],
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

function setup(rate: number | null, canEdit: boolean) {
  const putLaborRate = vi.fn(async (_ws: string, value: number | null) => ({ labor_hourly_rate: value, can_edit: true }));
  const api = {
    recommendCctv: vi.fn(async () => rec()),
    getLaborRate: vi.fn(async () => ({ labor_hourly_rate: rate, can_edit: canEdit })),
    putLaborRate,
  } as unknown as ApiClient;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SystemBuilderDrawer open onClose={() => {}} workspaceId="ws" quoteId={null} api={api} onApply={() => {}} />
    </QueryClientProvider>,
  );
  return { putLaborRate };
}

async function toReview() {
  await advance(AUTO_CALC_DEBOUNCE_MS + 50);
  fireEvent.click(screen.getByRole("button", { name: he.cpqCctvContinueToEquipment }));
  await advance(10);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Q2.6 hourly rate on first use", () => {
  it("asks for the rate, explains lines go in unpriced, and saves to the workspace", async () => {
    const { putLaborRate } = setup(null, true);
    await toReview();
    expect(screen.getByTestId("cctv-labor-rate-missing")).toHaveTextContent(he.laborRateMissing);
    fireEvent.change(screen.getByLabelText(he.laborRateLabel), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: he.laborRateSave }));
    expect(screen.getByText(he.laborRateInvalid)).toBeInTheDocument();
    expect(putLaborRate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(he.laborRateLabel), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: he.laborRateSave }));
    await advance(10);
    expect(putLaborRate).toHaveBeenCalledWith("ws", 250);
    expect(screen.getByTestId("cctv-labor-rate-current")).toHaveTextContent(he.laborRateCurrent(250));
  });

  it("a user who cannot edit settings sees who to ask, not an input", async () => {
    setup(null, false);
    await toReview();
    expect(screen.queryByLabelText(he.laborRateLabel)).not.toBeInTheDocument();
    expect(screen.getByText(he.laborRateAskAdmin)).toBeInTheDocument();
  });

  it("an existing rate is shown and nothing is asked", async () => {
    setup(300, true);
    await toReview();
    expect(screen.getByTestId("cctv-labor-rate-current")).toHaveTextContent(he.laborRateCurrent(300));
    expect(screen.queryByTestId("cctv-labor-rate-missing")).not.toBeInTheDocument();
  });
});
