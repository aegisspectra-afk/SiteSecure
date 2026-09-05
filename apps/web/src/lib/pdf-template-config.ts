/**
 * Quote PDF TemplateConfiguration — presentation only.
 * Company identity lives in Company Profile; this config controls visibility/defaults.
 */

export type PdfDocType = "quote" | "service" | "project";
export type PdfTemplateStatus = "active" | "draft" | "archived";

export type QuoteTemplateConfig = {
  /** Branding presentation (not company data) */
  useCompanyLogo: boolean;
  useCompanyColors: boolean;
  overrideColors: boolean;
  primaryColor: string;
  secondaryColor: string;

  /** Document header */
  showLogo: boolean;
  headerLogo: boolean;
  headerCompany: boolean;
  showBusinessNumber: boolean;
  showCompanyAddress: boolean;
  headerContact: boolean;
  showIssuedDate: boolean;
  showQuoteValidity: boolean;

  /** Customer & site */
  bodyCustomerSite: boolean;
  showCustomer: boolean;
  showCustomerContact: boolean;
  showCustomerBusinessNumber: boolean;
  showSite: boolean;
  showSiteAddress: boolean;

  /** Line content */
  bodyLineItems: boolean;
  showSections: boolean;
  showSku: boolean;
  showQty: boolean;
  showUnitPrice: boolean;
  showDiscountCol: boolean;
  showLineTotal: boolean;

  /** Totals (server-authoritative amounts) */
  bodyTotals: boolean;
  showSubtotal: boolean;
  showDiscountTotal: boolean;
  showVat: boolean;
  showGrandTotal: boolean;

  /** Terms & payment */
  footerPayment: boolean;
  showPaymentTerms: boolean;
  showBankDetails: boolean;
  footerNotes: boolean;
  showTechnicalNotes: boolean;
  paymentTerms: string;
  notes: string;

  /** Approval */
  footerSignature: boolean;
  showCustomerSignature: boolean;

  /** Footer */
  footerPageNumber: boolean;
  footerCompanyIdentity: boolean;
};

export const DEFAULT_QUOTE_TEMPLATE_CONFIG: QuoteTemplateConfig = {
  useCompanyLogo: true,
  useCompanyColors: true,
  overrideColors: false,
  primaryColor: "#1c4e80",
  secondaryColor: "#0f172a",

  showLogo: true,
  headerLogo: true,
  headerCompany: true,
  showBusinessNumber: true,
  showCompanyAddress: true,
  headerContact: true,
  showIssuedDate: true,
  showQuoteValidity: true,

  bodyCustomerSite: true,
  showCustomer: true,
  showCustomerContact: true,
  showCustomerBusinessNumber: true,
  showSite: true,
  showSiteAddress: true,

  bodyLineItems: true,
  showSections: true,
  showSku: true,
  showQty: true,
  showUnitPrice: true,
  showDiscountCol: true,
  showLineTotal: true,

  bodyTotals: true,
  showSubtotal: true,
  showDiscountTotal: true,
  showVat: true,
  showGrandTotal: true,

  footerPayment: true,
  showPaymentTerms: true,
  showBankDetails: false,
  footerNotes: true,
  showTechnicalNotes: true,
  paymentTerms: "שוטף + 30",
  notes: "",

  footerSignature: true,
  showCustomerSignature: true,

  footerPageNumber: true,
  footerCompanyIdentity: true,
};

export function readTemplateConfig(raw: Record<string, unknown> | null | undefined): QuoteTemplateConfig {
  const c = raw ?? {};
  const out = { ...DEFAULT_QUOTE_TEMPLATE_CONFIG };
  for (const key of Object.keys(DEFAULT_QUOTE_TEMPLATE_CONFIG) as (keyof QuoteTemplateConfig)[]) {
    if (c[key] === undefined || c[key] === null) continue;
    const def = DEFAULT_QUOTE_TEMPLATE_CONFIG[key];
    if (typeof def === "boolean") {
      (out as Record<string, unknown>)[key] = Boolean(c[key]);
    } else if (typeof def === "string") {
      (out as Record<string, unknown>)[key] = String(c[key]);
    }
  }
  // Legacy aliases → new branding flags
  if (c.useCompanyLogo === undefined && (c.showLogo !== undefined || c.headerLogo !== undefined)) {
    out.useCompanyLogo = Boolean(c.showLogo ?? c.headerLogo ?? true);
  }
  if (c.overrideColors === undefined && c.primaryColor && !c.useCompanyColors) {
    // Old templates always had colors; treat as override until user opts into company colors
    out.useCompanyColors = true;
    out.overrideColors = false;
  }
  // Keep logo flags in sync with useCompanyLogo for the renderer
  if (out.useCompanyLogo) {
    out.showLogo = true;
    out.headerLogo = true;
  } else {
    out.showLogo = false;
    out.headerLogo = false;
  }
  // Protect unusable documents
  out.bodyLineItems = true;
  out.showLineTotal = true;
  out.bodyTotals = true;
  out.showGrandTotal = true;
  return out;
}

/** Payload stored in pdf_document_templates.config — includes renderer-compatible keys. */
export function configToApiPayload(cfg: QuoteTemplateConfig): Record<string, unknown> {
  const payload = { ...cfg } as Record<string, unknown>;
  // Sync derived renderer flags
  payload.showLogo = cfg.useCompanyLogo && cfg.showLogo;
  payload.headerLogo = cfg.useCompanyLogo && cfg.headerLogo;
  if (cfg.useCompanyColors && !cfg.overrideColors) {
    // Renderer prefers company.brand_primary; omit forcing template color
    payload.useCompanyColors = true;
    payload.overrideColors = false;
  } else {
    payload.useCompanyColors = false;
    payload.overrideColors = true;
  }
  return payload;
}

export type StudioSectionId =
  | "branding"
  | "header"
  | "customer"
  | "lines"
  | "totals"
  | "terms"
  | "approval"
  | "footer";
