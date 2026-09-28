import type { PublicQuote } from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { he } from "../../../i18n/he";
import { formatMoney, quoteStatusLabel } from "../../../lib/quotes";
import { useSession } from "../../../lib/session";
import { QuoteDocument } from "../document/QuoteDocument";

/**
 * Staff revision timeline + read-only historical document from quote_versions.snapshot.
 * Does not mutate snapshots or live quote_items.
 */
export function RevisionHistoryPanel({
  workspaceId,
  quoteId,
  currentVersion,
  currentStatus,
}: {
  workspaceId: string;
  quoteId: string;
  currentVersion: number;
  currentStatus?: string | null;
}) {
  const { api } = useSession();
  const [viewVersion, setViewVersion] = useState<number | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const versions = useQuery({
    queryKey: ["quote-versions", workspaceId, quoteId],
    queryFn: () => api.listQuoteVersions(workspaceId, quoteId),
    enabled: Boolean(quoteId),
  });

  const historical = useQuery({
    queryKey: ["quote-version-document", workspaceId, quoteId, viewVersion],
    queryFn: () => api.getQuoteVersionDocument(workspaceId, quoteId, viewVersion!),
    enabled: Boolean(quoteId) && viewVersion != null && viewVersion >= 1,
  });

  const items = versions.data?.items ?? [];
  const liveVersion = versions.data?.current_version ?? currentVersion;
  const liveStatus = versions.data?.current_status ?? currentStatus;
  const hasLiveDraftRow = !items.some((row) => row.version === liveVersion);

  async function downloadVersionPdf(version: number) {
    setPdfBusy(true);
    setPdfError(null);
    try {
      const { blob, filename } = await api.downloadQuoteVersionPdf(workspaceId, quoteId, version);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `quote-v${version}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setPdfError(he.cpqHistoricalPdfFailed);
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <section className="ops-card flex flex-col gap-3 p-5">
      <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{he.cpqVersionTimeline}</p>
      <p className="text-sm text-fg-muted">{he.cpqRevisionTimelineLead}</p>

      <ul className="flex flex-col gap-2 text-sm">
        {versions.isLoading ? <li className="text-fg-muted">{he.loading}</li> : null}
        {items.map((row) => {
          const isCurrent = row.version === liveVersion;
          const statusLabel = row.snapshot_status
            ? quoteStatusLabel(String(row.snapshot_status))
            : he.cpqHistoricalSent;
          return (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 first:border-0 first:pt-0"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">
                  {he.quotesVersion(row.version)}
                  {isCurrent ? (
                    <span className="ms-2 text-xs font-normal text-fg-muted">{he.cpqRevisionCurrent}</span>
                  ) : (
                    <span className="ms-2 text-xs font-normal text-fg-muted">{he.cpqRevisionHistorical}</span>
                  )}
                </span>
                <span className="text-xs text-fg-muted">
                  {statusLabel}
                  {row.total_gross != null ? ` · ${formatMoney(row.total_gross, "ILS")}` : ""}
                  {row.created_at
                    ? ` · ${new Date(row.created_at).toLocaleString("he-IL")}`
                    : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-9 px-2 text-xs"
                  onClick={() => setViewVersion(row.version)}
                >
                  {he.cpqViewHistorical}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-9 px-2 text-xs"
                  disabled={pdfBusy}
                  onClick={() => void downloadVersionPdf(row.version)}
                >
                  {he.cpqDownloadHistoricalPdf}
                </Button>
              </div>
            </li>
          );
        })}
        {hasLiveDraftRow ? (
          <li className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">
                {he.quotesVersion(liveVersion)}
                <span className="ms-2 text-xs font-normal text-fg-muted">{he.cpqRevisionCurrent}</span>
              </span>
              <span className="text-xs text-fg-muted">
                {quoteStatusLabel(String(liveStatus || "draft"))}
              </span>
            </div>
            <span className="text-xs text-fg-subtle">{he.cpqRevisionLiveDraftHint}</span>
          </li>
        ) : null}
        {!versions.isLoading && !items.length && !hasLiveDraftRow ? (
          <li className="text-fg-subtle">{he.cpqRevisionNoSnapshots}</li>
        ) : null}
        {!versions.isLoading && !items.length && hasLiveDraftRow ? (
          <li className="text-xs text-fg-subtle">{he.cpqRevisionNoSnapshotsYet}</li>
        ) : null}
      </ul>

      {pdfError ? <p className="text-sm text-danger">{pdfError}</p> : null}

      {viewVersion != null ? (
        <HistoricalDocumentSheet
          version={viewVersion}
          document={historical.data}
          loading={historical.isLoading}
          error={historical.isError}
          onClose={() => setViewVersion(null)}
          onDownload={() => void downloadVersionPdf(viewVersion)}
          pdfBusy={pdfBusy}
        />
      ) : null}
    </section>
  );
}

function HistoricalDocumentSheet({
  version,
  document,
  loading,
  error,
  onClose,
  onDownload,
  pdfBusy,
}: {
  version: number;
  document?: PublicQuote;
  loading: boolean;
  error: boolean;
  onClose: () => void;
  onDownload: () => void;
  pdfBusy: boolean;
}) {
  return (
    <div
      className="cpq-historical-sheet fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={he.cpqHistoricalDocumentTitle(version)}
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium">{he.cpqHistoricalDocumentTitle(version)}</p>
            <p className="text-xs text-fg-muted">{he.cpqHistoricalReadOnly}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={pdfBusy} onClick={onDownload}>
              {he.cpqDownloadHistoricalPdf}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              {he.feedbackClose}
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {loading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
          {error ? <p className="text-sm text-fg-muted">{he.cpqHistoricalLoadFailed}</p> : null}
          {document ? <QuoteDocument quote={document} showStatus /> : null}
        </div>
      </div>
    </div>
  );
}
