import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  it("updates saved-ago copy over time without parent rerender", () => {
    vi.useFakeTimers();
    const savedAt = Date.now() - 5_000;
    render(<QuoteSaveIndicator saveState="saved" savedAt={savedAt} dirty={false} hasLiveId />);
    expect(screen.getByText(he.cpqSavedAgo(5))).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByText(he.cpqSavedAgo(35))).toBeInTheDocument();
    vi.useRealTimers();
  });
});
