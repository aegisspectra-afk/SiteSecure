export type PdfTemplateType = "quote" | "service" | "project";
export type PdfTemplateStatus = "active" | "draft";

export type PdfTemplate = {
  id: string;
  name: string;
  type: PdfTemplateType;
  status: PdfTemplateStatus;
  isDefault: boolean;
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

const STORAGE_KEY = "site-secure-pdf-templates-v1";

export function defaultPdfTemplates(): PdfTemplate[] {
  return [
    {
      id: "tpl-quote-default",
      name: "הצעת מחיר — סטנדרט",
      type: "quote",
      status: "active",
      isDefault: true,
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
      notes: "ההצעה כוללת אספקה, התקנה והדרכה בסיסית.",
      paymentTerms: "שוטף + 30 · מקדמה 40% עם אישור ההצעה",
    },
    {
      id: "tpl-service",
      name: "דוח שירות",
      type: "service",
      status: "active",
      isDefault: false,
      primaryColor: "#0b6bcb",
      secondaryColor: "#334155",
      showLogo: true,
      showCompanyAddress: true,
      showPaymentTerms: false,
      showTechnicalNotes: true,
      showCustomerSignature: true,
      showQuoteValidity: false,
      headerCompany: true,
      headerContact: true,
      headerLogo: true,
      bodyCustomerSite: true,
      bodyLineItems: true,
      bodyTotals: false,
      footerPayment: false,
      footerNotes: true,
      footerSignature: true,
      footerPageNumber: true,
      notes: "סיכום ביקור שטח והמלצות טיפול.",
      paymentTerms: "",
    },
    {
      id: "tpl-project-draft",
      name: "סיכום פרויקט — טיוטה",
      type: "project",
      status: "draft",
      isDefault: false,
      primaryColor: "#0f172a",
      secondaryColor: "#64748b",
      showLogo: true,
      showCompanyAddress: true,
      showPaymentTerms: true,
      showTechnicalNotes: false,
      showCustomerSignature: false,
      showQuoteValidity: false,
      headerCompany: true,
      headerContact: false,
      headerLogo: true,
      bodyCustomerSite: true,
      bodyLineItems: true,
      bodyTotals: true,
      footerPayment: true,
      footerNotes: false,
      footerSignature: false,
      footerPageNumber: true,
      notes: "",
      paymentTerms: "לפי חוזה הפרויקט",
    },
  ];
}

export function loadPdfTemplates(): PdfTemplate[] {
  if (typeof window === "undefined") return defaultPdfTemplates();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPdfTemplates();
    const parsed = JSON.parse(raw) as PdfTemplate[];
    if (!Array.isArray(parsed) || !parsed.length) return defaultPdfTemplates();
    return ensureOneDefaultQuote(parsed);
  } catch {
    return defaultPdfTemplates();
  }
}

export function savePdfTemplates(templates: PdfTemplate[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ensureOneDefaultQuote(templates)));
  } catch {
    /* private mode */
  }
}

export function ensureOneDefaultQuote(templates: PdfTemplate[]): PdfTemplate[] {
  const quotes = templates.filter((t) => t.type === "quote");
  if (!quotes.length) return templates;
  const hasDefault = quotes.some((t) => t.isDefault);
  if (hasDefault) return templates;
  return templates.map((t) =>
    t.id === quotes[0].id ? { ...t, isDefault: true, status: "active" as const } : t,
  );
}

export function setDefaultTemplate(templates: PdfTemplate[], id: string): PdfTemplate[] {
  const target = templates.find((t) => t.id === id);
  if (!target || target.type !== "quote") return templates;
  return templates.map((t) => ({
    ...t,
    isDefault: t.type === "quote" ? t.id === id : false,
    status: t.id === id ? "active" : t.status,
  }));
}

export function duplicateTemplate(templates: PdfTemplate[], id: string): PdfTemplate[] {
  const source = templates.find((t) => t.id === id);
  if (!source) return templates;
  const copy: PdfTemplate = {
    ...source,
    id: `tpl-${Date.now()}`,
    name: `${source.name} (עותק)`,
    isDefault: false,
    status: "draft",
  };
  return [...templates, copy];
}
