import { Button } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { he } from "../../../i18n/he";
import { formatMoney } from "../../../lib/quotes";
import { useSession } from "../../../lib/session";

export function RevisionComparePanel({
  workspaceId,
  quoteId,
  currentVersion,
}: {
  workspaceId: string;
  quoteId: string;
  currentVersion: number;
}) {
  const { api } = useSession();
  const fromVersion = Math.max(1, currentVersion - 1);
  const compare = useQuery({
    queryKey: ["quote-compare", workspaceId, quoteId, fromVersion, currentVersion],
    queryFn: () => api.compareQuoteVersions(workspaceId, quoteId, fromVersion, currentVersion),
    enabled: Boolean(quoteId) && currentVersion > 1,
  });

  if (currentVersion <= 1) return null;

  return (
    <section className="ops-card flex flex-col gap-3 p-5">
      <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{he.cpqRevisionCompare}</p>
      {compare.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      {compare.data ? (
        <>
          <p className="text-sm text-fg-muted">
            {he.cpqRevisionRange(fromVersion, compare.data.to_version)}
          </p>
          <div className="flex justify-between gap-3 text-sm">
            <span>{he.cpqTotalFrom}</span>
            <span>{formatMoney(compare.data.total_from, "ILS")}</span>
          </div>
          <div className="flex justify-between gap-3 text-sm font-medium">
            <span>{he.cpqTotalTo}</span>
            <span>{formatMoney(compare.data.total_to, "ILS")}</span>
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {compare.data.changes.slice(0, 12).map((change) => (
              <li key={`${change.change}-${change.key}`} className="border-t border-border/60 pt-2">
                <span className="text-fg-muted">{changeLabel(change.change)} · </span>
                {change.key || "—"}
              </li>
            ))}
            {!compare.data.changes.length ? (
              <li className="text-fg-subtle">{he.cpqRevisionNoChanges}</li>
            ) : null}
          </ul>
        </>
      ) : null}
      {compare.isError ? (
        <p className="text-sm text-fg-muted">{he.cpqRevisionCompareUnavailable}</p>
      ) : null}
      <Button
        variant="ghost"
        onClick={() => compare.refetch()}
        disabled={compare.isFetching}
      >
        {he.cpqRefreshCompare}
      </Button>
    </section>
  );
}

function changeLabel(change: string) {
  if (change === "added") return he.cpqChangeAdded;
  if (change === "removed") return he.cpqChangeRemoved;
  return he.cpqChangeModified;
}
