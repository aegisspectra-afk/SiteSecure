import { memo, useMemo } from "react";
import { he } from "../../../i18n/he";

/** 24-hour local time of the last save, e.g. "23:58". */
export function formatSavedTime(at: number): string {
  return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
}

export const QuoteSaveIndicator = memo(function QuoteSaveIndicator({
  saveState,
  savedAt,
  dirty,
  hasLiveId,
}: {
  saveState: "saved" | "saving" | "error" | "local";
  savedAt: number | null;
  dirty: boolean;
  hasLiveId: boolean;
}) {
  const label = useMemo(() => {
    if (saveState === "saving") return he.cpqSaving;
    if (saveState === "error") return he.quoteSaveError;
    // The status chip already says "טיוטה"; this line only talks about saving.
    if (!hasLiveId) return he.cpqAutosavePending;
    if (dirty) return he.cpqUnsavedChanges;
    if (savedAt) return he.cpqSavedAt(formatSavedTime(savedAt));
    return he.cpqSavedJustNow;
  }, [dirty, hasLiveId, saveState, savedAt]);

  const dotState = saveState === "error" ? "error" : dirty ? "dirty" : saveState;

  return (
    <p className="cpq-save-state cpq-save-state-inline" aria-live="polite" data-testid="quote-save-indicator">
      <span className={`cpq-save-dot is-${dotState}`} />
      {label}
    </p>
  );
});
