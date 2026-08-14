import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OnboardingForm } from "../src/components/OnboardingForm";
import { he } from "../src/i18n/he";
import { can } from "../src/lib/can";

describe("OnboardingForm", () => {
  it("primary action is צור סביבת עבודה", () => {
    render(<OnboardingForm profileDone onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: he.onboardingPrimary })).toBeInTheDocument();
  });

  it("does not check upcoming CRM steps", () => {
    render(<OnboardingForm profileDone onSubmit={vi.fn()} />);
    const items = screen.getAllByRole("listitem").map((el) => el.textContent ?? "");
    const customer = items.find((t) => t.includes(he.stepCustomer));
    expect(customer).toContain("○");
    expect(customer).not.toContain("✓");
    expect(customer).toContain(he.laterStep);
  });
});

describe("can()", () => {
  it("hides send quote for viewer and never treats UI as security", () => {
    expect(can("viewer", "quotes.send", ["quotes"])).toBe(false);
    expect(can("owner", "quotes.send", ["quotes"])).toBe(true);
    expect(can("technician", "users.invite", ["core"])).toBe(false);
  });
});
