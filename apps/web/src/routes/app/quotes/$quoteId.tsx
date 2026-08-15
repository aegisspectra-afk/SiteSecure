import { Button, ErrorState, Input, PageHeader, Status, Table, TBody, TD, TH, THead, TR } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { ApiClientError } from "@site-secure/api-client";
import { can } from "../../../lib/can";
import { formatMoney, quoteStatusLabel, quoteStatusTone } from "../../../lib/quotes";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/quotes/$quoteId")({
  component: QuoteDetailPage,
});

function QuoteDetailPage() {
  return (
    <RequirePermission permission="quotes.view">
      <QuoteDetailBody />
    </RequirePermission>
  );
}

function QuoteDetailBody() {
  const { quoteId } = Route.useParams();
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const queryClient = useQueryClient();
  const canEdit = can(membership?.role_key, "quotes.edit", membership?.features ?? []);
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("0");
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["quote", workspaceId, quoteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getQuote(workspaceId!, quoteId),
  });

  const addItem = useMutation({
    mutationFn: () =>
      api.addQuoteItem(workspaceId!, quoteId, {
        description: description.trim(),
        qty: Number(qty),
        unit_price: Number(price),
      }),
    onSuccess: () => {
      setDescription("");
      setQty("1");
      setPrice("0");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["quote", workspaceId, quoteId] });
      void queryClient.invalidateQueries({ queryKey: ["quotes", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : he.quotesError);
    },
  });

  if (!workspaceId) return <ErrorState title={he.quotesError} />;
  if (query.isError || (!query.isLoading && !query.data)) {
    return (
      <ErrorState
        title={he.quotesError}
        action={
          <Link to="/app/quotes" className="text-sm font-medium text-action">
            {he.quotesTitle}
          </Link>
        }
      />
    );
  }

  const quote = query.data;
  const items = quote?.items ?? [];

  function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!description.trim()) return;
    addItem.mutate();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={quote?.number ? `${he.quoteDetailTitle} ${quote.number}` : he.quoteDetailTitle}
        description={quote ? quoteStatusLabel(quote.status) : undefined}
      />
      {quote ? (
        <section className="ops-card p-5">
          <Status label={quoteStatusLabel(quote.status)} tone={quoteStatusTone(quote.status)} />
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-fg-muted">{he.quoteTotal}</dt>
              <dd className="mt-1 text-lg font-semibold">{formatMoney(quote.total_gross, quote.currency)}</dd>
            </div>
          </dl>
        </section>
      ) : null}
      <section className="ops-card overflow-x-auto p-2">
        <Table>
          <THead>
            <TR>
              <TH>{he.quoteItemDescription}</TH>
              <TH>{he.quoteQty}</TH>
              <TH>{he.quoteUnitPrice}</TH>
              <TH>{he.quoteTotal}</TH>
            </TR>
          </THead>
          <TBody>
            {items.map((item) => (
              <TR key={item.id}>
                <TD>{item.description}</TD>
                <TD>{item.qty}</TD>
                <TD>{formatMoney(item.unit_price, quote?.currency)}</TD>
                <TD>{formatMoney(item.line_net, quote?.currency)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {items.length === 0 ? <p className="p-4 text-sm text-fg-muted">{he.quotesEmpty}</p> : null}
      </section>
      {canEdit ? (
        <form className="ops-card flex flex-col gap-3 p-5 sm:flex-row sm:items-end" onSubmit={onAdd}>
          <Input
            id="item-desc"
            label={he.quoteItemDescription}
            value={description}
            onChange={(ev) => setDescription(ev.target.value)}
            className="sm:flex-1"
          />
          <Input id="item-qty" label={he.quoteQty} value={qty} onChange={(ev) => setQty(ev.target.value)} className="sm:w-24" />
          <Input
            id="item-price"
            label={he.quoteUnitPrice}
            value={price}
            onChange={(ev) => setPrice(ev.target.value)}
            className="sm:w-32"
          />
          <Button type="submit" loading={addItem.isPending}>
            {he.quoteAddItem}
          </Button>
          {formError ? <p className="text-sm text-danger sm:col-span-full">{formError}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
