import { Button, Input, Select, Textarea } from "@site-secure/ui";
import { ApiClientError, type QuoteGap, type QuoteOut, type QuotePatchBody } from "@site-secure/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import {
  goToQuoteField,
  headerFromQuote,
  headerPatch,
  headersEqual,
  parseNonNegative,
  type QuoteHeaderDraft,
} from "../../lib/quote-builder";
import { formatMoney } from "../../lib/quotes";
import { useSession } from "../../lib/session";

const HISTORY_LIMIT = 40;

type Props = {
  quote: QuoteOut;
  workspaceId: string;
  roleKey?: string;
  features: string[];
};

export function QuoteBuilder({ quote, workspaceId, roleKey, features }: Props) {
  const { api } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit = can(roleKey, "quotes.edit", features) && quote.status === "draft";
  const canSend = can(roleKey, "quotes.send", features);
  const canCreate = can(roleKey, "quotes.create", features);
  const canViewCost = can(roleKey, "quotes.view_cost", features);
  const canCrm = can(roleKey, "crm.view", features);
  const canCrmCreate = can(roleKey, "crm.create", features);
  const canSites = can(roleKey, "sites.view", features);
  const canSitesCreate = can(roleKey, "sites.create", features);
  const canCatalog = can(roleKey, "catalog.view", features);

  const [draft, setDraft] = useState<QuoteHeaderDraft>(() => headerFromQuote(quote));
  const [history, setHistory] = useState<QuoteHeaderDraft[]>([headerFromQuote(quote)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [formError, setFormError] = useState<string | null>(null);
  const [gaps, setGaps] = useState<QuoteGap[]>(quote.validation?.gaps ?? []);
  const [publicUrl, setPublicUrl] = useState(quote.public_url ?? "");
  const [copied, setCopied] = useState(false);
  const [catalogQ, setCatalogQ] = useState("");
  const [newCustomer, setNewCustomer] = useState({ display_name: "", email: "" });
  const [newSite, setNewSite] = useState({ name: "", address: "" });
  const skipHistory = useRef(false);
  const quoteRef = useRef(quote);
  quoteRef.current = quote;

  useEffect(() => {
    const next = headerFromQuote(quote);
    setDraft(next);
    setHistory([next]);
    setHistoryIndex(0);
    setGaps(quote.validation?.gaps ?? []);
    if (quote.public_url) setPublicUrl(quote.public_url);
  }, [quote.id, quote.status, quote.version]);

  const customersQuery = useQuery({
    queryKey: ["cpq-customers", workspaceId],
    enabled: canCrm,
    queryFn: () => api.listCustomers(workspaceId, { limit: 100 }),
  });
  const sitesQuery = useQuery({
    queryKey: ["cpq-sites", workspaceId, draft.customer_id],
    enabled: canSites && Boolean(draft.customer_id),
    queryFn: () => api.listSites(workspaceId, { customer_id: draft.customer_id, limit: 100 }),
  });
  const catalogQuery = useQuery({
    queryKey: ["cpq-catalog", workspaceId, catalogQ],
    enabled: canCatalog,
    queryFn: () => api.listCatalogProducts(workspaceId, { q: catalogQ, limit: 20 }),
  });
  const templatesQuery = useQuery({
    queryKey: ["cpq-templates", workspaceId],
    enabled: canCatalog,
    queryFn: () => api.listQuoteTemplates(workspaceId),
  });
  const workspaceQuery = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => api.getWorkspace(workspaceId),
  });

  function pushHistory(next: QuoteHeaderDraft) {
    if (skipHistory.current) return;
    setHistory((prev) => {
      const clipped = prev.slice(0, historyIndex + 1);
      const last = clipped[clipped.length - 1];
      if (last && headersEqual(last, next)) return clipped;
      const rows = [...clipped, next].slice(-HISTORY_LIMIT);
      setHistoryIndex(rows.length - 1);
      return rows;
    });
  }

  function updateDraft(patch: Partial<QuoteHeaderDraft>) {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      pushHistory(next);
      return next;
    });
  }

  const save = useMutation({
    mutationFn: (body: QuotePatchBody) => api.patchQuote(workspaceId, quote.id, body),
    onMutate: () => setSaveState("saving"),
    onSuccess: (row) => {
      setSaveState("saved");
      setGaps(row.validation?.gaps ?? []);
      void queryClient.setQueryData(["quote", workspaceId, quote.id], row);
    },
    onError: (err) => {
      setSaveState("error");
      setFormError(err instanceof ApiClientError ? err.message : he.quoteSaveError);
    },
  });

  const saveRef = useRef(save);
  saveRef.current = save;

  const baseline = headerFromQuote(quoteRef.current);
  const dirty = !headersEqual(draft, baseline);

  useEffect(() => {
    if (!canEdit || !dirty) return;
    const timer = window.setTimeout(() => {
      saveRef.current.mutate(headerPatch(draft));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [draft, canEdit, dirty]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (canEdit && dirty) save.mutate(headerPatch(draft));
      }
      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        if (historyIndex <= 0) return;
        skipHistory.current = true;
        const next = history[historyIndex - 1];
        setHistoryIndex(historyIndex - 1);
        setDraft(next);
        skipHistory.current = false;
      }
      if ((event.key.toLowerCase() === "z" && event.shiftKey) || event.key.toLowerCase() === "y") {
        event.preventDefault();
        if (historyIndex >= history.length - 1) return;
        skipHistory.current = true;
        const next = history[historyIndex + 1];
        setHistoryIndex(historyIndex + 1);
        setDraft(next);
        skipHistory.current = false;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit, dirty, draft, history, historyIndex, save]);

  const invalidate = (row?: QuoteOut) => {
    if (row) void queryClient.setQueryData(["quote", workspaceId, quote.id], row);
    void queryClient.invalidateQueries({ queryKey: ["quote", workspaceId, quote.id] });
    void queryClient.invalidateQueries({ queryKey: ["quotes", workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
  };

  const addItem = useMutation({
    mutationFn: (body: Parameters<typeof api.addQuoteItem>[2]) => api.addQuoteItem(workspaceId, quote.id, body),
    onSuccess: (row) => {
      setGaps(row.validation?.gaps ?? []);
      invalidate(row);
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.quotesError),
  });
  const patchItem = useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: { qty?: number; unit_price?: number; discount?: number; description?: string } }) =>
      api.patchQuoteItem(workspaceId, quote.id, itemId, body),
    onSuccess: (row) => invalidate(row),
  });
  const deleteItem = useMutation({
    mutationFn: (itemId: string) => api.deleteQuoteItem(workspaceId, quote.id, itemId),
    onSuccess: (row) => invalidate(row),
  });
  const applyTemplate = useMutation({
    mutationFn: (templateId: string) => api.applyQuoteTemplate(workspaceId, quote.id, { template_id: templateId }),
    onSuccess: (row) => {
      setGaps(row.validation?.gaps ?? []);
      invalidate(row);
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.quotesError),
  });
  const send = useMutation({
    mutationFn: () => api.sendQuote(workspaceId, quote.id),
    onSuccess: (row) => {
      setGaps([]);
      setPublicUrl(row.public_url ?? "");
      invalidate(row);
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.code === "QUOTE_INCOMPLETE") {
        const next = (err.details.gaps as QuoteGap[] | undefined) ?? [];
        setGaps(next);
        setFormError(he.quoteSendBlocked);
        return;
      }
      setFormError(err instanceof ApiClientError ? err.message : he.quotesError);
    },
  });
  const revise = useMutation({
    mutationFn: () => api.reviseQuote(workspaceId, quote.id),
    onSuccess: (row) => invalidate(row),
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.quotesError),
  });
  const share = useMutation({
    mutationFn: () => api.shareQuote(workspaceId, quote.id),
    onSuccess: async (row) => {
      setPublicUrl(row.public_url);
      await navigator.clipboard.writeText(row.public_url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    },
  });

  const items = quote.items ?? [];
  const currency = quote.currency ?? "ILS";
  const liveGaps = gaps.length ? gaps : quote.validation?.gaps ?? [];
  const canSendNow = canSend && quote.status === "draft" && liveGaps.length === 0;
  const companyName = workspaceQuery.data?.name ?? "";

  const selectedCustomer = useMemo(
    () => customersQuery.data?.items.find((row) => row.id === draft.customer_id),
    [customersQuery.data, draft.customer_id],
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex flex-col gap-5">
        <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border bg-bg/95 px-3 py-3 backdrop-blur">
          <p className="text-xs text-fg-muted" aria-live="polite">
            {saveState === "saving" ? he.quoteSaving : saveState === "error" ? he.quoteSaveError : he.quoteSaved}
            {quote.version ? ` · ${he.quotesVersion(quote.version)}` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" disabled={historyIndex <= 0} onClick={() => {
              if (historyIndex <= 0) return;
              skipHistory.current = true;
              setDraft(history[historyIndex - 1]);
              setHistoryIndex(historyIndex - 1);
              skipHistory.current = false;
            }}>
              {he.quoteUndo}
            </Button>
            <Button variant="ghost" disabled={historyIndex >= history.length - 1} onClick={() => {
              if (historyIndex >= history.length - 1) return;
              skipHistory.current = true;
              setDraft(history[historyIndex + 1]);
              setHistoryIndex(historyIndex + 1);
              skipHistory.current = false;
            }}>
              {he.quoteRedo}
            </Button>
            {quote.status === "draft" ? (
              <Button
                variant="secondary"
                loading={save.isPending}
                onClick={async () => {
                  if (canEdit && dirty) {
                    try {
                      await save.mutateAsync(headerPatch(draft));
                    } catch (err) {
                      setFormError(err instanceof ApiClientError ? err.message : he.quoteSaveError);
                      return;
                    }
                  }
                  void navigate({ to: "/app/quotes/$quoteId/preview", params: { quoteId: quote.id } });
                }}
              >
                {he.quotePreview}
              </Button>
            ) : null}
            {quote.status === "draft" && canSend ? (
              <Button disabled={!canSendNow} loading={send.isPending} onClick={() => send.mutate()}>
                {he.quoteSend}
              </Button>
            ) : null}
            {quote.status !== "draft" && quote.status !== "cancelled" && canCreate ? (
              <Button variant="secondary" loading={revise.isPending} onClick={() => revise.mutate()}>
                {he.quoteRevise}
              </Button>
            ) : null}
            {(quote.status === "sent" || quote.status === "viewed") && canSend ? (
              <Button variant="secondary" loading={share.isPending} onClick={() => share.mutate()}>
                {copied ? he.quoteCopyLink : he.quoteShare}
              </Button>
            ) : null}
          </div>
        </div>

        {quote.status !== "draft" ? <p className="text-sm text-fg-muted">{he.quoteLocked}</p> : null}
        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
        {liveGaps.length ? (
          <section className="ops-card flex flex-col gap-2 p-4">
            <p className="text-sm font-medium">{he.quoteSendBlocked}</p>
            {liveGaps.map((gap) => (
              <div key={`${gap.field}-${gap.code}`} className="flex items-center justify-between gap-3 text-sm">
                <span>{gap.message}</span>
                <Button variant="ghost" onClick={() => goToQuoteField(gap.field)}>
                  {he.quoteGoToField}
                </Button>
              </div>
            ))}
          </section>
        ) : null}
        {publicUrl ? (
          <p className="text-sm">
            <a className="text-action" href={publicUrl} target="_blank" rel="noreferrer">
              {publicUrl}
            </a>
          </p>
        ) : null}

        <section className="ops-card flex flex-col gap-4 p-5">
          <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{he.quoteSectionDetails}</p>
          <p id="quote-company" tabIndex={-1} className="text-sm text-fg-muted">
            {companyName || he.quotePublicCompany}
          </p>
          {canCrm ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                id="customer_id"
                label={he.quoteCustomer}
                value={draft.customer_id}
                disabled={!canEdit}
                onChange={(ev) => updateDraft({ customer_id: ev.target.value, site_id: "" })}
              >
                <option value="">{he.quoteCustomerPlaceholder}</option>
                {(customersQuery.data?.items ?? []).map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.display_name}
                  </option>
                ))}
              </Select>
              <Select
                id="site_id"
                label={he.quoteSite}
                value={draft.site_id}
                disabled={!canEdit || !draft.customer_id || !canSites}
                onChange={(ev) => {
                  const site = sitesQuery.data?.items.find((row) => row.id === ev.target.value);
                  const address = site?.address as { line?: string; formatted?: string } | undefined;
                  updateDraft({
                    site_id: ev.target.value,
                    project_name: site?.name || draft.project_name,
                    project_address: address?.line || address?.formatted || draft.project_address,
                  });
                }}
              >
                <option value="">{he.quoteSitePlaceholder}</option>
                {(sitesQuery.data?.items ?? []).map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          {canEdit && canCrmCreate ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Input id="new-customer-name" label={he.quoteCustomerName} value={newCustomer.display_name} onChange={(ev) => setNewCustomer((p) => ({ ...p, display_name: ev.target.value }))} />
              <Input id="new-customer-email" label={he.quoteCustomerEmail} value={newCustomer.email} onChange={(ev) => setNewCustomer((p) => ({ ...p, email: ev.target.value }))} />
              <Button
                variant="secondary"
                disabled={!newCustomer.display_name.trim()}
                onClick={async () => {
                  const created = await api.createCustomer(workspaceId, {
                    display_name: newCustomer.display_name.trim(),
                    email: newCustomer.email.trim() || undefined,
                  });
                  setNewCustomer({ display_name: "", email: "" });
                  updateDraft({ customer_id: created.id, site_id: "" });
                  void queryClient.invalidateQueries({ queryKey: ["cpq-customers", workspaceId] });
                }}
              >
                {he.quoteCustomerCreate}
              </Button>
            </div>
          ) : null}
          {canEdit && canSitesCreate && draft.customer_id ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Input id="new-site-name" label={he.quoteSiteName} value={newSite.name} onChange={(ev) => setNewSite((p) => ({ ...p, name: ev.target.value }))} />
              <Input id="new-site-address" label={he.quoteSiteAddress} value={newSite.address} onChange={(ev) => setNewSite((p) => ({ ...p, address: ev.target.value }))} />
              <Button
                variant="secondary"
                disabled={!newSite.name.trim()}
                onClick={async () => {
                  const created = await api.createSite(workspaceId, {
                    customer_id: draft.customer_id,
                    name: newSite.name.trim(),
                    address: newSite.address.trim() ? { line: newSite.address.trim() } : undefined,
                  });
                  setNewSite({ name: "", address: "" });
                  updateDraft({
                    site_id: created.id,
                    project_name: created.name,
                    project_address: newSite.address.trim() || draft.project_address,
                  });
                  void queryClient.invalidateQueries({ queryKey: ["cpq-sites", workspaceId, draft.customer_id] });
                }}
              >
                {he.quoteSiteCreate}
              </Button>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="title" label={he.quoteTitle} value={draft.title} disabled={!canEdit} onChange={(ev) => updateDraft({ title: ev.target.value })} />
            <Input id="valid_until" label={he.quoteValidUntil} type="date" value={draft.valid_until} disabled={!canEdit} onChange={(ev) => updateDraft({ valid_until: ev.target.value })} />
            <Input id="project_name" label={he.quoteProjectName} value={draft.project_name} disabled={!canEdit} onChange={(ev) => updateDraft({ project_name: ev.target.value })} />
            <Input id="project_address" label={he.quoteProjectAddress} value={draft.project_address} disabled={!canEdit} onChange={(ev) => updateDraft({ project_address: ev.target.value })} />
          </div>
          <Textarea id="summary" label={he.quoteSummary} value={draft.summary} disabled={!canEdit} onChange={(ev) => updateDraft({ summary: ev.target.value })} />
          <Textarea id="key_points" label={he.quoteKeyPoints} value={draft.key_points} disabled={!canEdit} onChange={(ev) => updateDraft({ key_points: ev.target.value })} />
          {canCatalog ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Select id="template_id" label={he.quoteTemplate} value={draft.template_id} disabled={!canEdit} onChange={(ev) => updateDraft({ template_id: ev.target.value })}>
                  <option value="">{he.quoteTemplateNone}</option>
                  {(templatesQuery.data?.items ?? []).map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name_he}
                    </option>
                  ))}
                </Select>
              </div>
              {canEdit ? (
                <Button
                  variant="secondary"
                  disabled={!draft.template_id}
                  loading={applyTemplate.isPending}
                  onClick={() => applyTemplate.mutate(draft.template_id)}
                >
                  {he.quoteApplyTemplate}
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>

        <section id="quote-items" tabIndex={-1} className="ops-card flex flex-col gap-4 p-5">
          <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{he.quoteSectionItems}</p>
          {items.length === 0 ? <p className="text-sm text-fg-muted">{he.quoteItemsEmpty}</p> : null}
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <div key={`${item.id}-${item.qty}-${item.unit_price}-${item.discount}-${item.description}`} className="grid gap-2 rounded-[var(--radius-control)] border border-border p-3 sm:grid-cols-[1fr_5rem_7rem_6rem_auto]">
                <Input
                  id={`item-desc-${item.id}`}
                  label={he.quoteItemDescription}
                  defaultValue={item.description}
                  disabled={!canEdit}
                  onBlur={(ev) => {
                    if (ev.target.value !== item.description) {
                      patchItem.mutate({ itemId: item.id, body: { description: ev.target.value } });
                    }
                  }}
                />
                <Input
                  id={`item-qty-${item.id}`}
                  label={he.quoteQty}
                  defaultValue={String(item.qty)}
                  disabled={!canEdit || item.item_type === "note"}
                  onBlur={(ev) => patchItem.mutate({ itemId: item.id, body: { qty: parseNonNegative(ev.target.value) } })}
                />
                <Input
                  id={`item-price-${item.id}`}
                  label={he.quoteUnitPrice}
                  defaultValue={String(item.unit_price)}
                  disabled={!canEdit || item.item_type === "note"}
                  onBlur={(ev) => patchItem.mutate({ itemId: item.id, body: { unit_price: parseNonNegative(ev.target.value) } })}
                />
                <Input
                  id={`item-disc-${item.id}`}
                  label={he.quoteLineDiscount}
                  defaultValue={String(item.discount ?? 0)}
                  disabled={!canEdit || item.item_type === "note"}
                  onBlur={(ev) => patchItem.mutate({ itemId: item.id, body: { discount: parseNonNegative(ev.target.value) } })}
                />
                <div className="flex items-end justify-between gap-2">
                  <p className="text-sm font-medium">{formatMoney(item.line_net, currency)}</p>
                  {canEdit ? (
                    <Button variant="ghost" onClick={() => deleteItem.mutate(item.id)}>
                      {he.quoteDeleteItem}
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => addItem.mutate({ item_type: "labor", description: he.quoteKindService, qty: 1, unit_price: 0 })}>
                {he.quoteAddService}
              </Button>
              <Button variant="secondary" onClick={() => addItem.mutate({ item_type: "free", description: "", qty: 1, unit_price: 0 })}>
                {he.quoteAddFree}
              </Button>
              <Button variant="secondary" onClick={() => addItem.mutate({ item_type: "note", description: "", qty: 0, unit_price: 0 })}>
                {he.quoteAddNote}
              </Button>
            </div>
          ) : null}
          {canEdit && canCatalog ? (
            <div className="flex flex-col gap-2">
              <Input id="catalog-search" label={he.quoteCatalogSearch} value={catalogQ} onChange={(ev) => setCatalogQ(ev.target.value)} />
              {(catalogQuery.data?.items ?? []).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="flex items-center justify-between rounded-[var(--radius-control)] border border-border px-3 py-2 text-start text-sm hover:bg-bg-subtle"
                  onClick={() => addItem.mutate({ product_id: product.id, item_type: product.item_type || "catalog" })}
                >
                  <span>{product.name} {product.sku ? `· ${product.sku}` : ""}</span>
                  <span>{formatMoney(product.selling_price ?? product.list_price, currency)}</span>
                </button>
              ))}
              {catalogQ && (catalogQuery.data?.items ?? []).length === 0 ? (
                <p className="text-sm text-fg-muted">{he.quoteCatalogEmpty}</p>
              ) : null}
              {canCatalog ? (
                <Link to="/app/catalog" className="text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                  {he.navCatalog}
                </Link>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="ops-card flex flex-col gap-4 p-5">
          <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{he.quoteSectionTerms}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select id="discount_type" label={he.quoteDiscountType} value={draft.discount_type} disabled={!canEdit} onChange={(ev) => updateDraft({ discount_type: ev.target.value })}>
              <option value="">{he.quoteTemplateNone}</option>
              <option value="percent">{he.quoteDiscountPercent}</option>
              <option value="amount">{he.quoteDiscountAmount}</option>
            </Select>
            <Input id="discount_value" label={he.quoteDiscount} value={draft.discount_value} disabled={!canEdit} onChange={(ev) => updateDraft({ discount_value: ev.target.value })} />
          </div>
          <Textarea id="payment_terms" label={he.quotePaymentTerms} value={draft.payment_terms} disabled={!canEdit} onChange={(ev) => updateDraft({ payment_terms: ev.target.value })} />
          <Textarea id="warranty" label={he.quoteWarranty} value={draft.warranty} disabled={!canEdit} onChange={(ev) => updateDraft({ warranty: ev.target.value })} />
          <Textarea id="general_terms" label={he.quoteGeneralTerms} value={draft.general_terms} disabled={!canEdit} onChange={(ev) => updateDraft({ general_terms: ev.target.value })} />
          <Textarea id="customer_notes" label={he.quoteCustomerNotes} value={draft.customer_notes} disabled={!canEdit} onChange={(ev) => updateDraft({ customer_notes: ev.target.value })} />
          <Textarea id="internal_notes" label={he.quoteInternalNotes} value={draft.internal_notes} disabled={!canEdit} onChange={(ev) => updateDraft({ internal_notes: ev.target.value })} />
        </section>
      </div>

      <aside className="ops-card sticky top-4 flex h-fit flex-col gap-3 p-5">
        <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{he.quoteSectionPricing}</p>
        <PriceLine label={he.quoteSubtotal} value={formatMoney(quote.subtotal_net, currency)} />
        <PriceLine label={he.quoteDiscount} value={draft.discount_value ? draft.discount_value : "—"} />
        <PriceLine label={he.quoteTax} value={formatMoney(quote.vat_amount, currency)} />
        <PriceLine label={he.quoteTotal} value={formatMoney(quote.total_gross, currency)} strong />
        {canViewCost ? (
          <>
            <PriceLine label={he.quoteCost} value={formatMoney(quote.cost_total, currency)} />
            <PriceLine label={he.quoteGrossProfit} value={formatMoney(quote.margin_amount, currency)} />
            <PriceLine
              label={he.quoteMargin}
              value={quote.margin_percent != null ? `${quote.margin_percent}%` : "—"}
            />
          </>
        ) : null}
        {selectedCustomer ? <p className="pt-2 text-xs text-fg-muted">{selectedCustomer.display_name}</p> : null}
      </aside>
    </div>
  );
}

function PriceLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-fg-muted">{label}</span>
      <span className={strong ? "text-base font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}
