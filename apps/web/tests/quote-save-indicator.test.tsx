import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuoteSaveIndicator } from "../src/components/quotes/workspace/QuoteSaveIndicator";
import { he } from "../src/i18n/he";

describe("QuoteSaveIndicator", () => {
  it("shows saving and error states truthfully", () => {
    const { rerender } = render(
      <QuoteSaveIndicator saveState="saving" savedAt={Date.now()} dirty={false} hasLiveId />,
    );
    expect(screen.getByText(he.cpqSaving)).toBeInTheDocument();

    rerender(<QuoteSaveIndicator saveState="error" savedAt={Date.now()} dirty={false} hasLiveId />);
    expect(screen.getByText(he.quoteSaveError)).toBeInTheDocument();
  });

  it("shows the clock time of the last save (Q1: 'נשמר · 23:58')", () => {
    const savedAt = new Date(2026, 10, 14, 23, 58).getTime();
    render(<QuoteSaveIndicator saveState="saved" savedAt={savedAt} dirty={false} hasLiveId />);
    expect(screen.getByText(he.cpqSavedAt("23:58"))).toBeInTheDocument();
  });
});
