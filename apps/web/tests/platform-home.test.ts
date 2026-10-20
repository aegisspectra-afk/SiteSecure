import { describe, expect, it } from "vitest";
import { afterAuthPath } from "../src/lib/auth-routes";
import { homeVariant } from "../src/lib/home";
import { he } from "../src/i18n/he";

describe("Aegis Platform Home routing", () => {
  it("lands on /platform after auth when a workspace exists", () => {
    expect(afterAuthPath(true)).toBe("/platform");
  });

  it("keeps onboarding when no workspace", () => {
    expect(afterAuthPath(false)).toBe("/onboarding");
  });

  it("preserves invite deep-link next over platform home", () => {
    expect(afterAuthPath(true, "/invite/abcdefghijklmnop")).toBe("/invite/abcdefghijklmnop");
  });

  it("maps Site Secure entry via homeVariant", () => {
    expect(homeVariant("technician")).toBe("today");
    expect(homeVariant("owner")).toBe("ops");
    expect(homeVariant("administrator")).toBe("ops");
  });

  it("exposes empty-state copy for users with no products", () => {
    expect(he.platformHomeEmptyTitle.length).toBeGreaterThan(0);
    expect(he.platformHomeEmptyBody).toContain("מנהל");
  });
});
