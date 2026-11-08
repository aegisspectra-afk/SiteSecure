const STORAGE_KEY = "ss-solo-onboarding";

export const SOLO_ONBOARDING_STEPS = [
  { id: "business_vat", label: "onboardingStepBusinessVat" },
  { id: "payment_terms", label: "onboardingStepPaymentTerms" },
  { id: "catalog", label: "onboardingStepCatalog" },
  { id: "first_customer", label: "onboardingStepFirstCustomer" },
  { id: "first_quote", label: "onboardingStepFirstQuote" },
] as const;

export type SoloOnboardingStepId = (typeof SOLO_ONBOARDING_STEPS)[number]["id"];

/**
 * Payment terms are the owner's own wording (the product does not supply legal text).
 * The field starts with a bracketed placeholder that must be replaced before saving.
 */
export function paymentTermsReady(raw: string): boolean {
  const text = raw.trim();
  return text.length > 0 && !/[[\]]/.test(text);
}

export function markSoloOnboarding(workspaceId: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, workspaceId);
  } catch {
    // ignore quota / private mode
  }
}

export function readSoloOnboarding(workspaceId?: string | null): string | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    if (workspaceId && stored !== workspaceId) return null;
    return stored;
  } catch {
    return null;
  }
}

export function clearSoloOnboarding(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function parseCatalogImportRows(csvText: string): { name: string; sku?: string; list_price: number }[] {
  const text = csvText.replace(/^\uFEFF/, "").trim();
  if (!text) return [];
  const [headerLine, ...lines] = text.split(/\r?\n/).filter((line) => line.trim());
  if (!headerLine || lines.length === 0) return [];
  const headers = headerLine.split(",").map((cell) => cell.trim().replace(/^"|"$/g, "").toLowerCase());
  const nameIdx = headers.findIndex((h) => ["name", "שם", "display_name"].includes(h));
  const skuIdx = headers.findIndex((h) => ["sku", "מקט", "מק״ט", 'מק"ט'].includes(h));
  const priceIdx = headers.findIndex((h) => ["list_price", "price", "מחיר"].includes(h));
  if (nameIdx < 0) return [];
  const rows: { name: string; sku?: string; list_price: number }[] = [];
  for (const line of lines.slice(0, 200)) {
    const cells = line.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
    const name = cells[nameIdx]?.trim();
    if (!name || /^[=+\-@\t\r]/.test(name)) continue;
    const sku = skuIdx >= 0 ? cells[skuIdx]?.trim() : undefined;
    const priceRaw = priceIdx >= 0 ? cells[priceIdx]?.trim() : "0";
    const list_price = Number(priceRaw.replace(",", ".")) || 0;
    rows.push({ name: name.slice(0, 200), sku: sku || undefined, list_price });
  }
  return rows;
}
