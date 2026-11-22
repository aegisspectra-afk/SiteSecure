import { describe, expect, it } from "vitest";
import { he } from "../src/i18n/he";

describe("settings billing copy (C3)", () => {
  it("upgrade form is honest beta intake", () => {
    expect(he.settingsBillingUpgradeTitle).toContain("נחזור אליך");
    expect(he.settingsBillingUpgradeHint).toMatch(/אין חיוב/);
    expect(he.settingsNavBilling).toBeTruthy();
  });
});