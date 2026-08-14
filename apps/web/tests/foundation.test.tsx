import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OnboardingForm } from "../src/components/OnboardingForm";
import { he } from "../src/i18n/he";
import { can } from "../src/lib/can";

describe("OnboardingForm", () => {
  it("profile step only completes the account identity", () => {
    render(
      <OnboardingForm
        profileDone={false}
        onSaveProfile={vi.fn()}
        onCreateWorkspace={vi.fn()}
        onEnter={vi.fn()}
      />,
    );
    const items = screen.getAllByRole("listitem").map((el) => el.textContent ?? "");
    expect(items).toHaveLength(4);
    expect(items[0]).toContain(he.stepAccount);
    expect(items[0]).toContain("✓");
    expect(items[1]).toContain(he.stepProfile);
    expect(items[1]).toContain("●");
    expect(items[2]).toContain(he.stepWorkspace);
    expect(items[2]).toContain("○");
    expect(items[3]).toContain(he.stepReady);
    expect(items[3]).toContain("○");
    expect(screen.getByLabelText(he.fullName)).toBeInTheDocument();
    expect(screen.queryByLabelText(he.workspaceName)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: he.profileContinue })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: he.onboardingPrimary })).not.toBeInTheDocument();
  });

  it("workspace step requires an explicit create action", () => {
    render(
      <OnboardingForm
        profileDone
        onSaveProfile={vi.fn()}
        onCreateWorkspace={vi.fn()}
        onEnter={vi.fn()}
      />,
    );
    const items = screen.getAllByRole("listitem").map((el) => el.textContent ?? "");
    expect(items[1]).toContain("✓");
    expect(items[2]).toContain("●");
    expect(items[3]).toContain("○");
    expect(screen.getByRole("button", { name: he.onboardingPrimary })).toBeInTheDocument();
    expect(screen.getByLabelText(he.workspaceName)).toBeInTheDocument();
    expect(screen.getByLabelText(he.timezone)).toHaveValue("Asia/Jerusalem");
    expect(screen.getByLabelText(he.vat)).toHaveValue(18);
    expect(screen.getByText(he.currencyValue)).toBeInTheDocument();
    expect(screen.queryByText(/לקוח/)).not.toBeInTheDocument();
    expect(screen.queryByText(/הצעת מחיר/)).not.toBeInTheDocument();
  });

  it("ready step waits for an explicit enter", () => {
    render(
      <OnboardingForm
        profileDone
        created
        onSaveProfile={vi.fn()}
        onCreateWorkspace={vi.fn()}
        onEnter={vi.fn()}
      />,
    );
    const items = screen.getAllByRole("listitem").map((el) => el.textContent ?? "");
    expect(items[2]).toContain("✓");
    expect(items[3]).toContain("●");
    expect(screen.getByRole("button", { name: he.enterWorkspace })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: he.onboardingPrimary })).not.toBeInTheDocument();
  });
});

describe("can()", () => {
  it("hides send quote for viewer and never treats UI as security", () => {
    expect(can("viewer", "quotes.send", ["quotes"])).toBe(false);
    expect(can("owner", "quotes.send", ["quotes"])).toBe(true);
    expect(can("technician", "users.invite", ["core"])).toBe(false);
  });
});
