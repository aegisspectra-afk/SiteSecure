import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { PdfDocumentTemplateOut } from "@site-secure/api-client";
import { PdfDocumentPreview } from "../../../components/pdf/PdfDocumentPreview";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { downloadAndOpenPdf } from "../../../lib/download-blob";
import { clampPdfZoom, formatZoomPercent, stepPdfZoom } from "../../../lib/pdf-preview";
import {
  configToApiPayload,
  readTemplateConfig,
  type PdfTemplateStatus,
  type QuoteTemplateConfig,
  type StudioSectionId,
} from "../../../lib/pdf-template-config";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/pdf-templates")({
  component: PdfTemplatesPage,
});

type MobileTab = "list" | "edit" | "preview";
type DraftState = { name: string; status: PdfTemplateStatus; config: QuoteTemplateConfig };

function PdfTemplatesPage() {
  return (
    <RequirePermission permission="workspace.edit">
      <PdfTemplatesBody />
    </RequirePermission>
  );
}

function formatUpdatedAt(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `${he.pdfTemplateUpdatedToday} ${time}`;
  return d.toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function sectionSummary(cfg: QuoteTemplateConfig, id: StudioSectionId): string {
  const bits: string[] = [];
  if (id === "branding") {
    if (cfg.useCompanyLogo) bits.push(he.pdfSecBrandLogo);
    if (cfg.useCompanyColors) bits.push(he.pdfSecBrandColors);
    if (cfg.overrideColors) bits.push(he.pdfSecBrandOverride);
  }
  if (id === "header") {
    if (cfg.useCompanyLogo) bits.push(he.pdfToggleLogo);
    if (cfg.headerCompany) bits.push(he.pdfToggleHeaderCompanyShort);
    if (cfg.showIssuedDate) bits.push(he.pdfToggleIssuedDate);
  }
  if (id === "customer") {
    if (cfg.showCustomer) bits.push(he.pdfToggleShowCustomer);
    if (cfg.showSite) bits.push(he.pdfToggleShowSite);
  }
  if (id === "lines") {
    if (cfg.showSku) bits.push(he.pdfToggleSku);
    if (cfg.showQty) bits.push(he.pdfToggleQty);
  }
  if (id === "totals") bits.push(he.pdfToggleGrandTotal);
  if (id === "terms") {
    if (cfg.showPaymentTerms) bits.push(he.pdfTogglePayment);
    if (cfg.showTechnicalNotes) bits.push(he.pdfToggleNotes);
  }
  if (id === "approval" && cfg.showCustomerSignature) bits.push(he.pdfToggleSignature);
  if (id === "footer" && cfg.footerPageNumber) bits.push(he.pdfToggleFooterPage);
  return bits.slice(0, 3).join(" · ") || he.pdfSecEmptySummary;
}

function Toggle({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="settings-toggle" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(ev) => onChange(ev.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function CollapsibleSection({
  id,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`pdf-studio-card${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="pdf-studio-card-head"
        aria-expanded={open}
        aria-controls={`sec-${id}`}
        onClick={onToggle}
      >
        <span className="pdf-studio-card-titles">
          <span className="pdf-studio-card-title">{title}</span>
          <span className="pdf-studio-card-summary">{summary}</span>
        </span>
        <span className="pdf-studio-card-chevron" aria-hidden>
          {open ? "⌃" : "⌄"}
        </span>
      </button>
      {open ? (
        <div id={`sec-${id}`} className="pdf-studio-card-body">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function PdfTemplatesBody() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [baseline, setBaseline] = useState<DraftState | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<StudioSectionId, boolean>>({
    branding: true,
    header: false,
    customer: false,
    lines: false,
    totals: false,
    terms: false,
    approval: false,
    footer: false,
  });
  const [mobileTab, setMobileTab] = useState<MobileTab>("list");
  const [zoom, setZoom] = useState(0.75);
  const [fitWidth, setFitWidth] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches,
  );
  const [effectiveZoom, setEffectiveZoom] = useState(0.75);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [previewFetching, setPreviewFetching] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewTimer = useRef<number | null>(null);
  const previewGen = useRef(0);
  const previewAbort = useRef<AbortController | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const query = useQuery({
    queryKey: ["pdf-templates", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listPdfTemplates(workspaceId!),
  });

  const companyQ = useQuery({
    queryKey: ["company-profile", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getCompanyProfile(workspaceId!),
  });

  const templates = query.data ?? [];
  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? templates.find((t) => t.status !== "archived") ?? templates[0] ?? null,
    [templates, selectedId],
  );

  const dirty = useMemo(() => {
    if (!draft || !baseline) return false;
    return JSON.stringify(draft) !== JSON.stringify(baseline);
  }, [draft, baseline]);

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      setBaseline(null);
      return;
    }
    setSelectedId(selected.id);
    const next: DraftState = {
      name: selected.name,
      status: selected.status as PdfTemplateStatus,
      config: readTemplateConfig(selected.config),
    };
    setDraft(next);
    setBaseline(next);
  }, [selected?.id, selected?.updated_at]);

  useEffect(() => {
    function onDocClick(ev: MouseEvent) {
      if (!menuRef.current?.contains(ev.target as Node)) setMenuOpenId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !selected || !draft) return;
      return api.patchPdfTemplate(workspaceId, selected.id, {
        name: draft.name,
        status: draft.status === "archived" ? "archived" : draft.status,
        config: configToApiPayload(draft.config),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pdf-templates", workspaceId] });
      if (draft) setBaseline(draft);
    },
  });

  const createTpl = useMutation({
    mutationFn: () =>
      api.createPdfTemplate(workspaceId!, {
        name: he.pdfTemplateNewName,
        doc_type: "quote",
        status: "draft",
        config: configToApiPayload(readTemplateConfig({})),
      }),
    onSuccess: async (tpl) => {
      await queryClient.invalidateQueries({ queryKey: ["pdf-templates", workspaceId] });
      if (tpl?.id) {
        setSelectedId(tpl.id);
        setMobileTab("edit");
      }
    },
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => api.duplicatePdfTemplate(workspaceId!, id),
    onSuccess: async (tpl) => {
      await queryClient.invalidateQueries({ queryKey: ["pdf-templates", workspaceId] });
      if (tpl?.id) setSelectedId(tpl.id);
      setMenuOpenId(null);
    },
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => api.patchPdfTemplate(workspaceId!, id, { is_default: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pdf-templates", workspaceId] });
      setMenuOpenId(null);
    },
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PdfTemplateStatus }) =>
      api.patchPdfTemplate(workspaceId!, id, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pdf-templates", workspaceId] });
      setMenuOpenId(null);
    },
  });

  function patchConfig(patch: Partial<QuoteTemplateConfig>) {
    if (!draft) return;
    setDraft({ ...draft, config: { ...draft.config, ...patch } });
  }

  function toggleSection(id: StudioSectionId) {
    setOpenSections((s) => ({ ...s, [id]: !s[id] }));
  }

  function discard() {
    if (baseline) setDraft(baseline);
  }

  const refreshPreview = useCallback(() => {
    if (!workspaceId || !selected || !draft) return;
    previewAbort.current?.abort();
    const ac = new AbortController();
    previewAbort.current = ac;
    const gen = ++previewGen.current;
    setPreviewFetching(true);
    setPreviewError(null);
    void (async () => {
      try {
        const { blob } = await api.previewPdfTemplate(
          workspaceId,
          selected.id,
          { name: draft.name, config: configToApiPayload(draft.config) },
          true,
          ac.signal,
        );
        if (gen !== previewGen.current) return;
        const buf = new Uint8Array(await blob.arrayBuffer());
        if (gen !== previewGen.current) return;
        setPdfBytes(buf);
        setPdfBlob(blob);
        setPreviewError(null);
        } catch {
          if (ac.signal.aborted || gen !== previewGen.current) return;
          setPreviewError(he.pdfTemplatePreviewError);
        } finally {
        if (gen === previewGen.current) setPreviewFetching(false);
      }
    })();
  }, [workspaceId, selected, draft, api]);

  // Live PDF preview (same renderer) — debounced; latest request wins
  useEffect(() => {
    if (!workspaceId || !selected || !draft) return;
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(() => refreshPreview(), 550);
    return () => {
      if (previewTimer.current) window.clearTimeout(previewTimer.current);
    };
  }, [workspaceId, selected?.id, draft?.name, draft?.config, refreshPreview]);

  useEffect(() => {
    return () => {
      previewAbort.current?.abort();
      previewGen.current += 1;
    };
  }, []);

  useEffect(() => {
    if (mobileTab === "preview") setFitWidth(true);
  }, [mobileTab]);

  const openPdf = useMutation({
    mutationFn: async () => {
      if (pdfBlob) return { blob: pdfBlob, filename: "SITE-SECURE-TEMPLATE-PREVIEW.pdf" };
      if (!workspaceId || !selected || !draft) throw new Error("missing");
      return api.previewPdfTemplate(workspaceId, selected.id, {
        name: draft.name,
        config: configToApiPayload(draft.config),
      });
    },
    onSuccess: ({ blob, filename }) => downloadAndOpenPdf(blob, filename),
  });

  const onEffectiveScaleChange = useCallback((s: number) => setEffectiveZoom(s), []);

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (query.isLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
  if (query.isError) return <ErrorState title={he.settingsError} />;

  const profile = (companyQ.data?.profile ?? {}) as Record<string, unknown>;
  const companyName = String(profile.displayName || profile.legalName || "");
  const hasLogo = Boolean(profile.logoStoragePath || profile.logoUrl);
  const missingCompany = (companyQ.data?.missing_for_quote?.length ?? 0) > 0 || !companyName;
  const missingAddress = !profile.addressLine1;
  const missingBn = !profile.businessNumber;

  function renderMenu(tpl: PdfDocumentTemplateOut) {
    const open = menuOpenId === tpl.id;
    return (
      <div className="pdf-studio-menu" ref={open ? menuRef : undefined}>
        <button
          type="button"
          className="pdf-studio-menu-btn"
          aria-label={he.pdfTemplateMoreActions}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={(ev) => {
            ev.stopPropagation();
            setMenuOpenId(open ? null : tpl.id);
          }}
        >
          ⋯
        </button>
        {open ? (
          <ul className="pdf-studio-menu-list" role="menu">
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setSelectedId(tpl.id);
                  setMobileTab("edit");
                  setMenuOpenId(null);
                }}
              >
                {he.pdfTemplateEdit}
              </button>
            </li>
            <li role="none">
              <button type="button" role="menuitem" onClick={() => duplicate.mutate(tpl.id)} disabled={duplicate.isPending}>
                {he.pdfTemplateDuplicate}
              </button>
            </li>
            {tpl.doc_type === "quote" && !tpl.is_default && tpl.status !== "archived" ? (
              <li role="none">
                <button type="button" role="menuitem" onClick={() => setDefault.mutate(tpl.id)} disabled={setDefault.isPending}>
                  {he.pdfTemplateSetDefault}
                </button>
              </li>
            ) : null}
            {tpl.status === "active" ? (
              <li role="none">
                <button type="button" role="menuitem" onClick={() => setStatus.mutate({ id: tpl.id, status: "draft" })}>
                  {he.pdfTemplateDeactivate}
                </button>
              </li>
            ) : tpl.status === "draft" ? (
              <li role="none">
                <button type="button" role="menuitem" onClick={() => setStatus.mutate({ id: tpl.id, status: "active" })}>
                  {he.pdfTemplateActivate}
                </button>
              </li>
            ) : null}
            {tpl.status !== "archived" ? (
              <li role="none">
                <button type="button" role="menuitem" onClick={() => setStatus.mutate({ id: tpl.id, status: "archived" })}>
                  {he.pdfTemplateArchive}
                </button>
              </li>
            ) : (
              <li role="none">
                <button type="button" role="menuitem" onClick={() => setStatus.mutate({ id: tpl.id, status: "draft" })}>
                  {he.pdfTemplateRestore}
                </button>
              </li>
            )}
          </ul>
        ) : null}
      </div>
    );
  }

  const listPanel = (
    <section className="pdf-studio-list" aria-label={he.pdfTemplatesListAria}>
      <ul className="pdf-studio-items">
        {templates.map((tpl) => {
          const active = selected?.id === tpl.id;
          return (
            <li key={tpl.id} className={`pdf-studio-item${active ? " is-active" : ""}`}>
              <button
                type="button"
                className="pdf-studio-item-main"
                onClick={() => {
                  setSelectedId(tpl.id);
                  setMobileTab("edit");
                }}
                aria-pressed={active}
              >
                <span className="pdf-studio-item-name">{tpl.name}</span>
                <span className="pdf-studio-item-meta">
                  {he.pdfTemplateTypes[tpl.doc_type]} · {he.pdfTemplateStatuses[tpl.status as PdfTemplateStatus] ?? tpl.status}
                </span>
                <span className="pdf-studio-item-flags">
                  {tpl.is_default ? <span className="pdf-studio-badge">{he.pdfTemplateDefault}</span> : null}
                  <span className="pdf-studio-updated">{formatUpdatedAt(tpl.updated_at)}</span>
                </span>
              </button>
              {renderMenu(tpl)}
            </li>
          );
        })}
      </ul>
    </section>
  );

  const editorPanel =
    selected && draft ? (
      <section className="pdf-studio-editor" aria-labelledby="pdf-editor-heading">
        <div className="pdf-studio-editor-head">
          <h2 id="pdf-editor-heading" className="sr-only">
            {he.pdfTemplateEditor}
          </h2>
          <Input
            id="pdf-name"
            label={he.pdfTemplateName}
            value={draft.name}
            onChange={(ev) => setDraft({ ...draft, name: ev.target.value })}
          />
          <div className="settings-field-grid pdf-studio-meta-grid">
            <label className="settings-field-block">
              <span className="settings-field-label">{he.pdfTemplateType}</span>
              <input
                className="settings-select"
                value={he.pdfTemplateTypes[selected.doc_type]}
                readOnly
                aria-readonly="true"
                title={he.pdfTemplateTypeLocked}
              />
            </label>
            <label className="settings-field-block">
              <span className="settings-field-label">{he.pdfTemplateStatus}</span>
              <select
                className="settings-select"
                value={draft.status}
                onChange={(ev) => setDraft({ ...draft, status: ev.target.value as PdfTemplateStatus })}
              >
                <option value="active">{he.pdfTemplateStatuses.active}</option>
                <option value="draft">{he.pdfTemplateStatuses.draft}</option>
                <option value="archived">{he.pdfTemplateStatuses.archived}</option>
              </select>
            </label>
          </div>
          {selected.is_default && dirty ? (
            <p className="settings-banner-warn" role="status">
              {he.pdfTemplateActiveDirtyHint}
            </p>
          ) : null}
          {missingCompany || missingAddress || missingBn ? (
            <div className="settings-banner-warn" role="status">
              <strong>{he.companyMissingForPdf}</strong>
              <p className="settings-hint">{he.pdfCompanyMissingHint}</p>
              <Link to="/app/settings/company" className="settings-inline-link">
                {he.pdfCompleteCompanyCta}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="pdf-studio-sections">
          <CollapsibleSection
            id="branding"
            title={he.pdfSecBranding}
            summary={sectionSummary(draft.config, "branding")}
            open={openSections.branding}
            onToggle={() => toggleSection("branding")}
          >
            <Toggle
              id="use-logo"
              label={he.pdfUseCompanyLogo}
              checked={draft.config.useCompanyLogo}
              onChange={(v) => patchConfig({ useCompanyLogo: v, showLogo: v, headerLogo: v })}
            />
            <div className="pdf-studio-logo-box">
              {hasLogo ? (
                <p className="settings-hint">{he.pdfCompanyLogoConfigured}</p>
              ) : (
                <p className="settings-hint">{he.pdfNoCompanyLogo}</p>
              )}
              <Link to="/app/settings/company" className="settings-inline-link">
                {he.pdfGotoCompanyBranding}
              </Link>
            </div>
            <Toggle
              id="use-colors"
              label={he.pdfUseCompanyColors}
              checked={draft.config.useCompanyColors && !draft.config.overrideColors}
              onChange={(v) => patchConfig({ useCompanyColors: true, overrideColors: !v })}
            />
            <Toggle
              id="override-colors"
              label={he.pdfOverrideColors}
              checked={draft.config.overrideColors}
              onChange={(v) => patchConfig({ overrideColors: v, useCompanyColors: !v })}
            />
            {draft.config.overrideColors ? (
              <div className="settings-field-grid">
                <label className="settings-field-block">
                  <span className="settings-field-label">{he.pdfTemplatePrimaryColor}</span>
                  <input
                    type="color"
                    className="settings-color"
                    value={draft.config.primaryColor}
                    onChange={(ev) => patchConfig({ primaryColor: ev.target.value })}
                  />
                </label>
                <label className="settings-field-block">
                  <span className="settings-field-label">{he.pdfTemplateSecondaryColor}</span>
                  <input
                    type="color"
                    className="settings-color"
                    value={draft.config.secondaryColor}
                    onChange={(ev) => patchConfig({ secondaryColor: ev.target.value })}
                  />
                </label>
              </div>
            ) : null}
          </CollapsibleSection>

          <CollapsibleSection
            id="header"
            title={he.pdfSecHeader}
            summary={sectionSummary(draft.config, "header")}
            open={openSections.header}
            onToggle={() => toggleSection("header")}
          >
            <Toggle id="h-logo" label={he.pdfToggleLogo} checked={draft.config.useCompanyLogo} onChange={(v) => patchConfig({ useCompanyLogo: v, showLogo: v, headerLogo: v })} />
            <Toggle id="h-co" label={he.pdfToggleHeaderCompanyShort} checked={draft.config.headerCompany} onChange={(v) => patchConfig({ headerCompany: v })} />
            <Toggle id="h-bn" label={he.pdfToggleBusinessNumber} checked={draft.config.showBusinessNumber} onChange={(v) => patchConfig({ showBusinessNumber: v })} />
            <Toggle id="h-addr" label={he.pdfToggleAddress} checked={draft.config.showCompanyAddress} onChange={(v) => patchConfig({ showCompanyAddress: v })} />
            <Toggle id="h-contact" label={he.pdfToggleHeaderContactShort} checked={draft.config.headerContact} onChange={(v) => patchConfig({ headerContact: v })} />
            <Toggle id="h-date" label={he.pdfToggleIssuedDate} checked={draft.config.showIssuedDate} onChange={(v) => patchConfig({ showIssuedDate: v })} />
            {selected.doc_type === "quote" ? (
              <Toggle id="h-valid" label={he.pdfToggleValidity} checked={draft.config.showQuoteValidity} onChange={(v) => patchConfig({ showQuoteValidity: v })} />
            ) : null}
          </CollapsibleSection>

          <CollapsibleSection
            id="customer"
            title={he.pdfSecCustomer}
            summary={sectionSummary(draft.config, "customer")}
            open={openSections.customer}
            onToggle={() => toggleSection("customer")}
          >
            <Toggle
              id="c-cust"
              label={he.pdfToggleShowCustomer}
              checked={draft.config.showCustomer}
              onChange={(v) => patchConfig({ showCustomer: v, bodyCustomerSite: v || draft.config.showSite })}
            />
            <Toggle id="c-contact" label={he.pdfToggleCustomerContact} checked={draft.config.showCustomerContact} onChange={(v) => patchConfig({ showCustomerContact: v })} />
            <Toggle id="c-bn" label={he.pdfToggleCustomerBn} checked={draft.config.showCustomerBusinessNumber} onChange={(v) => patchConfig({ showCustomerBusinessNumber: v })} />
            <Toggle
              id="c-site"
              label={he.pdfToggleShowSite}
              checked={draft.config.showSite}
              onChange={(v) => patchConfig({ showSite: v, bodyCustomerSite: draft.config.showCustomer || v })}
            />
            <Toggle id="c-site-addr" label={he.pdfToggleSiteAddress} checked={draft.config.showSiteAddress} onChange={(v) => patchConfig({ showSiteAddress: v })} />
          </CollapsibleSection>

          <CollapsibleSection
            id="lines"
            title={he.pdfSecLines}
            summary={sectionSummary(draft.config, "lines")}
            open={openSections.lines}
            onToggle={() => toggleSection("lines")}
          >
            <Toggle id="l-sec" label={he.pdfToggleSections} checked={draft.config.showSections} onChange={(v) => patchConfig({ showSections: v })} />
            <Toggle id="l-sku" label={he.pdfToggleSku} checked={draft.config.showSku} onChange={(v) => patchConfig({ showSku: v })} />
            <Toggle id="l-qty" label={he.pdfToggleQty} checked={draft.config.showQty} onChange={(v) => patchConfig({ showQty: v })} />
            <Toggle id="l-unit" label={he.pdfToggleUnitPrice} checked={draft.config.showUnitPrice} onChange={(v) => patchConfig({ showUnitPrice: v })} />
            <Toggle id="l-disc" label={he.pdfToggleDiscountCol} checked={draft.config.showDiscountCol} onChange={(v) => patchConfig({ showDiscountCol: v })} />
            <Toggle id="l-total" label={he.pdfToggleLineTotal} checked={true} disabled onChange={() => undefined} />
          </CollapsibleSection>

          <CollapsibleSection
            id="totals"
            title={he.pdfSecTotals}
            summary={sectionSummary(draft.config, "totals")}
            open={openSections.totals}
            onToggle={() => toggleSection("totals")}
          >
            <Toggle id="t-sub" label={he.pdfToggleSubtotal} checked={draft.config.showSubtotal} onChange={(v) => patchConfig({ showSubtotal: v })} />
            <Toggle id="t-disc" label={he.pdfToggleDiscountTotal} checked={draft.config.showDiscountTotal} onChange={(v) => patchConfig({ showDiscountTotal: v })} />
            <Toggle id="t-vat" label={he.pdfToggleVat} checked={draft.config.showVat} onChange={(v) => patchConfig({ showVat: v })} />
            <Toggle id="t-grand" label={he.pdfToggleGrandTotal} checked={true} disabled onChange={() => undefined} />
            <p className="settings-hint">{he.pdfTotalsServerHint}</p>
          </CollapsibleSection>

          <CollapsibleSection
            id="terms"
            title={he.pdfSecTerms}
            summary={sectionSummary(draft.config, "terms")}
            open={openSections.terms}
            onToggle={() => toggleSection("terms")}
          >
            <Toggle id="tm-pay" label={he.pdfTogglePayment} checked={draft.config.showPaymentTerms} onChange={(v) => patchConfig({ showPaymentTerms: v, footerPayment: v })} />
            <Toggle id="tm-bank" label={he.pdfToggleBank} checked={draft.config.showBankDetails} onChange={(v) => patchConfig({ showBankDetails: v })} />
            <Toggle id="tm-notes" label={he.pdfToggleNotes} checked={draft.config.showTechnicalNotes} onChange={(v) => patchConfig({ showTechnicalNotes: v, footerNotes: v })} />
            <label className="settings-field-block">
              <span className="settings-field-label">{he.settingsPaymentTerms}</span>
              <textarea
                className="settings-textarea"
                rows={2}
                value={draft.config.paymentTerms}
                onChange={(ev) => patchConfig({ paymentTerms: ev.target.value })}
              />
              <span className="settings-hint">{he.pdfDefaultsInheritanceHint}</span>
            </label>
            <label className="settings-field-block">
              <span className="settings-field-label">{he.settingsPdfNotes}</span>
              <textarea
                className="settings-textarea"
                rows={3}
                value={draft.config.notes}
                onChange={(ev) => patchConfig({ notes: ev.target.value })}
              />
            </label>
          </CollapsibleSection>

          <CollapsibleSection
            id="approval"
            title={he.pdfSecApproval}
            summary={sectionSummary(draft.config, "approval")}
            open={openSections.approval}
            onToggle={() => toggleSection("approval")}
          >
            <Toggle
              id="a-sig"
              label={he.pdfToggleSignature}
              checked={draft.config.showCustomerSignature}
              onChange={(v) => patchConfig({ showCustomerSignature: v, footerSignature: v })}
            />
          </CollapsibleSection>

          <CollapsibleSection
            id="footer"
            title={he.pdfSecFooter}
            summary={sectionSummary(draft.config, "footer")}
            open={openSections.footer}
            onToggle={() => toggleSection("footer")}
          >
            <Toggle id="f-id" label={he.pdfToggleFooterIdentity} checked={draft.config.footerCompanyIdentity} onChange={(v) => patchConfig({ footerCompanyIdentity: v })} />
            <Toggle id="f-page" label={he.pdfToggleFooterPage} checked={draft.config.footerPageNumber} onChange={(v) => patchConfig({ footerPageNumber: v })} />
          </CollapsibleSection>
        </div>

        <div className="pdf-studio-actionbar" role="region" aria-label={he.pdfTemplateSaveBar}>
          <span className="pdf-studio-dirty" aria-live="polite">
            {dirty ? he.pdfTemplateUnsaved : he.pdfTemplateSavedClean}
          </span>
          <div className="pdf-studio-actionbar-btns">
            <Button type="button" variant="secondary" disabled={!dirty || save.isPending} onClick={discard}>
              {he.pdfTemplateDiscard}
            </Button>
            <Button type="button" variant="primary" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
              {he.pdfTemplateSave}
            </Button>
          </div>
        </div>
      </section>
    ) : (
      <p className="text-sm text-fg-muted">{he.pdfTemplatesEmpty}</p>
    );

  const previewPanel = (
    <section className="pdf-studio-preview" aria-label={he.pdfTemplatePreviewAria}>
      <div className="pdf-studio-preview-toolbar">
        <h2 className="settings-section-title">{he.pdfTemplatePreview}</h2>
        <div className="pdf-studio-zoom" role="group" aria-label={he.pdfTemplateZoomAria}>
          <button
            type="button"
            className="settings-text-btn"
            aria-label={he.pdfTemplateZoomOut}
            onClick={() => {
              setFitWidth(false);
              setZoom((z) => stepPdfZoom(fitWidth ? effectiveZoom : z, -1));
            }}
          >
            −
          </button>
          <span className="ltr-meta" aria-live="polite">
            {formatZoomPercent(fitWidth ? effectiveZoom : zoom)}
          </span>
          <button
            type="button"
            className="settings-text-btn"
            aria-label={he.pdfTemplateZoomIn}
            onClick={() => {
              setFitWidth(false);
              setZoom((z) => stepPdfZoom(fitWidth ? effectiveZoom : z, 1));
            }}
          >
            +
          </button>
          <button
            type="button"
            className={`settings-text-btn${fitWidth ? " is-active" : ""}`}
            onClick={() => {
              setFitWidth(true);
              setZoom(clampPdfZoom(effectiveZoom));
            }}
          >
            {he.pdfTemplateFitWidth}
          </button>
        </div>
        <Button type="button" variant="secondary" loading={openPdf.isPending} onClick={() => openPdf.mutate()}>
          {he.pdfTemplatePreviewReal}
        </Button>
      </div>
      <div className="pdf-studio-demo-meta">
        <span className="pdf-studio-demo-badge">{he.pdfDemoDataBadge}</span>
        <span className="pdf-studio-demo-hint">{he.pdfPreviewBrandingHint}</span>
      </div>
      <PdfDocumentPreview
        data={pdfBytes}
        scale={zoom}
        fitWidth={fitWidth}
        updating={previewFetching && Boolean(pdfBytes)}
        fetchError={previewError}
        title={he.pdfTemplatePreview}
        preparingLabel={he.pdfPreviewPreparing}
        errorTitle={he.pdfPreviewRenderError}
        errorHint={he.pdfPreviewRenderRetryHint}
        retryLabel={he.pdfPreviewRetry}
        onRetry={refreshPreview}
        onEffectiveScaleChange={onEffectiveScaleChange}
      />
    </section>
  );

  return (
    <div className="settings-panel pdf-studio">
      <div className="pdf-studio-page-head">
        <PageHeader title={he.pdfTemplatesTitle} description={he.pdfTemplatesLead} />
        <Button type="button" variant="primary" loading={createTpl.isPending} onClick={() => createTpl.mutate()}>
          {he.pdfTemplateNew}
        </Button>
      </div>

      <div className="pdf-studio-mobile-tabs" role="tablist" aria-label={he.pdfStudioTabsAria}>
        {(
          [
            ["list", he.pdfTemplatesList],
            ["edit", he.pdfTemplateEditor],
            ["preview", he.pdfTemplatePreview],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mobileTab === id}
            className={`pdf-studio-tab${mobileTab === id ? " is-active" : ""}`}
            onClick={() => setMobileTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="pdf-studio-layout">
        <div className={`pdf-studio-col pdf-studio-col-list${mobileTab === "list" ? " is-mobile-active" : ""}`}>{listPanel}</div>
        <div className={`pdf-studio-col pdf-studio-col-edit${mobileTab === "edit" ? " is-mobile-active" : ""}`}>{editorPanel}</div>
        <div className={`pdf-studio-col pdf-studio-col-preview${mobileTab === "preview" ? " is-mobile-active" : ""}`}>{previewPanel}</div>
      </div>
    </div>
  );
}
