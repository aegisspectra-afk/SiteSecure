import { he } from "../i18n/he";

/** Honest empty/live marker — never present invented G1/demo as production. */
export function DataModeNote({
  mode,
  waitingDb,
}: {
  mode?: "live" | "empty" | string | null;
  waitingDb?: boolean;
}) {
  if (waitingDb) {
    return (
      <p className="rounded-md border border-border bg-bg-subtle px-3 py-2 text-xs text-fg-muted" data-testid="ssp-waiting-db">
        {he.waitingLocalDb}
      </p>
    );
  }
  if (mode === "empty") {
    return (
      <p className="text-xs text-fg-muted" data-testid="ssp-data-empty">
        {he.dataEmpty}
      </p>
    );
  }
  if (mode === "live") {
    return (
      <p className="text-xs text-fg-muted" data-testid="ssp-data-live">
        {he.dataLive}
      </p>
    );
  }
  return null;
}
