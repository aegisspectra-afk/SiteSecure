import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { PdfDocumentTemplateOut } from "@site-secure/api-client";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { downloadAndOpenPdf } from "../../../lib/download-blob";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/pdf-templates")({
  component: PdfTemplatesPage,
});

type PdfConfig = {
  primaryColor: string;
  secondaryColor: string;
  showLogo: boolean;
  showCompanyAddress: boolean;
  showPaymentTerms: boolean;
  showTechnicalNotes: boolean;
  showCustomerSignature: boolean;
  showQuoteValidity: boolean;
  headerCompany: boolean;
  headerContact: boolean;
  headerLogo: boolean;
  bodyCustomerSite: boolean;
  bodyLineItems: boolean;
  bodyTotals: boolean;
  footerPayment: boolean;
  footerNotes: boolean;
  footerSignature: boolean;
  footerPageNumber: boolean;
  notes: string;
  paymentTerms: string;
};

const DEFAULT_CONFIG: PdfConfig = {
  primaryColor: "#0b6bcb",
  secondaryColor: "#0f172a",
  showLogo: true,
  showCompanyAddress: true,
  showPaymentTerms: true,
  showTechnicalNotes: true,
  showCustomerSignature: true,
  showQuoteValidity: true,
  headerCompany: true,
  headerContact: true,
  headerLogo: true,
  bodyCustomerSite: true,
  bodyLineItems: true,
  bodyTotals: true,
  footerPayment: true,
  footerNotes: true,
  footerSignature: true,
  footerPageNumber: true,
  notes: "",
  paymentTerms: "שוטף + 30",
};

function readConfig(tpl: PdfDocumentTemplateOut): PdfConfig {
  const c = tpl.config ?? {};
  return {
    ...DEFAULT_CONFIG,
    ...Object.fromEntries(
      Object.keys(DEFAULT_CONFIG).map((key) => [key, (c as Record<string, unknown>)[key] ?? DEFAULT_CONFIG[key as keyof PdfConfig]]),
    ),
  } as PdfConfig;
}

function PdfTemplatesPage() {
  return (
    <RequirePermission permission="workspace.edit">
      <PdfTemplatesBody />
    </RequirePermission>
  );
}

