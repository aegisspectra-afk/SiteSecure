import { describe, expect, it, vi } from "vitest";

describe("clearWorkspaceScopedCaches", () => {
  it("cancels in-flight queries before clearing", async () => {
    vi.resetModules();
    const { queryClient, clearWorkspaceScopedCaches } = await import("../src/lib/query-client");
    const cancel = vi.spyOn(queryClient, "cancelQueries").mockResolvedValue(undefined as never);
    const clear = vi.spyOn(queryClient, "clear");
    await clearWorkspaceScopedCaches();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(clear.mock.invocationCallOrder[0]!);
  });
});
