import { describe, expect, it } from "vitest";
import { he } from "../i18n/he";
import { router } from "../router";

describe("WorkForce login product identity", () => {
  it("brands a workforce staffing login, not SITE SECURE security operations", () => {
    expect(he.brand).toBe("Workforce Intelligence");
    expect(he.loginKicker).toBe("WORKFORCE INTELLIGENCE");
    expect(he.loginLead).toBe("כניסה למערכת");
    expect(he.loginLead).not.toMatch(/SITE SECURE/);
    expect(he.forgotPassword).toBe("שכחתי סיסמה");
  });

  it("exposes /login and never a public /register route", () => {
    expect("/login" in router.routesByPath).toBe(true);
    expect("/" in router.routesByPath).toBe(true);
    expect("/register" in router.routesByPath).toBe(false);
  });
});
