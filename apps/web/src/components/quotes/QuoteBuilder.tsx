import { Button, Input, Select, Status, Textarea } from "@site-secure/ui";
import { ApiClientError, type QuoteGap, type QuoteOut } from "@site-secure/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LottieAnimation } from "../lottie";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import {
  draftHasContent,
  goToQuoteField,
  headerFromQuote,
  headerPatch,
  headersEqual,
  type QuoteHeaderDraft,
} from "../../lib/quote-builder";
import {
  canSendWithGaps,
  completenessScore,
  filterEmptyQuoteMarginGaps,
  mergeQuoteGaps,
  neighborSortOrders,
  softQuoteAdvisories,
} from "../../lib/quote-cpq";
import type { SystemBuilderLine } from "../../lib/system-builder";
import { quoteStatusLabel, quoteStatusTone, formatMoney } from "../../lib/quotes";
import { useSession } from "../../lib/session";
import { resolveQuoteContext } from "../../lib/workflow-context";
import { LeadRequirementsCard } from "./cpq/LeadRequirementsCard";
import { QuoteAuditStrip } from "./cpq/QuoteAuditStrip";
import { QuoteLinesPanel } from "./cpq/QuoteLinesPanel";
import { QuoteSummaryAside } from "./cpq/QuoteSummaryAside";
import { QuoteValidationPanel } from "./cpq/QuoteValidationPanel";
import { RevisionComparePanel } from "./cpq/RevisionComparePanel";
import { SystemBuilderDrawer } from "./cpq/SystemBuilderDrawer";
import { QuoteContextCard } from "./quote-creation/QuoteContextCard";
import { SendQuoteConfirm } from "./SendQuoteConfirm";
import { ProjectFromQuoteDialog } from "../workflow/ProjectFromQuoteDialog";
import { addressLine } from "../modules/ModuleKit";

const HISTORY_LIMIT = 40;

