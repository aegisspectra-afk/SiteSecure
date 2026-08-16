import { Link } from "@tanstack/react-router";
import type { DashboardSummary, QuoteOut } from "@site-secure/api-client";
import { Input, Status, Table, TBody, TD, TH, THead, TR, Tabs } from "@site-secure/ui";
import type { ReactNode } from "react";
import { QuotePipeline } from "../dashboard/QuotePipeline";
import { he } from "../../i18n/he";
import {
  filterQuotes,
  quotesMarginTotals,
  quotesWorkspaceKpis,
  type QuoteTab,
} from "../../lib/quote-workspace";
import { quoteConversion } from "../../lib/ux-metrics";
import { formatMoney, quoteStatusLabel, quoteStatusTone } from "../../lib/quotes";

const TABS: { id: QuoteTab; label: string }[] = [
  { id: "all", label: he.quotesTabAll },
  { id: "draft", label: he.quoteStatuses.draft },
  { id: "open", label: he.quotesTabOpen },
  { id: "approved", label: he.quoteStatuses.approved },
  { id: "expired", label: he.quoteStatuses.expired },
];

export function QuotesWorkspace({
  quotes,
  summary,
  search,
  tab,
  canCreate,
  canViewCost,
  loading,
  onSearch,
  onTab,
  onOpenQuote,
}: {
  quotes: QuoteOut[];
  summary?: DashboardSummary | null;
  search: string;
  tab: QuoteTab;
  canCreate: boolean;
  canViewCost: boolean;
  loading?: boolean;
  onSearch: (value: string) => void;
  onTab: (tab: QuoteTab) => void;
  onOpenQuote: (quoteId: string) => void;
}) {
  const kpis = quotesWorkspaceKpis(summary, quotes);
  const visible = filterQuotes(quotes, tab, search);
  const hasQuotes = quotes.length > 0 || kpis.conversion.total > 0;
  const margin = canViewCost ? quotesMarginTotals(quotes) : null;
  const createCta = canCreate ? (
    <Link
      to="/app/quotes/new"
      className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {he.newQuoteAction}
    </Link>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold leading-tight text-fg">{he.quotesTitle}</h1>
          <p className="text-sm text-fg-muted">{he.quotesLead}</p>
          {hasQuotes ? (
            <p className="text-sm text-fg">{he.quotesMeta(quotes.length || kpis.conversion.total, formatMoney(kpis.openValue))}</p>
          ) : null}
        </div>
        {createCta ? <div className="shrink-0">{createCta}</div> : null}
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
            openCount={kpis.openCount}
            conversion={kpis.conversion.total >= 3 ? kpis.conversion : null}
            margin={margin}
          />
          {summary && quoteConversion(summary).total > 0 ? (
            <QuotePipeline summary={summary} linked={false} />
          ) : null}
          <div className="ops-card p-4">
            <Tabs tabs={TABS} value={tab} onChange={(id) => onTab(id as QuoteTab)} />
            <div className="mt-4 max-w-md">
              <Input
                id="quotes-search"
                label={he.quotesSearchLabel}
                value={search}
                onChange={(event) => onSearch(event.target.value)}
                placeholder={he.quotesSearchPlaceholder}
              />
            </div>
            {visible.length === 0 ? (
              <p className="mt-6 px-2 pb-4 text-sm text-fg-muted">{he.quotesFilterEmpty}</p>
            ) : (
              <div className="mt-4">
                <QuotesTable quotes={visible} onOpenQuote={onOpenQuote} />
              </div>
            )}
          </div>
        </>
      ) : null}
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
  openCount,
  conversion,
  margin,
}: {
  draft: number;
  awaiting: number;
  approved: number;
  openValue: number;
  openCount: number;
  conversion: { percent: number | null; approved: number; total: number } | null;
  margin: { amount: number; percent: number | null } | null;
}) {
  return (
    <section className="ops-card p-5" aria-label={he.quotesTitle}>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label={he.quotesKpiDraft} value={String(draft)} />
        <Kpi label={he.quotesKpiAwaiting} value={String(awaiting)} />
        <Kpi label={he.quotesKpiApproved} value={String(approved)} />
        <Kpi label={he.quotesKpiOpenValue} value={formatMoney(openValue)} hint={he.quotesKpiOpenHint(openCount)} />
      </dl>
      {conversion?.percent != null ? (
        <p className="mt-4 text-sm text-fg-muted">
          {he.uxQuoteConversion}: {he.uxPercent(conversion.percent)} · {he.uxQuoteConversionHint(conversion.approved, conversion.total)}
        </p>
      ) : null}
      {margin ? (
        <p className="mt-2 text-sm text-fg">
          {he.quotesKpiMargin}: {formatMoney(margin.amount)}
          {margin.percent != null ? ` · ${he.uxPercent(margin.percent)}` : ""}
        </p>
      ) : null}
    </section>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight text-fg">{value}</dd>
      {hint ? <p className="mt-1 text-xs text-fg-muted">{hint}</p> : null}
    </div>
  );
}

function QuotesTable({
  quotes,
  onOpenQuote,
}: {
  quotes: QuoteOut[];
  onOpenQuote: (quoteId: string) => void;
}) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>{he.quotesColNumber}</TH>
          <TH>{he.quotesColCustomer}</TH>
          <TH>{he.quotesColTitle}</TH>
          <TH>{he.quotesColTotal}</TH>
          <TH>{he.quotesColStatus}</TH>
          <TH>{he.quoteOpen}</TH>
        </TR>
      </THead>
      <TBody>
        {quotes.map((row) => (
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
            <TD className="font-medium">
              <span>{row.number}</span>
              {row.version && row.version > 1 ? (
                <span className="ms-2 text-xs text-fg-muted">{he.quotesVersion(row.version)}</span>
              ) : null}
            </TD>
            <TD>{row.customer_name?.trim() || he.quotesNoCustomer}</TD>
            <TD>{row.title?.trim() || row.project_name?.trim() || "—"}</TD>
            <TD>{formatMoney(row.total_gross, row.currency)}</TD>
            <TD>
              <Status label={quoteStatusLabel(row.status)} tone={quoteStatusTone(row.status)} />
            </TD>
            <TD>
              <Link
                to="/app/quotes/$quoteId"
                params={{ quoteId: row.id }}
                className="text-sm font-medium text-action hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {he.quoteOpen}
              </Link>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
