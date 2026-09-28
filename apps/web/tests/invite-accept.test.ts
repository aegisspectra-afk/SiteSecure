import { describe, expect, it } from "vitest";
import { afterAuthPath, resolveAuthDestination, sanitizeNextPath, withNextParam } from "../src/lib/auth-routes";

describe("invite next redirect", () => {
  it("allows invite deep links only", () => {
    expect(sanitizeNextPath("/invite/abcDEF1234567890_xyz")).toBe("/invite/abcDEF1234567890_xyz");
    expect(sanitizeNextPath("/portal/invite/abcDEF1234567890_xyz")).toBe("/portal/invite/abcDEF1234567890_xyz");
    expect(sanitizeNextPath("/portal")).toBeNull();
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

  it("sends portal-only users to the portal and keeps staff onboarding", () => {
    expect(resolveAuthDestination({ hasWorkspace: false, hasPortal: true })).toBe("/portal");
    expect(resolveAuthDestination({ hasWorkspace: true, hasPortal: false })).toBe("/app");
    expect(resolveAuthDestination({ hasWorkspace: true, hasPortal: true })).toBe("/portal/choose");
    expect(resolveAuthDestination({ hasWorkspace: false, hasPortal: false })).toBe("/onboarding");
    expect(
      resolveAuthDestination({
        hasWorkspace: false,
        hasPortal: true,
        next: "/portal/invite/abcDEF1234567890_xyz",
      }),
    ).toBe("/portal/invite/abcDEF1234567890_xyz");
  });

  it("builds login/register with next", () => {
    expect(withNextParam("/login", "/invite/abcDEF1234567890_xyz")).toContain("next=");
    expect(withNextParam("/login", "/app")).toBe("/login");
  });
});
