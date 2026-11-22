import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import {
  DEFAULT_WORKSPACE_PREFS,
  prefsFromSettings,
  type WorkspacePrefs,
} from "../../../lib/workspace-prefs";
import { useSession } from "../../../lib/session";
import { normalizeLaborRate } from "../../../lib/cctv-labor";

export const Route = createFileRoute("/app/settings/quotes")({
  component: QuotesSettingsPage,
});

function QuotesSettingsPage() {
  return (
    <RequirePermission permission="workspace.edit">
      <QuotesSettingsBody />
    </RequirePermission>
  );
}

function QuotesSettingsBody() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState<WorkspacePrefs>(DEFAULT_WORKSPACE_PREFS);
  const [baseline, setBaseline] = useState<WorkspacePrefs | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Q2.6: hourly labor rate (empty = not set; service lines stay unpriced). */
  const [laborRate, setLaborRate] = useState("");
  const [laborBaseline, setLaborBaseline] = useState("");
  const laborInvalid = laborRate.trim() !== "" && normalizeLaborRate(laborRate) == null;

  const query = useQuery({
    queryKey: ["workspace-settings", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getWorkspaceSettings(workspaceId!),
  });

  useEffect(() => {
    if (!query.data) return;
    const next = prefsFromSettings(query.data);
    setPrefs(next);
    setBaseline(next);
    const rate = normalizeLaborRate((query.data.quotes as Record<string, unknown> | undefined)?.labor_hourly_rate);
    setLaborRate(rate != null ? String(rate) : "");
    setLaborBaseline(rate != null ? String(rate) : "");
  }, [query.data]);

  const dirty =
    baseline != null &&
    (prefs.quoteValidityDays !== baseline.quoteValidityDays ||
      prefs.paymentTerms !== baseline.paymentTerms ||
      prefs.defaultWarranty !== baseline.defaultWarranty ||
      prefs.defaultGeneralTerms !== baseline.defaultGeneralTerms ||
      prefs.defaultCustomerNotes !== baseline.defaultCustomerNotes ||
      prefs.showVatOnQuotes !== baseline.showVatOnQuotes ||
      prefs.pdfNotes !== baseline.pdfNotes ||
      prefs.marginMinimumPercent !== baseline.marginMinimumPercent ||
      prefs.marginTargetPercent !== baseline.marginTargetPercent ||
      laborRate.trim() !== laborBaseline);

  const save = useMutation({
    mutationFn: async () => {
      await api.patchWorkspaceSettings(workspaceId!, {
        quotes: {
          validity_days: prefs.quoteValidityDays,
          show_vat: prefs.showVatOnQuotes,
          payment_terms: prefs.paymentTerms,
          warranty: prefs.defaultWarranty,
          general_terms: prefs.defaultGeneralTerms,
          customer_notes: prefs.defaultCustomerNotes,
          terms_templates: prefs.termsTemplates,
          pdf_notes: prefs.pdfNotes,
          margin_minimum: prefs.marginMinimumPercent,
          margin_target: prefs.marginTargetPercent,
        },
      });
      if (laborRate.trim() !== laborBaseline) {
        await api.putLaborRate(workspaceId!, laborRate.trim() ? normalizeLaborRate(laborRate) : null);
      }
    },
    onSuccess: async () => {
      setSaveError(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
      await queryClient.invalidateQueries({ queryKey: ["workspace-settings", workspaceId] });
      setBaseline(prefs);
      setLaborBaseline(laborRate.trim());
    },
    onError: () => setSaveError(he.settingsError),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (query.isLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
  if (query.isError) return <ErrorState title={he.settingsError} />;

  return (
    <div className="settings-panel flex flex-col gap-6">
      <PageHeader title={he.settingsNavQuotes} description={he.settingsQuotesLead} />
      <p className="settings-section-lead">{he.settingsQuotesApplyHint}</p>
      <form
        className="settings-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (!dirty) return;
          save.mutate();
        }}
      >
        <div className="settings-field-grid">
          <Input
            id="quote-validity"
            label={he.settingsQuoteValidity}
            type="number"
            min={1}
            max={365}
            value={String(prefs.quoteValidityDays)}
            onChange={(ev) => setPrefs({ ...prefs, quoteValidityDays: Number(ev.target.value) || 14 })}
            className="ltr-meta"
          />
          <Input
            id="quote-margin-minimum"
            label={he.settingsMarginMinimum}
            type="number"
            min={0}
            max={100}
            value={String(prefs.marginMinimumPercent)}
            onChange={(ev) =>
              setPrefs({ ...prefs, marginMinimumPercent: Math.max(0, Number(ev.target.value) || 0) })
            }
            className="ltr-meta"
          />
          <p className="settings-field-hint col-span-full text-xs text-fg-muted">{he.settingsMarginMinimumHint}</p>
          <Input
            id="quote-margin-target"
            label={he.settingsMarginTarget}
            type="number"
            min={0}
            max={100}
            value={String(prefs.marginTargetPercent)}
            onChange={(ev) =>
              setPrefs({ ...prefs, marginTargetPercent: Math.max(0, Number(ev.target.value) || 0) })
            }
            className="ltr-meta"
          />
          <Input
            id="quote-payment"
            label={he.settingsPaymentTerms}
            value={prefs.paymentTerms}
            onChange={(ev) => setPrefs({ ...prefs, paymentTerms: ev.target.value })}
          />
          <label className="settings-field-block col-span-full">
            <span className="settings-field-label">{he.settingsDefaultWarranty}</span>
            <textarea
              className="settings-textarea"
              rows={3}
              value={prefs.defaultWarranty}
              onChange={(ev) => setPrefs({ ...prefs, defaultWarranty: ev.target.value })}
            />
          </label>
          <label className="settings-field-block col-span-full">
            <span className="settings-field-label">{he.settingsDefaultGeneralTerms}</span>
            <textarea
              className="settings-textarea"
              rows={3}
              value={prefs.defaultGeneralTerms}
              onChange={(ev) => setPrefs({ ...prefs, defaultGeneralTerms: ev.target.value })}
            />
          </label>
          <label className="settings-field-block col-span-full">
            <span className="settings-field-label">{he.settingsDefaultCustomerNotes}</span>
            <textarea
              className="settings-textarea"
              rows={2}
              value={prefs.defaultCustomerNotes}
              onChange={(ev) => setPrefs({ ...prefs, defaultCustomerNotes: ev.target.value })}
            />
          </label>
          <Input
            id="quote-labor-rate"
            label={he.laborRateLabel}
            inputMode="decimal"
            value={laborRate}
            onChange={(ev) => setLaborRate(ev.target.value)}
            className="ltr-meta"
          />
        </div>
        {prefs.termsTemplates.length > 0 ? (
          <section className="flex flex-col gap-3" aria-label={he.settingsTermsTemplatesTitle}>
            <h3 className="text-sm font-semibold text-fg">{he.settingsTermsTemplatesTitle}</h3>
            <p className="settings-field-hint">{he.settingsTermsTemplatesLead}</p>
            <ul className="flex flex-col gap-2">
              {prefs.termsTemplates.map((tpl) => (
                <li key={tpl.id} className="flex flex-wrap items-center gap-2 rounded border border-border px-3 py-2">
                  <span className="text-sm text-fg">{tpl.name_he}</span>
                  <span className="text-xs text-fg-muted">
                    {tpl.kind === "payment_terms"
                      ? he.settingsTermsKindPayment
                      : tpl.kind === "warranty"
                        ? he.settingsTermsKindWarranty
                        : he.settingsTermsKindNotes}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="ms-auto text-sm"
                    onClick={() => {
                      if (tpl.kind === "payment_terms") {
                        setPrefs({ ...prefs, paymentTerms: tpl.body });
                      } else if (tpl.kind === "warranty") {
                        setPrefs({ ...prefs, defaultWarranty: tpl.body });
                      } else {
                        setPrefs({ ...prefs, defaultCustomerNotes: tpl.body });
                      }
                    }}
                  >
                    {he.settingsTermsTemplateUse}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <p className="settings-field-hint">{he.laborRateLead}</p>
        {laborInvalid ? (
          <p className="text-sm text-danger" role="alert">
            {he.laborRateInvalid}
          </p>
        ) : null}
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={prefs.showVatOnQuotes}
            onChange={(ev) => setPrefs({ ...prefs, showVatOnQuotes: ev.target.checked })}
          />
          <span>{he.settingsShowVat}</span>
        </label>
        <p className="settings-field-hint">{he.settingsShowVatHint}</p>
        <label className="settings-field-block">
          <span className="settings-field-label">{he.settingsPdfNotes}</span>
          <textarea
            className="settings-textarea"
            rows={4}
            value={prefs.pdfNotes}
            onChange={(ev) => setPrefs({ ...prefs, pdfNotes: ev.target.value })}
          />
        </label>
        {saveError ? (
          <p className="text-sm text-danger" role="alert">
            {saveError}
          </p>
        ) : null}
        {saved ? (
          <p className="text-sm text-success" role="status">
            {he.settingsSaved}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          className="self-start"
          loading={save.isPending}
          disabled={!dirty || laborInvalid}
          title={!dirty ? he.settingsSaveDisabled : undefined}
        >
          {he.saveSettings}
        </Button>
      </form>
    </div>
  );
}
