import { describe, expect, it } from "vitest";
import { WORKFORCE_AUTH_STORAGE_KEY, workforceAuthClientOptions } from "./supabase";

describe("WorkForce auth client options", () => {
  it("does not double-parse hash handoff tokens", () => {
    const options = workforceAuthClientOptions();
    expect(options.detectSessionInUrl).toBe(false);
    expect(options.storageKey).toBe(WORKFORCE_AUTH_STORAGE_KEY);
    expect(options.storageKey).not.toBe("sb-auth-token");
    expect(options.autoRefreshToken).toBe(true);
  });
});
