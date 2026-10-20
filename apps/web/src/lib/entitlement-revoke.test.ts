import { ApiClientError } from "@site-secure/api-client";
import { describe, expect, it } from "vitest";
import {
  isFeatureNotIncludedError,
  isProductAvailable,
  productIdForPath,
  shouldReturnToPlatformHome,
} from "./entitlement-revoke";

describe("entitlement-revoke helpers", () => {
  it("detects FEATURE_NOT_INCLUDED only", () => {
    expect(
      isFeatureNotIncludedError(new ApiClientError(403, "FEATURE_NOT_INCLUDED", "no")),
    ).toBe(true);
    expect(isFeatureNotIncludedError(new ApiClientError(403, "PERMISSION_DENIED", "no"))).toBe(
      false,
    );
    expect(isFeatureNotIncludedError(new ApiClientError(401, "UNAUTHENTICATED", "no"))).toBe(false);
    expect(isFeatureNotIncludedError(new Error("boom"))).toBe(false);
  });

  it("maps product paths and ignores platform/admin", () => {
    expect(productIdForPath("/app/ssp")).toBe("ssp");
    expect(productIdForPath("/app/ssp/forms/1")).toBe("ssp");
    expect(productIdForPath("/app/fleet")).toBe("fleet");
    expect(productIdForPath("/app/workforce")).toBe("workforce");
    expect(productIdForPath("/app/workforce/employees")).toBe("workforce");
    expect(productIdForPath("/app/today")).toBe("site_secure");
    expect(productIdForPath("/app")).toBe("site_secure");
    expect(productIdForPath("/platform")).toBeNull();
    expect(productIdForPath("/admin/users")).toBeNull();
  });

  it("evaluates product availability from features", () => {
    expect(isProductAvailable("ssp", ["ssp", "core"])).toBe(true);
    expect(isProductAvailable("ssp", ["core"])).toBe(false);
    expect(isProductAvailable("fleet", ["fleet"])).toBe(true);
    expect(isProductAvailable("workforce", ["workforce"])).toBe(true);
    expect(isProductAvailable("workforce", ["ssp"])).toBe(false);
    expect(isProductAvailable("site_secure", ["crm"])).toBe(true);
    expect(isProductAvailable("site_secure", ["ssp"])).toBe(false);
  });

  it("returns to platform only when current product is gone", () => {
    expect(shouldReturnToPlatformHome("/app/ssp", ["core"])).toBe(true);
    expect(shouldReturnToPlatformHome("/app/ssp", ["ssp"])).toBe(false);
    expect(shouldReturnToPlatformHome("/platform", [])).toBe(false);
    expect(shouldReturnToPlatformHome("/admin", [])).toBe(false);
    expect(shouldReturnToPlatformHome("/app/today", ["ssp"])).toBe(true);
    expect(shouldReturnToPlatformHome("/app/today", ["quotes"])).toBe(false);
  });
});
