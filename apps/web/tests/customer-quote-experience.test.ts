import { describe, expect, it } from "vitest";
import { he } from "../src/i18n/he";

describe("customer quote experience copy", () => {
  it("has portal success and sign strings", () => {
    expect(he.cqxApproveCta).toContain("חתימה");
    expect(he.cqxSuccessTitle).toContain("אושרה");
    expect(he.cqxSuccessBody("Q-00012")).toContain("Q-00012");
    expect(he.cqxTermsAccept.length).toBeGreaterThan(10);
    expect(he.cqxLockedHint).toContain("ננעלה");
  });
});
