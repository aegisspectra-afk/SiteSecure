import type { QuoteListCounts, QuoteOut } from "@site-secure/api-client";
import {
  Button,
  Checkbox,
  Dropdown,
  DropdownItem,
  Input,
  Modal,
  Status,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Tabs,
} from "@site-secure/ui";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { he } from "../../i18n/he";
import { NewQuoteButton } from "./NewQuoteButton";
import {
  filterQuotes,
  pipelineTabForStatus,
  quoteDraftGap,
  quoteIsArchivable,
  quoteIsDeletable,
  quotesMarginTotals,
  quotesWorkspaceKpis,
  type QuoteTab,
} from "../../lib/quote-workspace";
import { formatMoney, formatRelativeDay, quoteStatusLabel, quoteStatusTone } from "../../lib/quotes";
import { DashboardMoney } from "../dashboard/DashboardMoney";

const TABS: { id: QuoteTab; label: string }[] = [
  { id: "all", label: he.quotesTabAll },
  { id: "draft", label: he.quoteStatuses.draft },
  { id: "open", label: he.quotesTabOpen },
  { id: "approved", label: he.quotesTabApproved },
  { id: "rejected", label: he.quotesTabRejected },
  { id: "expired", label: he.quoteStatuses.expired },
  { id: "archived", label: he.quotesTabArchive },
];

function draftGapLabel(gap: ReturnType<typeof quoteDraftGap>): string | null {
  if (gap === "empty") return he.quotesDraftEmpty;
  if (gap === "no_customer") return he.quotesDraftMissingCustomer;
  if (gap === "no_items") return he.quotesDraftNoItems;
  return null;
}

