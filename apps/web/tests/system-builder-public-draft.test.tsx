/** ז: SystemBuilder seeds cameraCount from public calculator session draft (D3). */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import type { ApiClient } from "@site-secure/api-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SystemBuilderDrawer } from "../src/components/quotes/cpq/SystemBuilderDrawer";
import { PUBLIC_CCTV_DRAFT_KEY } from "../src/lib/public-cctv-draft";

describe("SystemBuilderDrawer public draft handoff", () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(
      PUBLIC_CCTV_DRAFT_KEY,
      JSON.stringify({
        camera_count: 9,
        resolution_mp: 4,
        retention_days: 30,
        recording_mode: "continuous",
        codec: "h265",
      }),
    );
  });
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("passes consumed draft cameraCount into recommendCctv", async () => {
    const recommendCctv = vi.fn(async () => ({
      system_type: "cctv",
      engine_version: 1,
      status: "OK",
      blocking: false,
      input: { cameraCount: 9 },
      engineering: {},
      unresolved: [],
      components: [],
    }));
    const api = {
      recommendCctv,
      listSystemDesigns: vi.fn(async () => ({ items: [] })),
    } as unknown as ApiClient;

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SystemBuilderDrawer
          open
          onClose={() => {}}
          workspaceId="ws-free"
          quoteId={null}
          ensureQuoteId={vi.fn(async () => "q-draft")}
          api={api}
          onApply={() => {}}
        />
      </QueryClientProvider>,
    );

    await waitFor(
      () => {
        expect(recommendCctv).toHaveBeenCalled();
        const body = recommendCctv.mock.calls.at(-1)?.[1] as { camera_count?: number } | undefined;
        expect(body?.camera_count).toBe(9);
      },
      { timeout: 3000 },
    );
    expect(sessionStorage.getItem(PUBLIC_CCTV_DRAFT_KEY)).toBeNull();
  });
});