import { describe, expect, it } from "vitest";
import { afterAuthPath, sanitizeNextPath, withNextParam } from "../src/lib/auth-routes";

describe("invite next redirect", () => {
  it("allows invite deep links only", () => {
    expect(sanitizeNextPath("/invite/abcDEF1234567890_xyz")).toBe("/invite/abcDEF1234567890_xyz");
    expect(sanitizeNextPath("/app/dashboard")).toBeNull();
    expect(sanitizeNextPath("https://evil.example/invite/abc")).toBeNull();
    expect(sanitizeNextPath("//evil/invite/abcDEF1234567890")).toBeNull();
    expect(sanitizeNextPath("/invite/short")).toBeNull();
  });

  it("preserves invite path after auth", () => {
    expect(afterAuthPath(false, "/invite/abcDEF1234567890_xyz")).toBe("/invite/abcDEF1234567890_xyz");
    expect(afterAuthPath(true)).toBe("/app");
    expect(afterAuthPath(false)).toBe("/onboarding");
  });

  it("builds login/register with next", () => {
    expect(withNextParam("/login", "/invite/abcDEF1234567890_xyz")).toContain("next=");
    expect(withNextParam("/login", "/app")).toBe("/login");
  });
});
