import { ApiClientError } from "@site-secure/api-client";
import { describe, expect, it } from "vitest";
import { queryClient, shouldRetryQuery } from "../src/lib/query-client";

describe("DEMO-3.5 'לא נמצא' shows at once", () => {
  it("never retries 404 / 403 / 400", () => {
    for (const status of [400, 401, 403, 404, 409, 422]) {
      expect(shouldRetryQuery(0, new ApiClientError(status, "X", "x"))).toBe(false);
    }
  });

  it("still retries network / server errors and 429, up to 3 times", () => {
    expect(shouldRetryQuery(0, new ApiClientError(503, "API_UNAVAILABLE", "x"))).toBe(true);
    expect(shouldRetryQuery(0, new ApiClientError(429, "RATE", "x"))).toBe(true);
    expect(shouldRetryQuery(0, new TypeError("fetch failed"))).toBe(true);
    expect(shouldRetryQuery(3, new ApiClientError(500, "X", "x"))).toBe(false);
  });

  it("is the app's default", () => {
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(shouldRetryQuery);
  });
});
