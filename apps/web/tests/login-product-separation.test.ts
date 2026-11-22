import { describe, expect, it } from "vitest";
import { he as ssp } from "../../ssp/src/i18n/he";
import { he as workforce } from "../../WorkForce/src/i18n/he";
import { he } from "../src/i18n/he";
import { afterAuthPath, guestEntryPath } from "../src/lib/auth-routes";

describe("separate product login screens", () => {
  it("keeps SITE SECURE login copy on security operations", () => {
    expect(he.loginLead).toBe("התחברות ל־SITE SECURE");
    expect(he.loginDescription).toMatch(/מערכות אבטחה ושירות/);
    expect(he.loginLead).not.toBe(workforce.loginLead);
    expect(he.loginDescription).not.toBe(workforce.loginDescription);
  });

  it("keeps WorkForce login copy on staffing, shifts and rest", () => {
    expect(workforce.loginLead).toBe("כניסה למערכת");
    expect(workforce.forgotPassword).toBe("שכחתי סיסמה");
    expect(workforce.loginLead).not.toBe(ssp.loginTitle);
  });

  it("leaves public SITE SECURE registration and post-login routing unchanged", () => {
    expect(guestEntryPath()).toBe("/login");
    expect(afterAuthPath(true)).toBe("/app");
    expect(afterAuthPath(false)).toBe("/onboarding");
    expect(he.registerTitle).toBe("צרו את החשבון שלכם");
    expect(he.registerLead).toMatch(/SITE SECURE/);
    expect(he.loginSecondaryRegister).toBeTruthy();
  });
});
