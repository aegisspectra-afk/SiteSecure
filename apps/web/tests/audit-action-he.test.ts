import { describe, expect, it } from "vitest";
import { he } from "../src/i18n/he";
import { auditActionLabel, auditResultLabel } from "../src/lib/audit-action-he";

describe("audit action Hebrew labels", () => {
  it("maps known SITE SECURE actions and results", () => {
    expect(auditActionLabel("quotes.send")).toBe("שליחת הצעת מחיר");
    expect(auditActionLabel("quotes.margin_override")).toBe("חריגת מרווח בהצעה");
    expect(auditResultLabel("success")).toBe("הצליחה");
    expect(auditResultLabel("denied")).toBe("נדחתה");
  });

  it("never surfaces raw English keys in the UI", () => {
    expect(auditActionLabel("quotes.send")).not.toMatch(/[A-Za-z]/);
    expect(auditActionLabel("not.a.real.action")).toBe(he.auditActionUnknown);
    expect(auditActionLabel("not.a.real.action")).not.toContain("not.a.real.action");
    expect(auditResultLabel("weird_code")).toBe(he.auditResultOther);
  });
});
