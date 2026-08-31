import { memo, useEffect, useMemo, useState } from "react";
import { he } from "../../../i18n/he";

const SAVED_AGO_TICK_MS = 30_000;

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
  const [tick, setTick] = useState(0);

  const showSavedAgo = saveState === "saved" && hasLiveId && !dirty && savedAt != null;

  useEffect(() => {
    if (!showSavedAgo) return;
    const id = window.setInterval(() => setTick((value) => value + 1), SAVED_AGO_TICK_MS);
    return () => window.clearInterval(id);
  }, [showSavedAgo, savedAt]);

  const label = useMemo(() => {
    if (saveState === "saving") return he.cpqSaving;
    if (saveState === "error") return he.quoteSaveError;
    if (!hasLiveId) return he.quoteUnsaved;
    if (dirty) return he.cpqUnsavedChanges;
    if (savedAt) {
      return he.cpqSavedAgo(Math.max(0, Math.round((Date.now() - savedAt) / 1000)));
    }
    return he.cpqSavedJustNow;
  }, [dirty, hasLiveId, saveState, savedAt, tick]);

  const dotState = saveState === "error" ? "error" : dirty ? "dirty" : saveState;

  return (
    <p className="cpq-save-state cpq-save-state-inline" aria-live="polite">
      <span className={`cpq-save-dot is-${dotState}`} />
      {label}
    </p>
  );
});