export function QuotesWorkspace({
  quotes,
  counts = null,
  search,
  tab,
  canCreate,
  canDelete = false,
  canViewCost,
  loading,
  busy = false,
  hasMore = false,
  onSearch,
  onTab,
  onOpenQuote,
  onPreviewQuote,
  onLoadMore,
  onDelete,
  onArchive,
  onRestore,
  onDuplicate,
  canExport = false,
  onExport,
}: {
  quotes: QuoteOut[];
  counts?: QuoteListCounts | null;
  search: string;
  tab: QuoteTab;
  canCreate: boolean;
  canDelete?: boolean;
  canViewCost: boolean;
  loading?: boolean;
  busy?: boolean;
  hasMore?: boolean;
  onSearch: (value: string) => void;
  onTab: (tab: QuoteTab) => void;
  onOpenQuote: (quoteId: string) => void;
  onPreviewQuote?: (quoteId: string) => void;
  onLoadMore?: () => void;
  onDelete?: (quoteIds: string[]) => Promise<void>;
  onArchive?: (quoteIds: string[]) => Promise<void>;
  onRestore?: (quoteIds: string[]) => Promise<void>;
  onDuplicate?: (quoteIds: string[]) => Promise<void>;
  canExport?: boolean;
  onExport?: () => Promise<void>;
}) {
  const kpis = quotesWorkspaceKpis(counts, quotes);
  const visible = filterQuotes(quotes, tab, search);
  const hasQuotes = quotes.length > 0 || kpis.total > 0;
  const margin = canViewCost ? quotesMarginTotals(quotes) : null;
  const canSelect = canDelete || Boolean(onDuplicate) || Boolean(onArchive) || Boolean(onRestore);
  const [selected, setSelected] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const [pendingArchive, setPendingArchive] = useState<string[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedRows = visible.filter((row) => selectedSet.has(row.id));
  const deleteIds =
    pendingDelete ??
    selectedRows.filter((row) => quoteIsDeletable(row.status, row.archived_at)).map((row) => row.id);
  const archiveIds =
    pendingArchive ??
    selectedRows.filter((row) => quoteIsArchivable(row.status, row.archived_at)).map((row) => row.id);
  const restoreIds = selectedRows.filter((row) => Boolean(row.archived_at)).map((row) => row.id);
  const blockedCount = pendingDelete
    ? pendingDelete.filter((id) => {
        const row = quotes.find((quote) => quote.id === id);
        return row ? !quoteIsDeletable(row.status, row.archived_at) : false;
      }).length
    : selectedRows.length - deleteIds.length;
  const deleteIsDraftOnly =
    deleteIds.length === 1 && quotes.find((row) => row.id === deleteIds[0])?.status === "draft";

  useEffect(() => {
    setSelected([]);
    setPendingDelete(null);
    setPendingArchive(null);
    setActionError(null);
  }, [tab, search]);

  useEffect(() => {
    const ids = new Set(quotes.map((row) => row.id));
    setSelected((prev) => {
      const next = prev.filter((id) => ids.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [quotes]);

  useEffect(() => {
    if (!selected.length) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.length]);

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((rowId) => rowId !== id);
    });
  }

  function toggleVisible(checked: boolean) {
    const visibleIds = visible.map((row) => row.id);
    setSelected((prev) => {
      if (!checked) return prev.filter((id) => !visibleIds.includes(id));
      const merged = new Set(prev);
      for (const id of visibleIds) merged.add(id);
      return [...merged];
    });
  }

  const createCta = canCreate ? <NewQuoteButton /> : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="public-mono text-[10px] tracking-[0.16em] text-fg-subtle">{he.cpqWorkspaceKicker}</p>
          <h1 className="text-2xl font-semibold leading-tight text-fg">{he.quotesTitle}</h1>
          <p className="text-sm text-fg-muted">{he.quotesLead}</p>
          {hasQuotes ? (
            <p className="text-sm text-fg">{he.quotesMeta(kpis.total || quotes.length, kpis.awaiting, kpis.approved)}</p>
          ) : null}
        </div>
        {(canExport && onExport) || createCta ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canExport && onExport ? (
              <Button
                type="button"
                variant="secondary"
                data-testid="quotes-export"
                aria-label={he.exportCsvQuotes}
                disabled={busy || exportBusy}
                loading={exportBusy}
                onClick={() => {
                  setActionError(null);
                  setExportBusy(true);
                  void onExport()
                    .catch(() => setActionError(he.exportCsvError))
                    .finally(() => setExportBusy(false));
                }}
              >
                {he.exportCsv}
              </Button>
            ) : null}
            {createCta}
          </div>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}

      {!loading && !hasQuotes ? <QuotesEmptyState action={createCta} /> : null}

      {!loading && hasQuotes ? (
        <>
          <QuotesKpiStrip
            draft={kpis.draft}
            awaiting={kpis.awaiting}
            approved={kpis.approved}
            openValue={kpis.openValue}
            conversion={kpis.conversion}
            margin={margin}
          />
          <QuotePipelineStrip
            draft={kpis.draft}
            sent={kpis.sent}
            viewed={kpis.viewed}
            approved={kpis.approved}
            rejected={kpis.rejected}
            tab={tab}
            onTab={onTab}
          />
          <div className="ops-card p-4">
            <div className="flex flex-col gap-4">
              <Tabs tabs={TABS} value={tab} onChange={(id) => onTab(id as QuoteTab)} />
              <div className="max-w-lg">
                <Input
                  id="quotes-search"
                  label={he.quotesSearchLabel}
                  value={search}
                  onChange={(event) => onSearch(event.target.value)}
                  placeholder={he.quotesSearchPlaceholder}
                />
              </div>
            </div>
            {tab === "archived" ? (
              <p className="mt-3 px-2 text-sm text-fg-muted">{he.quotesArchiveLead}</p>
            ) : null}
            {visible.length === 0 ? (
              <p className="mt-6 px-2 pb-4 text-sm text-fg-muted">
                {tab === "archived" ? he.quotesArchiveEmpty : he.quotesFilterEmpty}
              </p>
            ) : (
              <div className="mt-4">
                {canSelect && selected.length > 0 ? (
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border border-border bg-bg-subtle px-3 py-2">
                    <p className="me-auto text-sm text-fg">{he.quotesSelectedCount(selected.length)}</p>
                    {onDuplicate ? (
                      <Button
                        variant="secondary"
                        disabled={busy || selected.length === 0}
                        loading={busy}
                        onClick={() => {
                          setActionError(null);
                          void onDuplicate(selected)
                            .then(() => setSelected([]))
                            .catch(() => setActionError(he.quotesDuplicateError));
                        }}
                      >
                        {he.quotesDuplicate}
                      </Button>
                    ) : null}
                    {canDelete && onArchive && archiveIds.length ? (
                      <Button variant="secondary" disabled={busy} onClick={() => setPendingArchive(archiveIds)}>
                        {he.quotesArchive}
                      </Button>
                    ) : null}
                    {canDelete && onRestore && restoreIds.length ? (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        loading={busy}
                        onClick={() => {
                          setActionError(null);
                          void onRestore(restoreIds)
                            .then(() => setSelected([]))
                            .catch(() => setActionError(he.quotesRestoreError));
                        }}
                      >
                        {he.quotesRestore}
                      </Button>
                    ) : null}
                    {canDelete && onDelete && deleteIds.length ? (
                      <Button variant="danger" disabled={busy} onClick={() => setPendingDelete(deleteIds)}>
                        {he.quotesDelete}
                      </Button>
                    ) : null}
                    <Button variant="ghost" disabled={busy} onClick={() => setSelected([])}>
                      {he.quotesClearSelection}
                    </Button>
                  </div>
                ) : null}
                {actionError ? <p className="mb-3 text-sm text-danger">{actionError}</p> : null}
                <QuotesTable
                  quotes={visible}
                  canSelect={canSelect}
                  canCreate={canCreate}
                  canDelete={canDelete}
                  selected={selectedSet}
                  onToggle={toggleRow}
                  onToggleAll={toggleVisible}
                  onOpenQuote={onOpenQuote}
                  onPreviewQuote={onPreviewQuote}
                  onDuplicate={onDuplicate}
                  onDeleteRow={canDelete && onDelete ? (id) => setPendingDelete([id]) : undefined}
                  onArchiveRow={canDelete && onArchive ? (id) => setPendingArchive([id]) : undefined}
                  onRestoreRow={
                    canDelete && onRestore
                      ? (id) => {
                          setActionError(null);
                          void onRestore([id]).catch(() => setActionError(he.quotesRestoreError));
                        }
                      : undefined
                  }
                />
                {hasMore && onLoadMore ? (
                  <div className="mt-4 flex justify-center">
                    <Button variant="secondary" loading={busy} onClick={onLoadMore}>
                      {he.quotesLoadMore}
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </>
      ) : null}
      <Modal open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} title={he.quotesDeleteTitle}>
        <p className="text-sm text-fg">{deleteIsDraftOnly ? he.quotesDeleteDraftBody : he.quotesDeleteBody}</p>
        {blockedCount > 0 ? <p className="mt-3 text-sm text-fg-muted">{he.quotesDeleteApprovedNote}</p> : null}
        {!deleteIds.length ? <p className="mt-3 text-sm text-danger">{he.quotesDeleteNoneAllowed}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => setPendingDelete(null)}>
            {he.quotesCancel}
          </Button>
          <Button
            variant="danger"
            disabled={busy || !deleteIds.length}
            loading={busy}
            onClick={() => {
              if (!onDelete || !deleteIds.length) return;
              setActionError(null);
              void onDelete(deleteIds)
                .then(() => {
                  setPendingDelete(null);
                  setSelected([]);
                })
                .catch((err: unknown) => {
                  const code = err instanceof Error ? err.message : "";
                  setActionError(code === "delete-blocked" ? he.quotesDeleteApprovedNote : he.quotesDeleteError);
                });
            }}
          >
            {he.quotesDeleteConfirm}
          </Button>
        </div>
      </Modal>
      <Modal open={Boolean(pendingArchive)} onClose={() => setPendingArchive(null)} title={he.quotesArchiveTitle}>
        <p className="text-sm text-fg">{he.quotesArchiveBody}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => setPendingArchive(null)}>
            {he.quotesCancel}
          </Button>
          <Button
            variant="primary"
            disabled={busy || !archiveIds.length}
            loading={busy}
            onClick={() => {
              if (!onArchive || !archiveIds.length) return;
              setActionError(null);
              void onArchive(archiveIds)
                .then(() => {
                  setPendingArchive(null);
                  setSelected([]);
                })
                .catch(() => setActionError(he.quotesArchiveError));
            }}
          >
            {he.quotesArchiveConfirm}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function QuotesEmptyState({ action }: { action: ReactNode }) {
  const steps = [
    { kicker: he.quotesFlowCreateKicker, label: he.quotesFlowCreate },
    { kicker: he.quotesFlowPriceKicker, label: he.quotesFlowPrice },
    { kicker: he.quotesFlowTrackKicker, label: he.quotesFlowTrack },
  ];
  return (
    <section className="ops-card px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-fg">{he.quotesEmpty}</h2>
      <p className="mt-2 text-sm font-medium text-fg">{he.quotesEmptyLead}</p>
      <p className="mx-auto mt-2 max-w-lg text-sm text-fg-muted">{he.quotesEmptyBody}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
      <ul className="mx-auto mt-10 flex max-w-xl flex-col gap-4 sm:flex-row sm:justify-center sm:gap-8">
        {steps.map((step) => (
          <li key={step.kicker} className="text-center">
            <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{step.kicker}</p>
            <p className="mt-1 text-sm text-fg">{step.label}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QuotesKpiStrip({
  draft,
  awaiting,
  approved,
  openValue,
  conversion,
  margin,
}: {
  draft: number;
  awaiting: number;
  approved: number;
  openValue: number;
  conversion: { percent: number | null; approved: number; total: number };
  margin: { amount: number; percent: number | null } | null;
}) {
  return (
    <section className="ops-card px-5 py-4" aria-label={he.quotesTitle}>
      <dl className="quotes-kpi-metrics">
        <Kpi label={he.quotesKpiDraft} value={String(draft)} />
        <Kpi label={he.quotesKpiAwaiting} value={String(awaiting)} />
        <Kpi label={he.quotesKpiApproved} value={String(approved)} />
        <Kpi label={he.quotesKpiOpenValue} value={openValue} money />
      </dl>
      {conversion.percent != null ? (
        <p className="mt-3 text-sm text-fg-muted">
          {he.uxQuoteConversion}: {he.uxPercent(conversion.percent)} · {he.uxQuoteConversionHint(conversion.approved, conversion.total)}
        </p>
      ) : conversion.total > 0 && conversion.approved === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">{he.quotesNoneApproved}</p>
      ) : null}
      {margin ? (
        <p className="mt-2 text-sm text-fg-muted">
          {he.quotesKpiMargin}: {formatMoney(margin.amount)}
          {margin.percent != null ? ` · ${he.uxPercent(margin.percent)}` : ""}
        </p>
      ) : null}
    </section>
  );
}

function Kpi({ label, value, money = false }: { label: string; value: string | number; money?: boolean }) {
  return (
    <div className="quotes-kpi-card min-w-0">
      <dt className="text-xs text-fg-muted whitespace-nowrap">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tracking-tight text-fg min-w-0">
        {money && typeof value === "number" ? <DashboardMoney value={value} /> : value}
      </dd>
    </div>
  );
}

function QuotePipelineStrip({
  draft,
  sent,
  viewed,
  approved,
  rejected,
  tab,
  onTab,
}: {
  draft: number;
  sent: number;
  viewed: number;
  approved: number;
  rejected: number;
  tab: QuoteTab;
  onTab: (tab: QuoteTab) => void;
}) {
  const stages = [
    { status: "draft", count: draft },
    { status: "sent", count: sent },
    { status: "viewed", count: viewed },
    { status: "approved", count: approved },
    { status: "rejected", count: rejected },
  ] as const;
  return (
    <section className="ops-card px-5 py-3" aria-labelledby="quote-pipeline-heading">
      <h2 id="quote-pipeline-heading" className="text-sm font-medium text-fg">
        {he.quotePipelineTitle}
      </h2>
      <ol className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
        {stages.map((stage, index) => {
          const nextTab = pipelineTabForStatus(stage.status);
          const active = nextTab === tab;
          return (
            <li key={stage.status} className="flex items-center gap-1">
              {index > 0 ? (
                <span className="px-1 text-fg-muted" aria-hidden>
                  →
                </span>
              ) : null}
              <button
                type="button"
                className={`rounded-[var(--radius-control)] px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  active ? "bg-bg-subtle font-semibold text-fg" : "text-fg hover:bg-bg-subtle"
                }`}
                onClick={() => nextTab && onTab(nextTab)}
              >
                {he.quoteStatuses[stage.status]} {stage.count}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function QuotesTable({
  quotes,
  canSelect,
  canCreate,
  canDelete,
  selected,
  onToggle,
  onToggleAll,
  onOpenQuote,
  onPreviewQuote,
  onDuplicate,
  onDeleteRow,
  onArchiveRow,
  onRestoreRow,
}: {
  quotes: QuoteOut[];
  canSelect: boolean;
  canCreate: boolean;
  canDelete: boolean;
  selected: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onOpenQuote: (quoteId: string) => void;
  onPreviewQuote?: (quoteId: string) => void;
  onDuplicate?: (quoteIds: string[]) => Promise<void>;
  onDeleteRow?: (quoteId: string) => void;
  onArchiveRow?: (quoteId: string) => void;
  onRestoreRow?: (quoteId: string) => void;
}) {
  const selectedCount = quotes.filter((row) => selected.has(row.id)).length;
  const allVisibleSelected = quotes.length > 0 && selectedCount === quotes.length;
  const showMenu = canCreate || canDelete || Boolean(onPreviewQuote);
  return (
    <Table>
      <THead>
        <TR>
          {canSelect ? (
            <TH className="w-10">
              <SelectAllCheckbox
                checked={allVisibleSelected}
                indeterminate={selectedCount > 0 && !allVisibleSelected}
                onChange={onToggleAll}
              />
            </TH>
          ) : null}
          <TH>{he.quotesColNumber}</TH>
          <TH>{he.quotesColCustomer}</TH>
          <TH className="hidden md:table-cell">{he.quotesColProject}</TH>
          <TH>{he.quotesColTotal}</TH>
          <TH>{he.quotesColStatus}</TH>
          <TH className="hidden sm:table-cell">{he.quotesColUpdated}</TH>
          {showMenu ? <TH className="w-12"><span className="sr-only">{he.quotesRowMenu}</span></TH> : null}
        </TR>
      </THead>
      <TBody>
        {quotes.map((row) => {
          const gap = quoteDraftGap(row);
          const gapText = draftGapLabel(gap);
          const customer =
            row.customer_name?.trim() ||
            (row.status === "draft" ? he.quotesDraftNoCustomer : he.quotesNoCustomer);
          const project = row.site_name?.trim() || row.project_name?.trim() || "—";
          const quoteName = row.title?.trim();
          return (
            <TR
              key={row.id}
              className="cursor-pointer hover:bg-bg-subtle"
              onClick={() => onOpenQuote(row.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenQuote(row.id);
                }
              }}
              tabIndex={0}
            >
              {canSelect ? (
                <TD
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <Checkbox
                    hideLabel
                    label={he.quotesSelectRow(row.number)}
                    checked={selected.has(row.id)}
                    onChange={(event) => onToggle(row.id, event.target.checked)}
                  />
                </TD>
              ) : null}
              <TD className="font-medium">
                <span>{row.number}</span>
                {row.version && row.version > 1 ? (
                  <span className="ms-2 text-xs text-fg-muted">{he.quotesVersion(row.version)}</span>
                ) : null}
                {quoteName ? (
                  <span className="block max-w-[16rem] truncate text-xs font-normal text-fg-muted" data-testid="quote-row-name">
                    {quoteName}
                  </span>
                ) : null}
              </TD>
              <TD>
                <span className={row.customer_name?.trim() ? undefined : "text-fg-muted"}>{customer}</span>
              </TD>
              <TD className="hidden md:table-cell">{project}</TD>
              <TD>{formatMoney(row.total_gross, row.currency)}</TD>
              <TD>
                <div className="flex flex-col gap-0.5">
                  <Status
                    label={quoteStatusLabel(row.status, row.archived_at)}
                    tone={quoteStatusTone(row.status, row.archived_at)}
                  />
                  {gapText && !row.archived_at ? <span className="text-xs text-fg-muted">{gapText}</span> : null}
                </div>
              </TD>
              <TD className="hidden text-fg-muted sm:table-cell">{formatRelativeDay(row.updated_at)}</TD>
              {showMenu ? (
                <TD
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <Dropdown label="⋯" menuLabel={he.quotesRowMenu}>
                    <DropdownItem onClick={() => onOpenQuote(row.id)}>{he.quoteOpen}</DropdownItem>
                    {onPreviewQuote ? (
                      <DropdownItem onClick={() => onPreviewQuote(row.id)}>{he.quotePreview}</DropdownItem>
                    ) : null}
                    {onDuplicate ? (
                      <DropdownItem onClick={() => void onDuplicate([row.id])}>{he.quotesDuplicate}</DropdownItem>
                    ) : null}
                    {onArchiveRow && quoteIsArchivable(row.status, row.archived_at) ? (
                      <DropdownItem onClick={() => onArchiveRow(row.id)}>{he.quotesArchive}</DropdownItem>
                    ) : null}
                    {onRestoreRow && row.archived_at ? (
                      <DropdownItem onClick={() => onRestoreRow(row.id)}>{he.quotesRestore}</DropdownItem>
                    ) : null}
                    {onDeleteRow && quoteIsDeletable(row.status, row.archived_at) ? (
                      <DropdownItem onClick={() => onDeleteRow(row.id)}>{he.quotesDelete}</DropdownItem>
                    ) : null}
                  </Dropdown>
                </TD>
              ) : null}
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center">
      <input
        ref={ref}
        type="checkbox"
        className="size-4 rounded-[3px] border-border text-action focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        checked={checked}
        aria-label={he.quotesSelectAll}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
