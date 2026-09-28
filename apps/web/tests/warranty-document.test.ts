import { describe, expect, it } from "vitest";
import {
  addDuration,
  composeWarrantySections,
  deriveWarrantyStatus,
  emptyWarrantyPolicy,
  rewriteWarrantySection,
  warrantySuggestions,
} from "../src/lib/warranty-document";

describe("warranty document", () => {
  it("calculates the end date from a duration", () => {
    expect(addDuration("2026-09-12", 12, "months")).toBe("2027-09-12");
  });

  it("derives active, expiring and expired from dates", () => {
    expect(deriveWarrantyStatus("2026-01-01", "2026-12-31", new Date("2026-09-01"))).toBe("active");
    expect(deriveWarrantyStatus("2026-01-01", "2026-09-20", new Date("2026-09-01"))).toBe("expiring_soon");
    expect(deriveWarrantyStatus("2026-01-01", "2026-08-01", new Date("2026-09-01"))).toBe("expired");
  });

  it("turns selected exclusions into a professional clause", () => {
    const policy = emptyWarrantyPolicy();
    policy.exclusions = ["drop"];
    policy.subject_label = "תיקון מסך";
    const sections = composeWarrantySections({
      policy,
      customerName: "דניאל כהן",
      businessName: "סייט סקיור",
      startsOn: "2026-09-12",
      endsOn: "2027-09-12",
    });
    const exclusion = sections.find((section) => section.id === "exclusions");
    expect(exclusion?.source).toContain("נפילה");
    expect(exclusion?.body).toContain("נפילה");
    expect(exclusion?.body).not.toBe(exclusion?.source);
  });

  it("recommends missing shipping and turnaround without blocking", () => {
    const suggestions = warrantySuggestions(emptyWarrantyPolicy());
    expect(suggestions.some((item) => item.id === "shipping")).toBe(true);
    expect(suggestions.some((item) => item.id === "turnaround")).toBe(true);
  });

  it("applies a free-text rewrite onto the chosen section", () => {
    const next = rewriteWarrantySection(
      { id: "terms", heading: "תנאים", source: "משלוח", body: "העסק מטפל בפנייה." },
      "custom",
      "הלקוח משלם על המשלוח",
    );
    expect(next.body).toContain("הלקוח משלם על המשלוח");
  });
});
