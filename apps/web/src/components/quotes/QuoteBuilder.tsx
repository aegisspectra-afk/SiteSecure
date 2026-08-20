import { Button, Input, Select, Status, Textarea } from "@site-secure/ui";
import { ApiClientError, type QuoteGap, type QuoteOut } from "@site-secure/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LottieAnimation } from "../lottie";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import {
  draftHasContent,
  goToQuoteField,
  headerFromQuote,
  headerPatch,
  headersEqual,
  parseNonNegative,
  type QuoteHeaderDraft,
} from "../../lib/quote-builder";
import { formatMoney, quoteStatusLabel, quoteStatusTone } from "../../lib/quotes";
import { useSession } from "../../lib/session";
import { SendQuoteConfirm } from "./SendQuoteConfirm";

const HISTORY_LIMIT = 40;

type Props = {
  quote: QuoteOut;
  workspaceId: string;
  roleKey?: string;
  features: string[];
  workspaceName?: string;
};

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function QuoteBuilder({ quote, workspaceId, roleKey, features, workspaceName }: Props) {
  const { api } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startedUnsaved = useRef(!quote.id);
  const routed = useRef(Boolean(quote.id));
  const [live, setLive] = useState(quote);
  const liveRef = useRef(live);
  liveRef.current = live;
  const canCreate = can(roleKey, "quotes.create", features);
  const canEdit =
    live.status === "draft" && (live.id ? can(roleKey, "quotes.edit", features) : canCreate);
  const canSend = can(roleKey, "quotes.send", features);
  const canViewCost = can(roleKey, "quotes.view_cost", features);
  const canCrm = can(roleKey, "crm.view", features);
  const canCrmCreate = can(roleKey, "crm.create", features);
  const canSites = can(roleKey, "sites.view", features);
  const canSitesCreate = can(roleKey, "sites.create", features);
  const canCatalog = can(roleKey, "catalog.view", features);

  const [draft, setDraft] = useState<QuoteHeaderDraft>(() => headerFromQuote(quote));
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [history, setHistory] = useState<QuoteHeaderDraft[]>([headerFromQuote(quote)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error" | "local">(
    quote.id ? "saved" : "local",
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [gaps, setGaps] = useState<QuoteGap[]>(quote.validation?.gaps ?? []);
  const [publicUrl, setPublicUrl] = useState(quote.public_url ?? "");
  const [copied, setCopied] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [catalogQ, setCatalogQ] = useState("");
  const [customerQ, setCustomerQ] = useState("");
  const [customerLabel, setCustomerLabel] = useState(quote.customer_name ?? "");
  const [newCustomer, setNewCustomer] = useState({ display_name: "", email: "" });
  const [newSite, setNewSite] = useState({ name: "", address: "" });
  const [templatesReady, setTemplatesReady] = useState(Boolean(quote.template_id));
  const skipHistory = useRef(false);
  const createGate = useRef<Promise<QuoteOut> | null>(null);
  const debouncedCatalogQ = useDebouncedValue(catalogQ, 350);
  const debouncedCustomerQ = useDebouncedValue(customerQ, 350);

  useEffect(() => {
    if (!quote.id) return;
    if (
      quote.id === liveRef.current.id &&
      quote.status === liveRef.current.status &&
      quote.version === liveRef.current.version
    ) {
      return;
    }
    setLive(quote);
    liveRef.current = quote;
    const next = headerFromQuote(quote);
    setDraft(next);
    setHistory([next]);
    setHistoryIndex(0);
    setGaps(quote.validation?.gaps ?? []);
    if (quote.public_url) setPublicUrl(quote.public_url);
    if (quote.customer_name) setCustomerLabel(quote.customer_name);
    if (quote.template_id) setTemplatesReady(true);
  }, [quote]);

  function touchQuoteList() {
    void queryClient.invalidateQueries({ queryKey: ["quotes", workspaceId] });
  }

  function applyRow(row: QuoteOut) {
    const merged: QuoteOut = {
      ...row,
      customer_name: row.customer_name ?? liveRef.current.customer_name,
      site_name: row.site_name ?? liveRef.current.site_name,
    };
    liveRef.current = merged;
    setLive(merged);
    setGaps(merged.validation?.gaps ?? []);
    if (merged.public_url) setPublicUrl(merged.public_url);
    if (merged.customer_name) setCustomerLabel(merged.customer_name);
    queryClient.setQueryData(["quote", workspaceId, merged.id], merged);
    touchQuoteList();
  }

  async function createOnce(): Promise<QuoteOut> {
    if (liveRef.current.id) return liveRef.current;
    if (!createGate.current) {
      createGate.current = api
        .createQuote(workspaceId, headerPatch(draftRef.current))
        .then((row) => {
          applyRow(row);
          return row;
        })
        .finally(() => {
          createGate.current = null;
        });
    }
    return createGate.current;
  }

  function commitRoute(id: string) {
    if (!startedUnsaved.current || routed.current || !id) return;
    routed.current = true;
    void navigate({ to: "/app/quotes/$quoteId", params: { quoteId: id }, replace: true });
  }

  async function persistHeader(opts?: { skipRoute?: boolean }): Promise<QuoteOut> {
    let current = liveRef.current;
    if (!current.id) {
      current = await createOnce();
    }
    const draftNow = draftRef.current;
    if (JSON.stringify(headerPatch(draftNow)) !== JSON.stringify(headerPatch(headerFromQuote(current)))) {
      current = await api.patchQuote(workspaceId, current.id, headerPatch(draftNow));
      applyRow(current);
    }
    if (!opts?.skipRoute) commitRoute(current.id);
    return current;
  }

  const catalogQuery = useQuery({
    queryKey: ["cpq-catalog", workspaceId, debouncedCatalogQ],
    enabled: canCatalog && debouncedCatalogQ.trim().length >= 1,
    queryFn: () => api.listCatalogProducts(workspaceId, { q: debouncedCatalogQ.trim(), limit: 20 }),
  });
  const customersQuery = useQuery({
    queryKey: ["cpq-customers", workspaceId, debouncedCustomerQ],
    enabled: canCrm && !draft.customer_id && debouncedCustomerQ.trim().length >= 1,
    queryFn: () => api.listCustomers(workspaceId, { q: debouncedCustomerQ.trim(), limit: 20 }),
  });
  const customerQuery = useQuery({
    queryKey: ["customer", workspaceId, draft.customer_id],
    enabled: canCrm && Boolean(draft.customer_id) && !customerLabel,
    queryFn: () => api.getCustomer(workspaceId, draft.customer_id),
    staleTime: 60_000,
  });
  const sitesQuery = useQuery({
    queryKey: ["cpq-sites", workspaceId, draft.customer_id],
    enabled: canSites && Boolean(draft.customer_id),
    queryFn: () => api.listSites(workspaceId, { customer_id: draft.customer_id, limit: 50 }),
  });
  const templatesQuery = useQuery({
    queryKey: ["cpq-templates", workspaceId],
    enabled: canCatalog && templatesReady,
    queryFn: () => api.listQuoteTemplates(workspaceId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (customerQuery.data?.id === draft.customer_id && customerQuery.data.display_name) {
      setCustomerLabel(customerQuery.data.display_name);
    }
  }, [customerQuery.data, draft.customer_id]);

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

  const skipRouteRef = useRef(false);
  const save = useMutation({
    mutationFn: () => persistHeader({ skipRoute: skipRouteRef.current }),
    onMutate: () => setSaveState("saving"),
    onSuccess: () => setSaveState("saved"),
    onError: (err) => {
      setSaveState("error");
      setFormError(err instanceof ApiClientError ? err.message : he.quoteSaveError);
    },
  });

  const saveRef = useRef(save);
  saveRef.current = save;

  const baseline = headerFromQuote(live);
  const dirty = !headersEqual(draft, baseline);

  useEffect(() => {
    if (!canEdit || !dirty) return;
    if (!live.id && !draftHasContent(draft)) return;
    const timer = window.setTimeout(() => {
      saveRef.current.mutate();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [draft, canEdit, dirty, live.id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (canEdit && dirty) save.mutate();
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
  }, [canEdit, dirty, history, historyIndex, save]);

  const addItem = useMutation({
    mutationFn: async (body: Parameters<typeof api.addQuoteItem>[2]) => {
      const current = await createOnce();
      const row = await api.addQuoteItem(workspaceId, current.id, body);
      applyRow(row);
      commitRoute(row.id);
      return row;
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.quotesError),
  });
  const patchItem = useMutation({
    mutationFn: async ({
      itemId,
      body,
    }: {
      itemId: string;
      body: { qty?: number; unit_price?: number; discount?: number; description?: string };
    }) => {
      const current = await createOnce();
      const row = await api.patchQuoteItem(workspaceId, current.id, itemId, body);
      applyRow(row);
      return row;
    },
  });
  const deleteItem = useMutation({
    mutationFn: async (itemId: string) => {
      const current = await createOnce();
      const row = await api.deleteQuoteItem(workspaceId, current.id, itemId);
      applyRow(row);
      return row;
    },
  });
  const applyTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const current = await createOnce();
      const row = await api.applyQuoteTemplate(workspaceId, current.id, { template_id: templateId });
      applyRow(row);
      commitRoute(row.id);
      return row;
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.quotesError),
  });
  const send = useMutation({
    mutationFn: async () => {
      const current = await persistHeader();
      return api.sendQuote(workspaceId, current.id);
    },
    onSuccess: (row) => {
      applyRow(row);
      setJustSent(true);
      setConfirmSend(false);
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
    mutationFn: () => api.reviseQuote(workspaceId, live.id),
    onSuccess: (row) => applyRow(row),
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.quotesError),
  });
  const share = useMutation({
    mutationFn: () => api.shareQuote(workspaceId, live.id),
    onSuccess: async (row) => {
      setPublicUrl(row.public_url);
      await navigator.clipboard.writeText(row.public_url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    },
  });

  const items = live.items ?? [];
  const currency = live.currency ?? "ILS";
  const liveGaps = gaps.length ? gaps : live.validation?.gaps ?? [];
  const canSendNow = Boolean(live.id) && canSend && live.status === "draft" && liveGaps.length === 0;
  const companyName = workspaceName ?? "";
  const selectedName = customerLabel || customerQuery.data?.display_name || live.customer_name || "";
  const customerResults = customersQuery.data?.items ?? [];
  const catalogResults = catalogQuery.data?.items ?? [];

  function undo() {
    if (historyIndex <= 0) return;
    skipHistory.current = true;
    setDraft(history[historyIndex - 1]);
    setHistoryIndex(historyIndex - 1);
    skipHistory.current = false;
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    skipHistory.current = true;
    setDraft(history[historyIndex + 1]);
    setHistoryIndex(historyIndex + 1);
    skipHistory.current = false;
  }

  const saveLabel =
    saveState === "saving"
      ? he.quoteSaving
      : saveState === "error"
        ? he.quoteSaveError
        : !live.id
          ? he.quoteUnsaved
          : he.quoteSaved;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem] xl:grid-rows-[auto_auto_1fr]">
      <header className="sticky top-0 z-10 flex flex-col gap-3 border border-border bg-bg-1 px-3 py-3 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Link
              to="/app/quotes"
              className="text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {he.quoteBackToList}
            </Link>
            <h1 className="truncate text-base font-semibold text-fg">
              {live.number || he.newQuote}
            </h1>
            <Status label={quoteStatusLabel(live.status)} tone={quoteStatusTone(live.status)} />
            <p className="text-xs text-fg-muted" aria-live="polite">
              {saveLabel}
              {live.id && live.version ? ` · ${he.quotesVersion(live.version)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" disabled={historyIndex <= 0} onClick={undo}>
              {he.quoteUndo}
            </Button>
            <Button variant="ghost" disabled={historyIndex >= history.length - 1} onClick={redo}>
              {he.quoteRedo}
            </Button>
            {live.status === "draft" ? (
              <Button
                variant="secondary"
                loading={save.isPending}
                disabled={!live.id && !draftHasContent(draft)}
                onClick={async () => {
                  skipRouteRef.current = true;
                  try {
                    const row = await save.mutateAsync();
                    void navigate({ to: "/app/quotes/$quoteId/preview", params: { quoteId: row.id } });
                  } catch (err) {
                    setFormError(err instanceof ApiClientError ? err.message : he.quoteSaveError);
                  } finally {
                    skipRouteRef.current = false;
                  }
                }}
              >
                {he.quotePreview}
              </Button>
            ) : null}
            {live.status === "draft" && canSend ? (
              <Button disabled={!canSendNow} onClick={() => setConfirmSend(true)}>
                {he.quoteSend}
              </Button>
            ) : null}
            {live.status !== "draft" && live.status !== "cancelled" && canCreate ? (
              <Button variant="secondary" loading={revise.isPending} onClick={() => revise.mutate()}>
                {he.quoteRevise}
              </Button>
            ) : null}
            {(live.status === "sent" || live.status === "viewed") && canSend ? (
              <Button variant="secondary" loading={share.isPending} onClick={() => share.mutate()}>
                {copied ? he.quoteCopyLink : he.quoteShare}
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <SendQuoteConfirm
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        onConfirm={() => send.mutate()}
        pending={send.isPending}
        customer={selectedName}
        number={live.number}
        amount={live.total_gross}
        currency={currency}
      />

      <aside className="ops-card sticky top-4 flex h-fit flex-col gap-3 p-5 xl:col-start-2 xl:row-start-2">
        <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{he.quoteSectionPricing}</p>
        <PriceLine label={he.quoteSubtotal} value={formatMoney(live.subtotal_net, currency)} />
        <PriceLine label={he.quoteDiscount} value={draft.discount_value ? draft.discount_value : "—"} />
        <PriceLine label={he.quoteTax} value={formatMoney(live.vat_amount, currency)} />
        <PriceLine label={he.quoteTotal} value={formatMoney(live.total_gross, currency)} strong />
        {canViewCost ? (
          <>
            <PriceLine label={he.quoteCost} value={formatMoney(live.cost_total, currency)} />
            <PriceLine label={he.quoteGrossProfit} value={formatMoney(live.margin_amount, currency)} />
            <PriceLine
              label={he.quoteMargin}
              value={live.margin_percent != null ? `${live.margin_percent}%` : "—"}
            />
          </>
        ) : null}
        {selectedName ? <p className="pt-2 text-xs text-fg-muted">{selectedName}</p> : null}
      </aside>

      <div className="flex flex-col gap-5 xl:col-start-1 xl:row-start-2">
        {live.status !== "draft" ? <p className="text-sm text-fg-muted">{he.quoteLocked}</p> : null}
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
        {justSent && publicUrl ? (
          <section className="ops-card flex items-center gap-4 p-4">
            <LottieAnimation name="sentEmail" size={48} />
            <div className="min-w-0">
              <p className="text-sm font-medium">{he.quoteSentTitle}</p>
              <a className="break-all text-sm text-action" href={publicUrl} target="_blank" rel="noreferrer">
                {publicUrl}
              </a>
            </div>
          </section>
        ) : publicUrl ? (
          <p className="text-sm">
            <a className="text-action" href={publicUrl} target="_blank" rel="noreferrer">
              {publicUrl}
            </a>
          </p>
        ) : null}

        <section className="ops-card flex flex-col gap-4 p-5">
          <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{he.quoteSectionCustomer}</p>
          <p id="quote-company" tabIndex={-1} className="text-sm text-fg-muted">
            {companyName || he.quotePublicCompany}
          </p>
          {canCrm ? (
            draft.customer_id && selectedName ? (
              <div id="customer_id" tabIndex={-1} className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-border px-3 py-2">
                <p className="text-sm font-medium">{selectedName}</p>
                {canEdit ? (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      updateDraft({ customer_id: "", site_id: "" });
                      setCustomerLabel("");
                      setCustomerQ("");
                    }}
                  >
                    {he.quoteCustomerChange}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Input
                  id="customer_id"
                  label={he.quoteCustomerSearch}
                  hint={he.quoteCustomerSearchHint}
                  value={customerQ}
                  disabled={!canEdit}
                  onChange={(ev) => setCustomerQ(ev.target.value)}
                  autoComplete="off"
                />
                {customerResults.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className="flex items-center justify-between rounded-[var(--radius-control)] border border-border px-3 py-2 text-start text-sm hover:bg-bg-subtle"
                    onClick={() => {
                      updateDraft({ customer_id: row.id, site_id: "" });
                      setCustomerLabel(row.display_name);
                      setCustomerQ("");
                    }}
                  >
                    <span>{row.display_name}</span>
                  </button>
                ))}
                {debouncedCustomerQ.trim() && customerResults.length === 0 && !customersQuery.isFetching ? (
                  <p className="text-sm text-fg-muted">{he.quoteCustomerEmpty}</p>
                ) : null}
              </div>
            )
          ) : null}
          {canEdit && canCrmCreate && !draft.customer_id ? (
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
                  setCustomerLabel(created.display_name);
                  updateDraft({ customer_id: created.id, site_id: "" });
                }}
              >
                {he.quoteCustomerCreate}
              </Button>
            </div>
          ) : null}
        </section>

        <section className="ops-card flex flex-col gap-4 p-5">
          <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{he.quoteSectionSite}</p>
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
                  const address = newSite.address.trim();
                  setNewSite({ name: "", address: "" });
                  updateDraft({
                    site_id: created.id,
                    project_name: created.name,
                    project_address: address || draft.project_address,
                  });
                  void queryClient.invalidateQueries({ queryKey: ["cpq-sites", workspaceId, draft.customer_id] });
                }}
              >
                {he.quoteSiteCreate}
              </Button>
            </div>
          ) : null}
        </section>

        <section className="ops-card flex flex-col gap-4 p-5">
          <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{he.quoteSectionDetails}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="title" label={he.quoteTitle} value={draft.title} disabled={!canEdit} onChange={(ev) => updateDraft({ title: ev.target.value })} />
            <Input id="valid_until" label={he.quoteValidUntil} type="date" value={draft.valid_until} disabled={!canEdit} onChange={(ev) => updateDraft({ valid_until: ev.target.value })} />
          </div>
        </section>

        <section className="ops-card flex flex-col gap-4 p-5">
          <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{he.quoteSectionProject}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="project_name" label={he.quoteProjectName} value={draft.project_name} disabled={!canEdit} onChange={(ev) => updateDraft({ project_name: ev.target.value })} />
            <Input id="project_address" label={he.quoteProjectAddress} value={draft.project_address} disabled={!canEdit} onChange={(ev) => updateDraft({ project_address: ev.target.value })} />
          </div>
          <Textarea id="summary" label={he.quoteSummary} value={draft.summary} disabled={!canEdit} onChange={(ev) => updateDraft({ summary: ev.target.value })} />
          <Textarea id="key_points" label={he.quoteKeyPoints} value={draft.key_points} disabled={!canEdit} onChange={(ev) => updateDraft({ key_points: ev.target.value })} />
        </section>

        {canCatalog ? (
          <section className="ops-card flex flex-col gap-4 p-5">
            <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{he.quoteSectionTemplates}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Select
                  id="template_id"
                  label={he.quoteTemplate}
                  value={draft.template_id}
                  disabled={!canEdit}
                  onFocus={() => setTemplatesReady(true)}
                  onChange={(ev) => {
                    setTemplatesReady(true);
                    updateDraft({ template_id: ev.target.value });
                  }}
                >
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
          </section>
        ) : null}

        <section id="quote-items" tabIndex={-1} className="ops-card flex flex-col gap-4 p-5">
          <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{he.quoteSectionItems}</p>
          {items.length === 0 ? <p className="text-sm text-fg-muted">{he.quoteItemsEmpty}</p> : null}
          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <div key={item.id} className="grid gap-2 rounded-[var(--radius-control)] border border-border p-3 sm:grid-cols-[1fr_5rem_7rem_6rem_auto]">
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
              <Input
                id="catalog-search"
                label={he.quoteCatalogSearch}
                hint={he.quoteCatalogSearchHint}
                value={catalogQ}
                onChange={(ev) => setCatalogQ(ev.target.value)}
                autoComplete="off"
              />
              {catalogResults.map((product) => (
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
              {debouncedCatalogQ.trim() && catalogResults.length === 0 && !catalogQuery.isFetching ? (
                <p className="text-sm text-fg-muted">{he.quoteCatalogEmpty}</p>
              ) : null}
              <Link to="/app/catalog" className="text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                {he.navCatalog}
              </Link>
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
        </section>

        <section className="ops-card flex flex-col gap-4 p-5">
          <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{he.quoteSectionNotes}</p>
          <Textarea id="customer_notes" label={he.quoteCustomerNotes} value={draft.customer_notes} disabled={!canEdit} onChange={(ev) => updateDraft({ customer_notes: ev.target.value })} />
          <Textarea id="internal_notes" label={he.quoteInternalNotes} value={draft.internal_notes} disabled={!canEdit} onChange={(ev) => updateDraft({ internal_notes: ev.target.value })} />
        </section>
      </div>
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
