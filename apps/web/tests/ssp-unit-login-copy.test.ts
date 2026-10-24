import { describe, expect, it } from "vitest";
import { he } from "../src/i18n/he";
import {
  SSP_DEVICE_ACTIVATION_PATH,
  SSP_UNIT_LOGIN_PATH,
  sspOfficeCodeMenuItems,
  sspUnitLoginHintText,
} from "../src/lib/ssp-unit-login-copy";

describe("ssp unit-login copy and code navigation", () => {
  it("explains that unit login needs a 10-minute single-use code from the unit-codes screen", () => {
    const hint = sspUnitLoginHintText();
    expect(hint).toBe(he.sspUnitLoginHint);
    expect(hint).toContain("קוד התחברות ליחידה");
    expect(hint).toContain("10 דקות");
    expect(hint).toMatch(/חד[־-]פעמי/);
    expect(hint).toContain("קוד הפעלת מכשיר");
    expect(he.sspUnitCodesTitle).toBe("קוד התחברות ליחידה");
    expect(he.sspUnitCodeLabel).toBe("קוד התחברות ליחידה");
  });

  it("keeps device activation on /app/ssp/sites and unit login on /app/ssp/unit-codes", () => {
    const items = sspOfficeCodeMenuItems();
    expect(items).toEqual([
      { id: "unit-login", to: SSP_UNIT_LOGIN_PATH, label: "קוד התחברות ליחידה" },
      { id: "device-activation", to: SSP_DEVICE_ACTIVATION_PATH, label: "קוד הפעלת מכשיר" },
    ]);
    expect(SSP_UNIT_LOGIN_PATH).toBe("/app/ssp/unit-codes");
    expect(SSP_DEVICE_ACTIVATION_PATH).toBe("/app/ssp/sites");
    expect(he.sspQuickIssueCode).toBe("קוד הפעלת מכשיר");
    expect(he.sspIssueActivationCode).toBe("הפקת קוד הפעלת מכשיר");
    expect(items.find((item) => item.id === "device-activation")?.to).not.toBe(SSP_UNIT_LOGIN_PATH);
  });
});