function PdfTemplatesBody() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; status: "active" | "draft"; config: PdfConfig } | null>(
    null,
  );

  const query = useQuery({
    queryKey: ["pdf-templates", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listPdfTemplates(workspaceId!),
  });

  const templates = query.data ?? [];
  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? templates[0] ?? null,
    [templates, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setDraft(null);
      return;
    }
    setSelectedId(selected.id);
    setDraft({
      name: selected.name,
      status: selected.status,
      config: readConfig(selected),
    });
  }, [selected?.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !selected || !draft) return;
      return api.patchPdfTemplate(workspaceId, selected.id, {
        name: draft.name,
        status: draft.status,
        config: draft.config,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pdf-templates", workspaceId] });
    },
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => api.duplicatePdfTemplate(workspaceId!, id),
    onSuccess: async (tpl) => {
      await queryClient.invalidateQueries({ queryKey: ["pdf-templates", workspaceId] });
      if (tpl?.id) setSelectedId(tpl.id);
    },
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => api.patchPdfTemplate(workspaceId!, id, { is_default: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pdf-templates", workspaceId] });
    },
  });

  const previewPdf = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !selected || !draft) throw new Error("missing");
      return api.previewPdfTemplate(workspaceId, selected.id, {
        name: draft.name,
        config: draft.config,
      });
    },
    onSuccess: ({ blob, filename }) => {
      downloadAndOpenPdf(blob, filename);
    },
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (query.isLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
  if (query.isError) return <ErrorState title={he.settingsError} />;
  if (!selected || !draft) {
    return (
      <div className="settings-panel">
        <PageHeader title={he.settingsNavPdf} description={he.pdfTemplatesLead} />
        <p className="text-sm text-fg-muted">{he.pdfTemplatesEmpty}</p>
      </div>
    );
  }

  const cfg = draft.config;

  return (
    <div className="settings-panel flex flex-col gap-5">
      <PageHeader title={he.settingsNavPdf} description={he.pdfTemplatesLead} />

      <div className="pdf-tpl-layout">
        <section className="pdf-tpl-list" aria-label={he.pdfTemplatesListAria}>
          <h2 className="settings-section-title">{he.pdfTemplatesList}</h2>
          <ul className="pdf-tpl-items">
            {templates.map((tpl) => {
              const active = tpl.id === selected.id;
              return (
                <li key={tpl.id}>
                  <button
                    type="button"
                    className={`pdf-tpl-item${active ? " is-active" : ""}`}
                    onClick={() => setSelectedId(tpl.id)}
                    aria-pressed={active}
                  >
                    <span className="pdf-tpl-item-name">{tpl.name}</span>
                    <span className="pdf-tpl-item-meta">
                      {he.pdfTemplateTypes[tpl.doc_type]} · {he.pdfTemplateStatuses[tpl.status]}
                      {tpl.is_default ? ` · ${he.pdfTemplateDefault}` : ""}
                    </span>
                  </button>
                  <div className="pdf-tpl-item-actions">
                    <button type="button" className="settings-text-btn" onClick={() => setSelectedId(tpl.id)}>
                      {he.pdfTemplateEdit}
                    </button>
                    <button
                      type="button"
                      className="settings-text-btn"
                      onClick={() => duplicate.mutate(tpl.id)}
                      disabled={duplicate.isPending}
                    >
                      {he.pdfTemplateDuplicate}
                    </button>
                    {tpl.doc_type === "quote" ? (
                      <button
                        type="button"
                        className="settings-text-btn"
                        onClick={() => setDefault.mutate(tpl.id)}
                        disabled={tpl.is_default || setDefault.isPending}
                      >
                        {he.pdfTemplateSetDefault}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="pdf-tpl-editor" aria-labelledby="pdf-editor-heading">
          <h2 id="pdf-editor-heading" className="settings-section-title">
            {he.pdfTemplateEditor}
          </h2>
          <div className="settings-field-grid">
            <Input
              id="pdf-name"
              label={he.pdfTemplateName}
              value={draft.name}
              onChange={(ev) => setDraft({ ...draft, name: ev.target.value })}
            />
            <label className="settings-field-block">
              <span className="settings-field-label">{he.pdfTemplateStatus}</span>
              <select
                className="settings-select"
                value={draft.status}
                onChange={(ev) =>
                  setDraft({ ...draft, status: ev.target.value as "active" | "draft" })
                }
              >
                <option value="active">{he.pdfTemplateStatuses.active}</option>
                <option value="draft">{he.pdfTemplateStatuses.draft}</option>
              </select>
            </label>
            <label className="settings-field-block">
              <span className="settings-field-label">{he.pdfTemplateLogo}</span>
              <input type="file" accept="image/*" className="settings-file" disabled title={he.pdfTemplateLogoSoon} />
              <span className="settings-field-hint">{he.pdfTemplateLogoSoon}</span>
            </label>
            <label className="settings-field-block">
              <span className="settings-field-label">{he.pdfTemplatePrimaryColor}</span>
              <input
                type="color"
                className="settings-color"
                value={cfg.primaryColor}
                onChange={(ev) => setDraft({ ...draft, config: { ...cfg, primaryColor: ev.target.value } })}
              />
            </label>
            <label className="settings-field-block">
              <span className="settings-field-label">{he.pdfTemplateSecondaryColor}</span>
              <input
                type="color"
                className="settings-color"
                value={cfg.secondaryColor}
                onChange={(ev) => setDraft({ ...draft, config: { ...cfg, secondaryColor: ev.target.value } })}
              />
            </label>
          </div>

          <div className="pdf-tpl-toggles">
            <p className="settings-section-title">{he.pdfTemplateSections}</p>
            {(
              [
                ["showLogo", he.pdfToggleLogo],
                ["showCompanyAddress", he.pdfToggleAddress],
                ["showPaymentTerms", he.pdfTogglePayment],
                ["showTechnicalNotes", he.pdfToggleNotes],
                ["showCustomerSignature", he.pdfToggleSignature],
                ["showQuoteValidity", he.pdfToggleValidity],
                ["headerCompany", he.pdfToggleHeaderCompany],
                ["headerContact", he.pdfToggleHeaderContact],
                ["headerLogo", he.pdfToggleHeaderLogo],
                ["bodyCustomerSite", he.pdfToggleBodyCustomer],
                ["bodyLineItems", he.pdfToggleBodyLines],
                ["bodyTotals", he.pdfToggleBodyTotals],
                ["footerPayment", he.pdfToggleFooterPayment],
                ["footerNotes", he.pdfToggleFooterNotes],
                ["footerSignature", he.pdfToggleFooterSignature],
                ["footerPageNumber", he.pdfToggleFooterPage],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="settings-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(cfg[key])}
                  onChange={(ev) => setDraft({ ...draft, config: { ...cfg, [key]: ev.target.checked } })}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <label className="settings-field-block">
            <span className="settings-field-label">{he.settingsPaymentTerms}</span>
            <textarea
              className="settings-textarea"
              rows={2}
              value={cfg.paymentTerms}
              onChange={(ev) => setDraft({ ...draft, config: { ...cfg, paymentTerms: ev.target.value } })}
            />
          </label>
          <label className="settings-field-block">
            <span className="settings-field-label">{he.settingsPdfNotes}</span>
            <textarea
              className="settings-textarea"
              rows={3}
              value={cfg.notes}
              onChange={(ev) => setDraft({ ...draft, config: { ...cfg, notes: ev.target.value } })}
            />
          </label>

          <Button type="button" variant="primary" className="self-start" loading={save.isPending} onClick={() => save.mutate()}>
            {he.saveSettings}
          </Button>
        </section>

        <section className="pdf-tpl-preview" aria-label={he.pdfTemplatePreviewAria}>
          <div className="pdf-tpl-preview-toolbar">
            <h2 className="settings-section-title">{he.pdfTemplatePreview}</h2>
            <Button
              type="button"
              variant="primary"
              loading={previewPdf.isPending}
              onClick={() => previewPdf.mutate()}
            >
              {he.pdfTemplatePreviewReal}
            </Button>
          </div>
          <div
            className="pdf-a4"
            style={{
              ["--pdf-accent" as string]: cfg.primaryColor,
              ["--pdf-ink" as string]: cfg.secondaryColor,
            }}
          >
            <header className="pdf-a4-header">
              {cfg.headerLogo && cfg.showLogo ? <div className="pdf-a4-logo">{he.brand}</div> : null}
              <div className="pdf-a4-company">
                {cfg.headerCompany ? <p className="pdf-a4-company-name">אגיס מערכות</p> : null}
                {cfg.showCompanyAddress ? <p>רח׳ התעשייה 12, ראשון לציון</p> : null}
                {cfg.headerContact ? <p className="ltr-meta">03-555-0100 · office@aegis.demo</p> : null}
              </div>
            </header>
            <p className="pdf-a4-title">
              {selected.doc_type === "quote"
                ? "הצעת מחיר Q-00124"
                : selected.doc_type === "service"
                  ? "דוח שירות S-00018"
                  : "סיכום פרויקט P-00007"}
            </p>
            {cfg.bodyCustomerSite ? (
              <div className="pdf-a4-block">
                <p>לקוח: חברת נוף טכנולוגיות בע״מ</p>
                <p>אתר: קניון הזהב · קומת חניה B2</p>
                {cfg.showQuoteValidity && selected.doc_type === "quote" ? <p>תוקף הצעה: 14 ימים</p> : null}
              </div>
            ) : null}
            {cfg.bodyLineItems ? (
              <table className="pdf-a4-table">
                <thead>
                  <tr>
                    <th>פריט</th>
                    <th>כמות</th>
                    <th>סכום</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>מצלמת IP 4MP</td>
                    <td className="ltr-meta">12</td>
                    <td className="ltr-meta">₪14,400</td>
                  </tr>
                  <tr>
                    <td>NVR 16CH</td>
                    <td className="ltr-meta">1</td>
                    <td className="ltr-meta">₪3,900</td>
                  </tr>
                </tbody>
              </table>
            ) : null}
            {cfg.bodyTotals ? (
              <div className="pdf-a4-totals ltr-meta">
                <p>לפני מע״מ · ₪18,300</p>
                <p className="pdf-a4-total">סה״כ · ₪21,594</p>
              </div>
            ) : null}
            {cfg.footerPayment && cfg.showPaymentTerms && cfg.paymentTerms ? (
              <p className="pdf-a4-foot">{cfg.paymentTerms}</p>
            ) : null}
            {cfg.footerNotes && cfg.showTechnicalNotes && cfg.notes ? (
              <p className="pdf-a4-foot">{cfg.notes}</p>
            ) : null}
            {cfg.footerSignature && cfg.showCustomerSignature ? (
              <div className="pdf-a4-sign">
                <span>חתימת לקוח</span>
                <span className="pdf-a4-sign-line" />
              </div>
            ) : null}
            {cfg.footerPageNumber ? <p className="pdf-a4-page">1 / 1</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
