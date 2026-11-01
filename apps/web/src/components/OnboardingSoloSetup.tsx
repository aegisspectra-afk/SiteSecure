import { ApiClientError, type ApiClient } from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { useState, type FormEvent } from "react";
import { he } from "../i18n/he";
import {
  SOLO_ONBOARDING_STEPS,
  clearSoloOnboarding,
  parseCatalogImportRows,
  type SoloOnboardingStepId,
} from "../lib/onboarding-solo";
import { AuthAlert, AuthField, AuthForm } from "./auth";

export function OnboardingSoloSetup({
  api,
  workspaceId,
  workspaceName,
  onComplete,
}: {
  api: ApiClient;
  workspaceId: string;
  workspaceName?: string | null;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<SoloOnboardingStepId>("business_vat");
  const [vat, setVat] = useState("18");
  const [businessName, setBusinessName] = useState(workspaceName ?? "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [catalogMessage, setCatalogMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const stepIndex = SOLO_ONBOARDING_STEPS.findIndex((item) => item.id === step);

  async function saveBusiness(e: FormEvent) {
    e.preventDefault();
    const vatNumber = Number(vat);
    if (!businessName.trim() || Number.isNaN(vatNumber) || vatNumber < 0 || vatNumber > 100) {
      setError(he.required);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.patchWorkspace(workspaceId, {
        name: businessName.trim(),
        vat_percent: vatNumber,
        timezone: "Asia/Jerusalem",
      });
      setStep("catalog");
    } catch (err) {
      setError(err instanceof Error ? err.message : he.sessionError);
    } finally {
      setLoading(false);
    }
  }

  async function importCatalog(file: File) {
    setLoading(true);
    setError(null);
    try {
      const rows = parseCatalogImportRows(await file.text());
      if (!rows.length) {
        setError(he.onboardingCatalogHint);
        return;
      }
      let created = 0;
      for (const row of rows) {
        await api.createCatalogProduct(workspaceId, {
          name: row.name,
          sku: row.sku,
          list_price: row.list_price,
        });
        created += 1;
      }
      setCatalogMessage(he.onboardingCatalogResult(created));
      setStep("first_customer");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : he.sessionError);
    } finally {
      setLoading(false);
    }
  }

  async function createCustomer(e: FormEvent) {
    e.preventDefault();
    if (!customerName.trim()) {
      setError(he.required);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await api.createCustomer(workspaceId, {
        display_name: customerName.trim(),
        phone: customerPhone.trim() || undefined,
        email: customerEmail.trim() || undefined,
      });
      setCustomerId(row.id);
      setStep("first_quote");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : he.sessionError);
    } finally {
      setLoading(false);
    }
  }

  async function createQuote() {
    setLoading(true);
    setError(null);
    try {
      await api.createQuote(workspaceId, {
        customer_id: customerId,
        title: he.setupFirstQuote,
      });
      clearSoloOnboarding();
      onComplete();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : he.sessionError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6" data-testid="onboarding-solo-setup">
      <p className="text-sm text-fg-muted">{he.onboardingSetupLead}</p>
      <ol className="flex flex-col gap-2" aria-label={he.onboardingSetupLead}>
        {SOLO_ONBOARDING_STEPS.map((item, index) => {
          const labels = {
            business_vat: he.onboardingStepBusinessVat,
            catalog: he.onboardingStepCatalog,
            first_customer: he.onboardingStepFirstCustomer,
            first_quote: he.onboardingStepFirstQuote,
          } as const;
          const label = labels[item.id];
          const done = index < stepIndex;
          const current = item.id === step;
          return (
            <li key={item.id} className="flex items-center gap-2 text-sm" data-testid={`onboarding-step-${item.id}`}>
              <span className="public-mono text-fg-muted" aria-hidden>
                {done ? "✓" : current ? "●" : "○"}
              </span>
              <span className={done || current ? "text-fg" : "text-fg-muted"}>{label}</span>
            </li>
          );
        })}
      </ol>

      {error ? <AuthAlert>{error}</AuthAlert> : null}

      {step === "business_vat" ? (
        <AuthForm onSubmit={saveBusiness}>
          <AuthField
            id="solo-business-name"
            label={he.businessName}
            value={businessName}
            onChange={(ev) => setBusinessName(ev.target.value)}
            disabled={loading}
          />
          <AuthField
            id="solo-vat"
            label={he.onboardingVatLabel}
            value={vat}
            onChange={(ev) => setVat(ev.target.value)}
            disabled={loading}
          />
          <Button type="submit" variant="primary" loading={loading} className="auth-cta h-12 w-full">
            {he.onboardingVatSave}
          </Button>
        </AuthForm>
      ) : null}

      {step === "catalog" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-fg-muted">{he.onboardingCatalogHint}</p>
          {catalogMessage ? <p className="text-sm text-fg">{catalogMessage}</p> : null}
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[var(--radius-control)] border border-border px-3 text-sm text-fg">
            {loading ? he.loading : he.onboardingCatalogImport}
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              data-testid="onboarding-catalog-import"
              disabled={loading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void importCatalog(file);
              }}
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            data-testid="onboarding-catalog-skip"
            disabled={loading}
            onClick={() => setStep("first_customer")}
          >
            {he.onboardingCatalogSkip}
          </Button>
        </div>
      ) : null}

      {step === "first_customer" ? (
        <AuthForm onSubmit={createCustomer}>
          <AuthField
            id="solo-customer-name"
            label={he.onboardingCustomerName}
            value={customerName}
            onChange={(ev) => setCustomerName(ev.target.value)}
            disabled={loading}
          />
          <AuthField
            id="solo-customer-phone"
            label={he.phone}
            value={customerPhone}
            onChange={(ev) => setCustomerPhone(ev.target.value)}
            disabled={loading}
          />
          <AuthField
            id="solo-customer-email"
            label={he.email}
            value={customerEmail}
            onChange={(ev) => setCustomerEmail(ev.target.value)}
            disabled={loading}
          />
          <Button type="submit" variant="primary" loading={loading} className="auth-cta h-12 w-full">
            {he.onboardingCustomerCreate}
          </Button>
        </AuthForm>
      ) : null}

      {step === "first_quote" ? (
        <Button
          type="button"
          variant="primary"
          className="auth-cta h-12 w-full"
          data-testid="onboarding-first-quote"
          loading={loading}
          onClick={() => void createQuote()}
        >
          {he.onboardingQuoteCreate}
        </Button>
      ) : null}
    </div>
  );
}
