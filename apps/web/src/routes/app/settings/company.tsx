import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { ApiClientError } from "@site-secure/api-client";
import { downloadAndOpenPdf } from "../../../lib/download-blob";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/settings/company")({
  component: CompanyBrandingPage,
});

type FormState = {
  displayName: string;
  legalName: string;
  businessNumberType: string;
  businessNumber: string;
  taxStatus: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  brandPrimary: string;
  brandAccent: string;
  bankName: string;
  bankBranch: string;
  bankAccount: string;
  bankAccountHolder: string;
  paymentInstructions: string;
  showBankOnDocuments: boolean;
};

const EMPTY: FormState = {
  displayName: "",
  legalName: "",
  businessNumberType: "company_number",
  businessNumber: "",
  taxStatus: "unknown",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postalCode: "",
  phone: "",
  email: "",
  website: "",
  brandPrimary: "#1c4e80",
  brandAccent: "",
  bankName: "",
  bankBranch: "",
  bankAccount: "",
  bankAccountHolder: "",
  paymentInstructions: "",
  showBankOnDocuments: false,
};

function CompanyBrandingPage() {
  return (
    <RequirePermission permission="workspace.edit">
      <CompanyBrandingBody />
    </RequirePermission>
  );
}

function CompanyBrandingBody() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const query = useQuery({
    queryKey: ["company-profile", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getCompanyProfile(workspaceId!),
  });

  useEffect(() => {
    if (!query.data?.profile) return;
    const p = query.data.profile as Record<string, unknown>;
    setForm({
      displayName: String(p.displayName || ""),
      legalName: String(p.legalName || ""),
      businessNumberType: String(p.businessNumberType || "company_number"),
      businessNumber: String(p.businessNumber || ""),
      taxStatus: String(p.taxStatus || "unknown"),
      addressLine1: String(p.addressLine1 || ""),
      addressLine2: String(p.addressLine2 || ""),
      city: String(p.city || ""),
      postalCode: String(p.postalCode || ""),
      phone: String(p.phone || ""),
      email: String(p.email || ""),
      website: String(p.website || ""),
      brandPrimary: String(p.brandPrimary || "#1c4e80"),
      brandAccent: String(p.brandAccent || ""),
      bankName: String(p.bankName || ""),
      bankBranch: String(p.bankBranch || ""),
      bankAccount: String(p.bankAccount || ""),
      bankAccountHolder: String(p.bankAccountHolder || ""),
      paymentInstructions: String(p.paymentInstructions || ""),
      showBankOnDocuments: Boolean(p.showBankOnDocuments),
    });
  }, [query.data]);

  const save = useMutation({
    mutationFn: () =>
      api.patchWorkspaceSettings(workspaceId!, {
        branding: {
          displayName: form.displayName.trim(),
          legalName: form.legalName.trim(),
          businessNumberType: form.businessNumberType,
          businessNumber: form.businessNumber.trim() || undefined,
          taxStatus: form.taxStatus,
          addressLine1: form.addressLine1.trim() || undefined,
          addressLine2: form.addressLine2.trim() || undefined,
          city: form.city.trim() || undefined,
          postalCode: form.postalCode.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          website: form.website.trim() || undefined,
          brandPrimary: form.brandPrimary.trim() || undefined,
          brandAccent: form.brandAccent.trim() || undefined,
          bankName: form.bankName.trim() || undefined,
          bankBranch: form.bankBranch.trim() || undefined,
          bankAccount: form.bankAccount.trim() || undefined,
          bankAccountHolder: form.bankAccountHolder.trim() || undefined,
          paymentInstructions: form.paymentInstructions.trim() || undefined,
          showBankOnDocuments: form.showBankOnDocuments,
          name: form.displayName.trim(),
          brand_name: form.displayName.trim(),
          legal_name: form.legalName.trim(),
          address: form.addressLine1.trim() || undefined,
        },
      }),
    onSuccess: async () => {
      setFormError(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
      await queryClient.invalidateQueries({ queryKey: ["company-profile", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ["workspace-settings", workspaceId] });
    },
    onError: (err) => {
      setFormError(err instanceof ApiClientError ? err.message : he.sessionError);
    },
  });

  async function onLogoSelected(file: File | null) {
    if (!file || !workspaceId) return;
    if (file.size > 2 * 1024 * 1024) {
      setFormError(he.companyLogoTooLarge);
      return;
    }
    try {
      setFormError(null);
      const intent = await api.createCompanyLogoUpload(workspaceId, {
        original_filename: file.name,
        mime_type: file.type || "image/png",
        byte_size: file.size,
      });
      const put = await fetch(intent.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/png" },
        body: file,
      });
      if (!put.ok) throw new Error("upload failed");
      await api.completeCompanyLogo(workspaceId, {
        logo_asset_id: intent.logo_asset_id,
        logo_storage_path: intent.logo_storage_path,
        logo_bucket: intent.logo_bucket,
        mime_type: intent.mime_type,
      });
      await queryClient.invalidateQueries({ queryKey: ["company-profile", workspaceId] });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } catch {
      setFormError(he.companyLogoUploadError);
    }
  }

  async function openPreview(kind: "quote" | "tax_invoice") {
    if (!workspaceId) return;
    setPreviewBusy(true);
    try {
      const { blob, filename } = await api.previewCompanyDocument(workspaceId, kind);
      downloadAndOpenPdf(blob, filename || "preview.pdf");
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : he.sessionError);
    } finally {
      setPreviewBusy(false);
    }
  }

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (query.isLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
  if (query.isError) return <ErrorState title={he.settingsError} />;

  const logoPath = String((query.data?.profile as Record<string, unknown>)?.logoStoragePath || "");

  return (
    <div className="settings-panel flex flex-col gap-6">
      <PageHeader title={he.settingsNavCompany} description={he.companyBrandingLead} />
      {query.data?.missing_for_quote?.length ? (
        <p className="settings-banner-warn" role="status">
          {he.companyMissingForPdf}
        </p>
      ) : null}
      <form
        className="settings-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <section className="settings-section">
          <h2 className="settings-section-title">{he.companyIdentitySection}</h2>
          <div className="settings-field-grid">
            <Input
              id="co-display"
              label={he.companyDisplayName}
              value={form.displayName}
              onChange={(ev) => setForm({ ...form, displayName: ev.target.value })}
              required
            />
            <Input
              id="co-legal"
              label={he.companyLegalName}
              value={form.legalName}
              onChange={(ev) => setForm({ ...form, legalName: ev.target.value })}
            />
            <label className="settings-field-block">
              <span className="settings-field-label">{he.companyBusinessType}</span>
              <select
                className="settings-select"
                value={form.businessNumberType}
                onChange={(ev) => setForm({ ...form, businessNumberType: ev.target.value })}
              >
                <option value="company_number">חברה (ח.פ.)</option>
                <option value="authorized_dealer">עוסק מורשה (ע.מ.)</option>
                <option value="exempt_dealer">עוסק פטור</option>
                <option value="association">עמותה</option>
                <option value="other">אחר</option>
              </select>
            </label>
            <Input
              id="co-bn"
              label={he.companyBusinessNumber}
              value={form.businessNumber}
              onChange={(ev) => setForm({ ...form, businessNumber: ev.target.value })}
              className="ltr-meta"
            />
            <label className="settings-field-block">
              <span className="settings-field-label">{he.companyTaxStatus}</span>
              <select
                className="settings-select"
                value={form.taxStatus}
                onChange={(ev) => setForm({ ...form, taxStatus: ev.target.value })}
              >
                <option value="unknown">לא הוגדר</option>
                <option value="vat_registered">עוסק במע״מ</option>
                <option value="exempt">פטור ממע״מ</option>
                <option value="zero_rated">מע״מ בשיעור אפס</option>
              </select>
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">{he.companyContactSection}</h2>
          <div className="settings-field-grid">
            <Input
              id="co-addr1"
              label={he.companyAddress}
              value={form.addressLine1}
              onChange={(ev) => setForm({ ...form, addressLine1: ev.target.value })}
            />
            <Input
              id="co-addr2"
              label={he.companyAddress2}
              value={form.addressLine2}
              onChange={(ev) => setForm({ ...form, addressLine2: ev.target.value })}
            />
            <Input
              id="co-city"
              label={he.companyCity}
              value={form.city}
              onChange={(ev) => setForm({ ...form, city: ev.target.value })}
            />
            <Input
              id="co-zip"
              label={he.companyPostal}
              value={form.postalCode}
              onChange={(ev) => setForm({ ...form, postalCode: ev.target.value })}
              className="ltr-meta"
            />
            <Input
              id="co-phone"
              label={he.companyPhone}
              value={form.phone}
              onChange={(ev) => setForm({ ...form, phone: ev.target.value })}
              className="ltr-meta"
            />
            <Input
              id="co-email"
              label={he.companyEmail}
              value={form.email}
              onChange={(ev) => setForm({ ...form, email: ev.target.value })}
              className="ltr-meta"
            />
            <Input
              id="co-web"
              label={he.companyWebsite}
              value={form.website}
              onChange={(ev) => setForm({ ...form, website: ev.target.value })}
              className="ltr-meta"
            />
          </div>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">{he.companyBrandSection}</h2>
          <div className="settings-field-grid">
            <label className="settings-field-block">
              <span className="settings-field-label">{he.companyLogo}</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="settings-file"
                onChange={(ev) => void onLogoSelected(ev.target.files?.[0] ?? null)}
              />
              {logoPath ? <span className="settings-hint ltr-meta">{logoPath}</span> : null}
            </label>
            <Input
              id="co-primary"
              label={he.companyBrandPrimary}
              value={form.brandPrimary}
              onChange={(ev) => setForm({ ...form, brandPrimary: ev.target.value })}
              className="ltr-meta"
            />
            <Input
              id="co-accent"
              label={he.companyBrandAccent}
              value={form.brandAccent}
              onChange={(ev) => setForm({ ...form, brandAccent: ev.target.value })}
              className="ltr-meta"
            />
          </div>
          <div className="company-brand-swatch" style={{ background: form.brandPrimary || "#1c4e80" }} aria-hidden />
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">{he.companyPaymentSection}</h2>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={form.showBankOnDocuments}
              onChange={(ev) => setForm({ ...form, showBankOnDocuments: ev.target.checked })}
            />
            <span>{he.companyShowBank}</span>
          </label>
          <div className="settings-field-grid">
            <Input
              id="co-bank"
              label={he.companyBankName}
              value={form.bankName}
              onChange={(ev) => setForm({ ...form, bankName: ev.target.value })}
            />
            <Input
              id="co-branch"
              label={he.companyBankBranch}
              value={form.bankBranch}
              onChange={(ev) => setForm({ ...form, bankBranch: ev.target.value })}
              className="ltr-meta"
            />
            <Input
              id="co-account"
              label={he.companyBankAccount}
              value={form.bankAccount}
              onChange={(ev) => setForm({ ...form, bankAccount: ev.target.value })}
              className="ltr-meta"
            />
            <Input
              id="co-holder"
              label={he.companyBankHolder}
              value={form.bankAccountHolder}
              onChange={(ev) => setForm({ ...form, bankAccountHolder: ev.target.value })}
            />
          </div>
          <label className="settings-field-block">
            <span className="settings-field-label">{he.companyPaymentInstructions}</span>
            <textarea
              className="settings-textarea"
              rows={3}
              value={form.paymentInstructions}
              onChange={(ev) => setForm({ ...form, paymentInstructions: ev.target.value })}
            />
          </label>
        </section>

        <section className="settings-section">
          <h2 className="settings-section-title">{he.companyPreviewSection}</h2>
          <p className="settings-hint">{he.companyPreviewHint}</p>
          <div className="settings-actions-row">
            <Button type="button" variant="secondary" disabled={previewBusy} onClick={() => void openPreview("quote")}>
              {he.companyPreviewQuote}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={previewBusy}
              onClick={() => void openPreview("tax_invoice")}
            >
              {he.companyPreviewInvoice}
            </Button>
            <Link to="/app/settings/pdf-templates" className="settings-inline-link">
              {he.settingsNavPdf}
            </Link>
          </div>
        </section>

        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
        <div className="settings-actions-row">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? he.saving : he.save}
          </Button>
          {saved ? <span className="settings-saved">{he.settingsSaved}</span> : null}
        </div>
      </form>
    </div>
  );
}
