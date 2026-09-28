import { describe, expect, it } from "vitest";
import { he } from "../src/i18n/he";
import { render, screen } from "@testing-library/react";
import { QuoteSaveIndicator } from "../src/components/quotes/workspace/QuoteSaveIndicator";

/**
 * Quote-level save semantics: Saving / Saved / Save failed.
 * Line-level “saved” flash is intentionally removed — one trustworthy status.
 */
describe("quote save-state consistency", () => {
  it("shows Saving while any persist is in flight", () => {
    render(
      <QuoteSaveIndicator saveState="saving" savedAt={Date.now()} dirty={false} hasLiveId />,
    );
    expect(screen.getByText(he.cpqSaving)).toBeInTheDocument();
  });

  it("shows Save failed and never Saved when saveState is error", () => {
    render(
      <QuoteSaveIndicator saveState="error" savedAt={Date.now()} dirty={false} hasLiveId />,
    );
    expect(screen.getByText(he.quoteSaveError)).toBeInTheDocument();
    expect(screen.queryByText(he.cpqSavedJustNow)).not.toBeInTheDocument();
  });

  it("prefers Saving over dirty while a request is in flight", () => {
    render(
      <QuoteSaveIndicator saveState="saving" savedAt={null} dirty hasLiveId />,
    );
    expect(screen.getByText(he.cpqSaving)).toBeInTheDocument();
  });

  it("shows unsaved changes when dirty and idle", () => {
    render(
      <QuoteSaveIndicator saveState="saved" savedAt={Date.now()} dirty hasLiveId />,
    );
    expect(screen.getByText(he.cpqUnsavedChanges)).toBeInTheDocument();
  });
});
