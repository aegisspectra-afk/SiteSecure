import { describe, expect, it } from "vitest";
import { resolveForgotPasswordUrl, resolvePlatformHomeUrl } from "./public-urls";

describe("platform home URL", () => {
  it("defaults to local SITE SECURE only in development", () => {
    expect(resolvePlatformHomeUrl(undefined, true)).toBe("http://localhost:5173/platform");
    expect(resolvePlatformHomeUrl("", true)).toBe("http://localhost:5173/platform");
  });

  it("does not use localhost as a production SITE SECURE origin", () => {
    expect(resolvePlatformHomeUrl(undefined, false)).toBe("");
    expect(resolvePlatformHomeUrl("http://localhost:5173/platform", false)).toBe("");
    expect(resolvePlatformHomeUrl("http://127.0.0.1:5173/platform", false)).toBe("");
    expect(resolvePlatformHomeUrl("https://app.example.com/platform", false)).toBe(
      "https://app.example.com/platform",
    );
  });

  it("maps platform home to SITE SECURE forgot-password", () => {
    expect(resolveForgotPasswordUrl("http://localhost:5173/platform")).toBe(
      "http://localhost:5173/forgot-password",
    );
    expect(resolveForgotPasswordUrl("")).toBe("");
  });
});
