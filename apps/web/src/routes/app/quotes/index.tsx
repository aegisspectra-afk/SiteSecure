import { Button, EmptyState, ErrorState, PageHeader, Status, Table, TBody, TD, TH, THead, TR } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { formatDay, formatMoney, quoteStatusLabel, quoteStatusTone } from "../../../lib/quotes";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/quotes/")({
  component: QuotesPage,
});

function QuotesPage() {
  return (
    <RequirePermission permission="quotes.view">
      <QuotesBody />
    </RequirePermission>
  );
}

function QuotesBody() {
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const canCreate = can(membership?.role_key, "quotes.create", membership?.features ?? []);
  const query = useQuery({
    queryKey: ["quotes", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listQuotes(workspaceId!),
  });

  if (!workspaceId) return <ErrorState title={he.quotesError} />;
  if (query.isError) {
    return (
      <ErrorState
        title={he.quotesError}
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {he.retry}
          </Button>
        }
      />
    );
  }

  const rows = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={he.quotesTitle}
        description={he.quotesLead}
        action={
          canCreate ? (
            <Link
              to="/app/quotes/new"
              className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {he.newQuote}
            </Link>
          ) : undefined
        }
      />
      {query.isLoading ? (
        <p className="text-sm text-fg-muted">{he.loading}</p>
      ) : rows.length === 0 ? (
        <div className="ops-card">
          <EmptyState
            title={he.quotesEmpty}
            description={he.dashboardEmptyQuotes}
            action={
              canCreate ? (
                <Link
                  to="/app/quotes/new"
                  className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg"
                >
                  {he.newQuote}
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="ops-card overflow-x-auto p-2">
          <Table>
            <THead>
              <TR>
                <TH>מספר</TH>
                <TH>סטטוס</TH>
                <TH>סה״כ</TH>
                <TH>עודכן</TH>
                <TH>{he.quoteOpen}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => (
                <TR key={row.id}>
                  <TD className="font-medium">{row.number}</TD>
                  <TD>
                    <Status label={quoteStatusLabel(row.status)} tone={quoteStatusTone(row.status)} />
                  </TD>
                  <TD>{formatMoney(row.total_gross, row.currency)}</TD>
                  <TD>{formatDay(row.updated_at)}</TD>
                  <TD>
                    <Link
                      to="/app/quotes/$quoteId"
                      params={{ quoteId: row.id }}
                      className="text-sm font-medium text-action hover:underline"
                    >
                      {he.quoteOpen}
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