type Props = {
  quote: QuoteOut;
  workspaceId: string;
  roleKey?: string;
  features: string[];
  workspaceName?: string;
  initialCustomerId?: string;
  initialSiteId?: string;
  initialLeadId?: string;
};

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function QuoteBuilder({
  quote,
  workspaceId,
  roleKey,
  features,
  workspaceName,
  initialCustomerId,
  initialSiteId,
  initialLeadId,
}: Props) {
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
  const canOverridePrice = can(roleKey, "quotes.override_price", features);
  const canCrm = can(roleKey, "crm.view", features);
  const canCrmCreate = can(roleKey, "crm.create", features);
  const canLeads = can(roleKey, "leads.view", features);
  const canSites = can(roleKey, "sites.view", features);
  const canSitesCreate = can(roleKey, "sites.create", features);
  const canCatalog = can(roleKey, "catalog.view", features);
  const canCreateProject = can(roleKey, "projects.create", features);
  const canViewProjects = can(roleKey, "projects.view", features);

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
  const [projectDialog, setProjectDialog] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectToast, setProjectToast] = useState(false);
  const [catalogQ, setCatalogQ] = useState("");
  const [customerQ, setCustomerQ] = useState("");
  const [customerLabel, setCustomerLabel] = useState(quote.customer_name ?? "");
  const [newCustomer, setNewCustomer] = useState({ display_name: "", email: "" });
  const [newSite, setNewSite] = useState({ name: "", address: "" });
  const [templatesReady, setTemplatesReady] = useState(Boolean(quote.template_id));
  const [systemBuilderOpen, setSystemBuilderOpen] = useState(false);
  const [systemCatalogReady, setSystemCatalogReady] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [projectDetailsOpen, setProjectDetailsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
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
  const systemCatalogQuery = useQuery({
    queryKey: ["cpq-catalog-system", workspaceId],
    enabled: canCatalog && systemCatalogReady,
    queryFn: () => api.listCatalogProducts(workspaceId, { limit: 100 }),
    staleTime: 60_000,
  });
  const requestSystemCatalog = useCallback(() => setSystemCatalogReady(true), []);
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
  const linkedProjectQuery = useQuery({
    queryKey: ["project-by-quote", workspaceId, live.id],
    enabled: Boolean(live.id) && live.status === "approved" && canViewProjects,
    queryFn: async () => {
      const page = await api.listProjects(workspaceId, { source_quote_id: live.id, limit: 1 });
      return page.items[0] ?? null;
    },
  });
  const templatesQuery = useQuery({
    queryKey: ["cpq-templates", workspaceId],
    enabled: canCatalog && templatesReady,
    queryFn: () => api.listQuoteTemplates(workspaceId),
    staleTime: 60_000,
  });
  const leadsQuery = useQuery({
    queryKey: ["cpq-leads", workspaceId],
    enabled: canLeads,
    queryFn: () => api.listLeads(workspaceId, { limit: 100 }),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (customerQuery.data?.id === draft.customer_id && customerQuery.data.display_name) {
      setCustomerLabel(customerQuery.data.display_name);
    }
  }, [customerQuery.data, draft.customer_id]);

  const contextSeeded = useRef(false);
  useEffect(() => {
    if (quote.id || contextSeeded.current) return;
    if (!initialCustomerId && !initialSiteId && !initialLeadId) return;
    contextSeeded.current = true;
    const patch: Partial<QuoteHeaderDraft> = {};
    if (initialCustomerId) patch.customer_id = initialCustomerId;
    if (initialSiteId) patch.site_id = initialSiteId;
    if (initialLeadId) patch.lead_id = initialLeadId;
    skipHistory.current = true;
    setDraft((prev) => ({ ...prev, ...patch }));
    setHistory((prev) => [{ ...prev[0], ...patch }]);
    skipHistory.current = false;
  }, [initialCustomerId, initialSiteId, initialLeadId, quote.id]);

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

  const autoSiteApplied = useRef(false);
  useEffect(() => {
    if (!initialCustomerId || initialSiteId || autoSiteApplied.current) return;
    if (!sitesQuery.data) return;
    const sites = sitesQuery.data.items ?? [];
    const resolved = resolveQuoteContext({ customerId: initialCustomerId, sites });
    if (resolved.siteId && !draftRef.current.site_id) {
      autoSiteApplied.current = true;
      updateDraft({ site_id: resolved.siteId });
      return;
    }
    if (resolved.needsSiteSelection && !draftRef.current.site_id) {
      autoSiteApplied.current = true;
      goToQuoteField("site_id");
    }
  }, [initialCustomerId, initialSiteId, sitesQuery.data]);

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
      body: { qty?: number; unit_price?: number; discount?: number; description?: string; sort_order?: number };
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
  const addSection = useMutation({
    mutationFn: async () => {
      const current = await createOnce();
      const row = await api.createQuoteSection(workspaceId, current.id, {
        name: he.cpqSectionUntitled,
        sort_order: ((live.sections?.length ?? 0) + 1) * 10,
      });
      applyRow(row);
      commitRoute(row.id);
      return row;
    },
    onError: (err) => setFormError(err instanceof ApiClientError ? err.message : he.quotesError),
  });
  const patchSection = useMutation({
    mutationFn: async ({
      sectionId,
      body,
    }: {
      sectionId: string;
      body: { name?: string; collapsed?: boolean; sort_order?: number };
    }) => {
      const current = await createOnce();
      const row = await api.patchQuoteSection(workspaceId, current.id, sectionId, body);
      applyRow(row);
      return row;
    },
  });
  const deleteSection = useMutation({
    mutationFn: async (sectionId: string) => {
      const current = await createOnce();
      const row = await api.deleteQuoteSection(workspaceId, current.id, sectionId);
      applyRow(row);
      return row;
    },
  });
  const duplicateSection = useMutation({
    mutationFn: async (sectionId: string) => {
      const current = await createOnce();
      const row = await api.duplicateQuoteSection(workspaceId, current.id, sectionId);
      applyRow(row);
      return row;
    },
  });
  const marginOverride = useMutation({
    mutationFn: async () => {
      const reason = window.prompt(he.cpqMarginOverridePrompt);
      if (!reason?.trim()) throw new Error("cancelled");
      return api.overrideQuoteMargin(workspaceId, live.id, reason.trim());
    },
    onSuccess: (row) => applyRow(row),
    onError: (err) => {
      if (err instanceof Error && err.message === "cancelled") return;
      setFormError(err instanceof ApiClientError ? err.message : he.quotesError);
    },
  });
  const saveAsTemplate = useMutation({
    mutationFn: async () => {
      const name = window.prompt(he.cpqSaveTemplatePrompt, live.title || live.number);
      if (!name?.trim()) throw new Error("cancelled");
      return api.saveQuoteAsTemplate(workspaceId, live.id, { name_he: name.trim(), include_terms: true });
    },
    onError: (err) => {
      if (err instanceof Error && err.message === "cancelled") return;
      setFormError(err instanceof ApiClientError ? err.message : he.quotesError);
    },
  });
  const saveAsPackage = useMutation({
    mutationFn: async () => {
      const name = window.prompt(he.cpqSavePackagePrompt, live.title || live.number);
      if (!name?.trim()) throw new Error("cancelled");
      return api.saveQuoteAsPackage(workspaceId, live.id, { name: name.trim() });
    },
    onError: (err) => {
      if (err instanceof Error && err.message === "cancelled") return;
      setFormError(err instanceof ApiClientError ? err.message : he.quotesError);
    },
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
  const createProject = useMutation({
    mutationFn: () => api.createProjectFromQuote(workspaceId, { source_quote_id: live.id }),
    onSuccess: (project) => {
      setProjectError(null);
      setProjectDialog(false);
      setProjectToast(true);
      void queryClient.invalidateQueries({ queryKey: ["project-by-quote", workspaceId, live.id] });
      void queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["customer-projects", workspaceId] });
      void navigate({ to: "/app/projects/$projectId", params: { projectId: project.id } });
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.status === 409) {
        const existingId = typeof err.details.project_id === "string" ? err.details.project_id : null;
        if (existingId) {
          setProjectDialog(false);
          void navigate({ to: "/app/projects/$projectId", params: { projectId: existingId } });
          return;
        }
      }
      setProjectError(err instanceof ApiClientError ? err.message : he.projectsError);
    },
  });

  const linkedProject = linkedProjectQuery.data ?? null;
  const items = live.items ?? [];
  const currency = live.currency ?? "ILS";
  const vatPercent = live.vat_percent ?? 18;
  const linkedLead = useMemo(
    () => (leadsQuery.data?.items ?? []).find((row) => row.id === draft.lead_id) ?? null,
    [leadsQuery.data?.items, draft.lead_id],
  );
  const softGaps = useMemo(
    () => softQuoteAdvisories({ lead: linkedLead, items }),
    [linkedLead, items],
  );
  const serverGaps = gaps.length ? gaps : live.validation?.gaps ?? [];
  const liveGaps = filterEmptyQuoteMarginGaps(
    mergeQuoteGaps(serverGaps, softGaps),
    items.filter((item) => item.item_type !== "note").length,
  );
  const canSendNow = Boolean(live.id) && canSend && live.status === "draft" && canSendWithGaps(liveGaps);
  const completeness = completenessScore(liveGaps);
  const missingCompleteness = completeness.total - completeness.done;
  const companyName = workspaceName ?? "";
  const selectedName = customerLabel || customerQuery.data?.display_name || live.customer_name || "";
  const customerResults = customersQuery.data?.items ?? [];
  const catalogResults = catalogQuery.data?.items ?? [];
  const selectedSite = sitesQuery.data?.items.find((row) => row.id === draft.site_id);
  const selectedSiteAddress = selectedSite ? addressLine(selectedSite.address) : "";
  const customerKind =
    customerQuery.data?.type === "person" || customerQuery.data?.type === "individual"
      ? he.workflowCustomerPrivate
      : draft.customer_id
        ? he.workflowCustomerBusiness
        : null;
  const pricedCount = items.filter((item) => item.item_type !== "note" && Number(item.unit_price) > 0).length;
  const customerPhone =
    (customerQuery.data?.phone || "").replace(/\D/g, "") ||
    (linkedLead?.phone || "").replace(/\D/g, "");

  async function reorderItem(itemId: string, direction: "up" | "down") {
    const plan = neighborSortOrders(items, itemId, direction);
    if (!plan) return;
    await patchItem.mutateAsync({ itemId: plan.itemId, body: { sort_order: plan.sort_order } });
    await patchItem.mutateAsync({ itemId: plan.swapId, body: { sort_order: plan.swap_order } });
  }

  async function addSystemBuilderLines(lines: SystemBuilderLine[]) {
    for (const line of lines) {
      if (!line.product) continue;
      await addItem.mutateAsync({
        product_id: line.product.id,
        item_type: line.product.item_type || "catalog",
        qty: line.qty,
      });
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key === "/") {
        event.preventDefault();
        document.getElementById("catalog-search")?.focus();
        return;
      }
      if (!meta) return;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (canEdit && dirty) save.mutate();
      }
      if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        const last = items[items.length - 1];
        if (!canEdit || !last || last.item_type === "note") return;
        addItem.mutate({
          item_type: last.item_type,
          description: last.description,
          qty: last.qty,
          unit_price: last.unit_price,
          product_id: last.product_id ?? undefined,
        });
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
  }, [canEdit, dirty, history, historyIndex, save, items, addItem]);

  async function openWhatsApp() {
    try {
      let url = publicUrl;
      if (!url && live.id) {
        const shared = await api.shareQuote(workspaceId, live.id);
        url = shared.public_url;
        setPublicUrl(url);
      }
      const text = encodeURIComponent(
        [`הצעת מחיר ${live.number || ""}`.trim(), url].filter(Boolean).join("\n"),
      );
      const phone = customerPhone.startsWith("0")
        ? `972${customerPhone.slice(1)}`
        : customerPhone;
      window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : he.quotesError);
    }
  }

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
          : he.cpqSavedJustNow;

  async function goCustomerView() {
    skipRouteRef.current = true;
    try {
      const row = live.id && !dirty ? live : await save.mutateAsync();
      void navigate({ to: "/app/quotes/$quoteId/preview", params: { quoteId: row.id } });
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : he.quoteSaveError);
    } finally {
      skipRouteRef.current = false;
    }
  }

  function focusValidation() {
    document.getElementById("cpq-validation")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="quote-builder cpq-builder grid gap-4 pb-28 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <header className="cpq-builder-header sticky top-0 z-10 xl:col-span-2">
        <nav className="cpq-breadcrumb" aria-label="breadcrumb">
          <Link to="/app/quotes" className="cpq-breadcrumb-link">
            {he.cpqBreadcrumbQuotes}
          </Link>
          <span className="cpq-breadcrumb-sep" aria-hidden>
            /
          </span>
          <span className="cpq-breadcrumb-current">{live.number || he.quoteBuilderTitle}</span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">
                {live.number ? `${he.quoteDetailTitle} #${live.number}` : he.quoteBuilderTitle}
              </h1>
              <Status label={quoteStatusLabel(live.status)} tone={quoteStatusTone(live.status)} />
            </div>
            <p className="text-xs text-fg-subtle" aria-live="polite">
              {live.id && live.version ? `${he.quotesVersion(live.version)} · ` : ""}
              {saveLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? (
              <Button
                variant="secondary"
                loading={save.isPending}
                disabled={!live.id && !draftHasContent(draft)}
                onClick={() => save.mutate()}
              >
                {he.save}
              </Button>
            ) : null}
            {live.id || canEdit ? (
              <Button
                variant="secondary"
                disabled={!live.id && !draftHasContent(draft)}
                onClick={() => void goCustomerView()}
              >
                {he.cpqCustomerView}
              </Button>
            ) : null}
            {live.status === "draft" && canSend ? (
              <Button
                disabled={!canSendNow}
                title={!canSendNow ? he.cpqSendBlockedHint(Math.max(missingCompleteness, 1)) : undefined}
                onClick={async () => {
                  if (!canSendNow) {
                    focusValidation();
                    return;
                  }
                  skipRouteRef.current = true;
                  try {
                    await save.mutateAsync();
                    setConfirmSend(true);
                  } catch (err) {
                    setFormError(err instanceof ApiClientError ? err.message : he.quoteSaveError);
                  } finally {
                    skipRouteRef.current = false;
                  }
                }}
              >
                {he.quoteSaveAndSend}
              </Button>
            ) : null}
            <div className="relative">
              <Button variant="ghost" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}>
                {he.cpqMoreActions}
              </Button>
              {moreOpen ? (
                <div className="cpq-overflow-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={historyIndex <= 0}
                    onClick={() => {
                      undo();
                      setMoreOpen(false);
                    }}
                  >
                    {he.quoteUndo}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={historyIndex >= history.length - 1}
                    onClick={() => {
                      redo();
                      setMoreOpen(false);
                    }}
                  >
                    {he.quoteRedo}
                  </button>
                  {live.id ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        void goCustomerView();
                        setMoreOpen(false);
                      }}
                    >
                      {he.cpqDownloadDocument}
                    </button>
                  ) : null}
                  {live.status !== "draft" && live.status !== "cancelled" && canCreate ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        revise.mutate();
                        setMoreOpen(false);
                      }}
                    >
                      {he.quoteRevise}
                    </button>
                  ) : null}
                  {(live.status === "sent" || live.status === "viewed") && canSend ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        share.mutate();
                        setMoreOpen(false);
                      }}
                    >
                      {copied ? he.quoteCopyLink : he.cpqCopySecureLink}
                    </button>
                  ) : null}
                  {live.id ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        void openWhatsApp();
                        setMoreOpen(false);
                      }}
                    >
                      {he.quoteWhatsApp}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
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

      <div className="flex flex-col gap-5">
        {live.status !== "draft" ? <p className="text-sm text-fg-muted">{he.quoteLocked}</p> : null}
        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
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
        ) : null}

        <section className="cpq-zone-context ops-card flex flex-col gap-3 p-4">
          <p id="quote-company" tabIndex={-1} className="sr-only">
            {companyName || he.quotePublicCompany}
          </p>

          {canCrm ? (
            draft.customer_id && selectedName ? (
              <QuoteContextCard
                customerName={selectedName}
                customerKind={customerKind}
                siteName={selectedSite?.name || live.site_name}
                siteAddress={selectedSiteAddress}
                canChange={canEdit}
                onChange={() => {
                  updateDraft({ customer_id: "", site_id: "" });
                  setCustomerLabel("");
                  setCustomerQ("");
                }}
                canCreateSite={canEdit && canSitesCreate && !draft.site_id}
                onCreateSite={() => {
                  setProjectDetailsOpen(true);
                  window.setTimeout(() => document.getElementById("new-site-name")?.focus(), 50);
                }}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <QuoteContextCard unassigned />
                <div className="flex flex-col gap-2">
                  <Input
                    id="customer_id"
                    label={he.quoteCustomer}
                    hint={he.quoteCustomerNone}
                    value={customerQ}
                    disabled={!canEdit}
                    onChange={(ev) => setCustomerQ(ev.target.value)}
                    autoComplete="off"
                  />
                  {customerResults.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className="quote-flow-action"
                      onClick={() => {
                        updateDraft({ customer_id: row.id, site_id: "" });
                        setCustomerLabel(row.display_name);
                        setCustomerQ("");
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate text-start text-sm font-medium">{row.display_name}</span>
                    </button>
                  ))}
                </div>
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

          {canLeads ? (
            <Select
              id="lead_id"
              label={he.quoteLead}
              value={draft.lead_id}
              disabled={!canEdit}
              onChange={(ev) => updateDraft({ lead_id: ev.target.value })}
            >
              <option value="">{he.quoteLeadNone}</option>
              {(leadsQuery.data?.items ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.title}
                </option>
              ))}
            </Select>
          ) : null}

          {linkedLead ? (
            <LeadRequirementsCard
              lead={linkedLead}
              onBuildSystem={canEdit && canCatalog ? () => setSystemBuilderOpen(true) : undefined}
            />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Input id="title" label={he.quoteTitle} value={draft.title} disabled={!canEdit} onChange={(ev) => updateDraft({ title: ev.target.value })} />
            <Input id="valid_until" label={he.quoteValidUntil} type="date" value={draft.valid_until} disabled={!canEdit} onChange={(ev) => updateDraft({ valid_until: ev.target.value })} />
          </div>

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

          <Input id="project_name" label={he.quoteProjectName} value={draft.project_name} disabled={!canEdit} onChange={(ev) => updateDraft({ project_name: ev.target.value })} />

          <div className="cpq-disclosure">
            <Button type="button" variant="ghost" onClick={() => setProjectDetailsOpen((v) => !v)}>
              {projectDetailsOpen ? "▾" : "▸"} {he.cpqProjectMore}
            </Button>
            {projectDetailsOpen ? (
              <div className="mt-3 grid gap-3">
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
                <Input id="project_address" label={he.quoteProjectAddress} value={draft.project_address} disabled={!canEdit} onChange={(ev) => updateDraft({ project_address: ev.target.value })} />
                <Textarea id="summary" label={he.quoteSummary} value={draft.summary} disabled={!canEdit} onChange={(ev) => updateDraft({ summary: ev.target.value })} />
                <Textarea id="key_points" label={he.quoteKeyPoints} value={draft.key_points} disabled={!canEdit} onChange={(ev) => updateDraft({ key_points: ev.target.value })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    id="discount_amount"
                    label={he.quoteDiscountAmountIls}
                    value={draft.discount_amount}
                    disabled={!canEdit}
                    onChange={(ev) => updateDraft({ discount_amount: ev.target.value, discount_percent: "" })}
                  />
                  <Input
                    id="discount_percent"
                    label={he.quoteDiscountPercentLabel}
                    value={draft.discount_percent}
                    disabled={!canEdit}
                    onChange={(ev) => updateDraft({ discount_percent: ev.target.value, discount_amount: "" })}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="cpq-disclosure">
            <Button type="button" variant="ghost" onClick={() => setTermsOpen((v) => !v)}>
              {termsOpen ? "▾" : "▸"} {he.cpqAdvancedTerms}
            </Button>
            {termsOpen ? (
              <div className="mt-3 grid gap-3">
                <Textarea id="payment_terms" label={he.quotePaymentTerms} value={draft.payment_terms} disabled={!canEdit} onChange={(ev) => updateDraft({ payment_terms: ev.target.value })} />
                <Textarea id="warranty" label={he.quoteWarranty} value={draft.warranty} disabled={!canEdit} onChange={(ev) => updateDraft({ warranty: ev.target.value })} />
                <Textarea id="general_terms" label={he.quoteGeneralTerms} value={draft.general_terms} disabled={!canEdit} onChange={(ev) => updateDraft({ general_terms: ev.target.value })} />
                <Textarea id="customer_notes" label={he.quoteNotesCombined} value={draft.customer_notes} disabled={!canEdit} onChange={(ev) => updateDraft({ customer_notes: ev.target.value })} />
                <Textarea id="internal_notes" label={he.quoteInternalNotes} value={draft.internal_notes} disabled={!canEdit} onChange={(ev) => updateDraft({ internal_notes: ev.target.value })} />
              </div>
            ) : (
              <p id="payment_terms" tabIndex={-1} className="sr-only">
                {draft.payment_terms}
              </p>
            )}
          </div>

          {canCatalog ? (
            <div className="flex flex-wrap items-end gap-2">
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
              {canOverridePrice && live.id ? (
                <div className="relative">
                  <Button variant="ghost" onClick={() => setTemplateMenuOpen((v) => !v)}>
                    {he.cpqTemplateActions}
                  </Button>
                  {templateMenuOpen ? (
                    <div className="cpq-overflow-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          saveAsTemplate.mutate();
                          setTemplateMenuOpen(false);
                        }}
                      >
                        {he.cpqSaveAsTemplate}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          saveAsPackage.mutate();
                          setTemplateMenuOpen(false);
                        }}
                      >
                        {he.cpqSaveAsPackage}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <QuoteLinesPanel
          items={items}
          sections={live.sections ?? []}
          currency={currency}
          canEdit={canEdit}
          canCatalog={canCatalog}
          catalogQ={catalogQ}
          onCatalogQ={setCatalogQ}
          catalogResults={catalogResults}
          catalogLoading={catalogQuery.isFetching}
          debouncedCatalogQ={debouncedCatalogQ}
          addPending={addItem.isPending}
          onOpenSystemBuilder={canEdit && canCatalog ? () => setSystemBuilderOpen(true) : undefined}
          onAddSection={canEdit ? () => addSection.mutate() : undefined}
          onRenameSection={(sectionId, name) => patchSection.mutate({ sectionId, body: { name } })}
          onToggleSection={(sectionId, collapsed) => patchSection.mutate({ sectionId, body: { collapsed } })}
          onDuplicateSection={(sectionId) => duplicateSection.mutate(sectionId)}
          onDeleteSection={(sectionId) => deleteSection.mutate(sectionId)}
          onAdd={(body) => addItem.mutate(body)}
          onPatch={(itemId, body) => patchItem.mutate({ itemId, body })}
          onDelete={(itemId) => deleteItem.mutate(itemId)}
          onReorder={(itemId, direction) => void reorderItem(itemId, direction)}
        />
      </div>

      <aside className="flex h-fit flex-col gap-3 xl:sticky xl:top-28">
        <QuoteSummaryAside
          currency={currency}
          vatPercent={vatPercent}
          subtotalNet={live.subtotal_net}
          vatAmount={live.vat_amount}
          totalGross={live.total_gross}
          discountAmount={live.quote_discount_amount}
          canViewCost={canViewCost}
          costTotal={live.cost_total}
          marginAmount={live.margin_amount}
          marginPercent={live.margin_percent}
          marginStatus={live.margin_status}
          marginTarget={live.margin_target}
          marginMinimum={live.margin_minimum}
          canOverrideMargin={canOverridePrice}
          hasMarginOverride={Boolean(live.margin_override_at)}
          onOverrideMargin={() => marginOverride.mutate()}
          pricedCount={pricedCount}
        />
        <div id="cpq-validation">
          <QuoteValidationPanel gaps={liveGaps} pricedCount={pricedCount} />
        </div>
        {live.id && (live.version ?? 1) > 1 ? (
          <RevisionComparePanel
            workspaceId={workspaceId}
            quoteId={live.id}
            currentVersion={live.version ?? 1}
          />
        ) : null}
        {live.id ? <QuoteAuditStrip workspaceId={workspaceId} quoteId={live.id} /> : null}
      </aside>

      <footer className="quote-builder-actions">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
          <p className="cpq-mobile-total me-auto text-base font-semibold tracking-tight">
            {formatMoney(live.total_gross, currency)}
          </p>
          {canEdit ? (
            <Button
              variant="secondary"
              loading={save.isPending}
              disabled={!live.id && !draftHasContent(draft)}
              onClick={() => save.mutate()}
            >
              {he.quoteSaveDraft}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            disabled={!live.id && !draftHasContent(draft)}
            onClick={() => void goCustomerView()}
          >
            {he.cpqCustomerView}
          </Button>
          {live.status === "draft" && canSend ? (
            <Button
              disabled={!canSendNow}
              onClick={async () => {
                if (!canSendNow) {
                  focusValidation();
                  setFormError(he.cpqSendBlockedHint(Math.max(missingCompleteness, 1)));
                  return;
                }
                skipRouteRef.current = true;
                try {
                  await save.mutateAsync();
                  setConfirmSend(true);
                } catch (err) {
                  setFormError(err instanceof ApiClientError ? err.message : he.quoteSaveError);
                } finally {
                  skipRouteRef.current = false;
                }
              }}
            >
              {he.quoteSaveAndSend}
            </Button>
          ) : null}
          {!canSendNow && live.status === "draft" && canSend ? (
            <p className="w-full text-xs text-fg-muted sm:w-auto">
              {he.cpqSendBlockedHint(Math.max(missingCompleteness, 1))}
            </p>
          ) : null}
          {live.status === "approved" ? <Status label={he.quoteApprovedState} tone="success" /> : null}
          {live.status === "approved" && linkedProject && canViewProjects ? (
            <Button
              variant="secondary"
              onClick={() => void navigate({ to: "/app/projects/$projectId", params: { projectId: linkedProject.id } })}
            >
              {he.workflowOpenProjectArrow}
            </Button>
          ) : null}
          {live.status === "approved" && !linkedProject && canCreateProject ? (
            <Button
              onClick={() => {
                setProjectError(null);
                setProjectDialog(true);
              }}
            >
              {he.workflowCreateProject}
            </Button>
          ) : null}
          {projectToast ? <p className="w-full text-xs text-success sm:w-auto">{he.projectCreatedToast}</p> : null}
        </div>
      </footer>

      <ProjectFromQuoteDialog
        open={projectDialog}
        onClose={() => {
          if (createProject.isPending) return;
          setProjectDialog(false);
          setProjectError(null);
        }}
        mode={linkedProject ? "exists" : "create"}
        quoteNumber={live.number}
        projectId={linkedProject?.id}
        siteId={live.site_id}
        creating={createProject.isPending}
        error={projectError}
        onCreate={() => createProject.mutate()}
      />

      <SystemBuilderDrawer
        open={systemBuilderOpen}
        onClose={() => setSystemBuilderOpen(false)}
        lead={linkedLead}
        catalog={systemCatalogQuery.data?.items ?? []}
        currency={currency}
        catalogLoading={systemCatalogQuery.isFetching}
        onRequestCatalog={requestSystemCatalog}
        onAddLines={(lines) => void addSystemBuilderLines(lines)}
      />
    </div>
  );
}

