import { describe, expect, it } from "vitest";
import { afterAuthPath, onboardingEnterPath } from "../src/lib/auth-routes";
import { homeVariant } from "../src/lib/home";
import { parseCatalogImportRows, SOLO_ONBOARDING_STEPS } from "../src/lib/onboarding-solo";
import { needsPlatformSetup } from "../src/lib/platform-setup";
import { he } from "../src/i18n/he";

describe("Site Secure public onboarding routing", () => {
  it("sends users with a workspace to Aegis Platform Home, not platform-path", () => {
    expect(afterAuthPath(true)).toBe("/platform");
    expect(afterAuthPath(false)).toBe("/onboarding");
  });

  it("does not gate owners into product setup after workspace create", () => {
    expect(needsPlatformSetup({ workspaceId: "ws-new", roleKey: "owner" })).toBe(false);
  });

  it("sends a single-user owner into Site Secure only after the 4-step setup", () => {
    expect(onboardingEnterPath()).toBe("/app/dashboard");
    expect(onboardingEnterPath()).not.toBe("/platform");
    expect(SOLO_ONBOARDING_STEPS.map((step) => step.id)).toEqual([
      "business_vat",
      "catalog",
      "first_customer",
      "first_quote",
    ]);
    expect(he.onboardingSetupLead).toContain("ארבעה צעדים");
    expect(parseCatalogImportRows("שם,מחיר\nמצלמה,120\n=CMD,1\n")).toEqual([
      { name: "מצלמה", sku: undefined, list_price: 120 },
    ]);
  });

  it("keeps technician home variant separate from owner ops", () => {
    expect(homeVariant("technician")).toBe("today");
    expect(homeVariant("owner")).toBe("ops");
  });
});
