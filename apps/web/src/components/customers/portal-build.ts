import { he } from "../../i18n/he";

export type PortalBuildCounts = {
  sites?: number;
  installations?: number;
  equipment?: number;
  warranties?: number;
  quotes?: number;
  service?: number;
  documents?: number;
};

export type PortalBuildSegment = {
  id: string;
  label: string;
  units: number;
  detail: string | null;
};

const TEST_MODE = import.meta.env.MODE === "test";

function counted(id: string, label: string, units: number, detail: string | null): PortalBuildSegment | null {
  if (units <= 0) return null;
  return { id, label, units, detail };
}

export function portalBuildPlan(counts: PortalBuildCounts = {}): PortalBuildSegment[] {
  const sites = Math.max(0, counts.sites ?? 0);
  const installations = Math.max(0, counts.installations ?? 0);
  const equipment = Math.max(0, counts.equipment ?? 0);
  const warranties = Math.max(0, counts.warranties ?? 0);
  const quotes = Math.max(0, counts.quotes ?? 0);
  const service = Math.max(0, counts.service ?? 0);
  const documents = Math.max(0, counts.documents ?? 0);
  const rows = [
    { id: "access", label: he.portalBuildAccess, units: 1, detail: null },
    { id: "profile", label: he.portalBuildProfile, units: 1, detail: null },
    counted("sites", he.portalBuildSites, sites, he.portalBuildSitesAmount(sites)),
    counted("installations", he.portalBuildInstallations, installations, he.portalBuildInstallationsAmount(installations)),
    counted("equipment", he.portalBuildEquipment, equipment, he.portalBuildEquipmentAmount(equipment)),
    counted("warranties", he.portalBuildWarranties, warranties, he.portalBuildWarrantiesAmount(warranties)),
    counted("quotes", he.portalBuildQuotes, quotes, he.portalBuildQuotesAmount(quotes)),
    counted("service", he.portalBuildService, service, he.portalBuildServiceAmount(service)),
    counted("documents", he.portalBuildDocuments, documents, he.portalBuildDocumentsAmount(documents)),
    { id: "link", label: he.portalBuildLink, units: 1, detail: null },
  ];
  return rows.filter((row): row is PortalBuildSegment => row !== null);
}

export function portalLinkPlan(): PortalBuildSegment[] {
  return [{ id: "link", label: he.portalBuildLink, units: 1, detail: null }];
}

export type PortalContactChoice = { email: string; label: string };

const PORTAL_VISIBLE_QUOTE_STATUSES = new Set(["sent", "viewed", "approved", "rejected"]);

export function portalVisibleQuoteCount(quotes: { status?: string | null }[]): number {
  return quotes.filter((quote) => quote.status != null && PORTAL_VISIBLE_QUOTE_STATUSES.has(quote.status)).length;
}

export function portalVisibleDocumentCount(documents: { visibility?: string | null }[]): number {
  return documents.filter((document) => document.visibility === "customer").length;
}

export function portalContactChoices(input: {
  customerName?: string;
  customerEmail?: string;
  contacts?: { name: string; email: string }[];
}): PortalContactChoice[] {
  const seen = new Set<string>();
  const choices: PortalContactChoice[] = [];
  const add = (email: string, label: string) => {
    const key = email.trim().toLowerCase();
    if (!key.includes("@") || key.startsWith("@") || seen.has(key)) return;
    seen.add(key);
    choices.push({ email: key, label: label.trim() || key });
  };
  if (input.customerEmail) add(input.customerEmail, input.customerName?.trim() || he.portalContactCustomer);
  for (const contact of input.contacts ?? []) {
    if (contact.email) add(contact.email, contact.name);
  }
  return choices;
}

export function portalInitialEmail(
  defaultEmail: string,
  choices: PortalContactChoice[],
): { choice: string; email: string } {
  const normalized = defaultEmail.trim().toLowerCase();
  const match = choices.find((choice) => choice.email === normalized);
  if (match) return { choice: match.email, email: match.email };
  if (choices[0]) return { choice: choices[0].email, email: choices[0].email };
  return { choice: "custom", email: defaultEmail };
}

export function portalShareText(input: {
  workspaceName?: string;
  customerName?: string;
  email: string;
  link: string;
}): string {
  return he.portalShareMessage({
    workspace: input.workspaceName?.trim() || he.brand,
    customer: input.customerName?.trim() || he.portalContactCustomer,
    email: input.email,
    link: input.link,
  });
}

export function formatPortalExpiry(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

export function portalBuildTotal(plan: PortalBuildSegment[]): number {
  return plan.reduce((sum, segment) => sum + segment.units, 0);
}

export function portalBuildSegmentAt(plan: PortalBuildSegment[], percent: number): PortalBuildSegment {
  const total = portalBuildTotal(plan) || 1;
  let cursor = 0;
  for (const segment of plan) {
    cursor += segment.units;
    if (percent < (cursor / total) * 100) return segment;
  }
  return plan[plan.length - 1] ?? { id: "link", label: he.portalBuildLink, units: 1, detail: null };
}

function workDuration(units: number): number {
  if (TEST_MODE) return Math.max(24, units * 20);
  if (units <= 0) return 900;
  return Math.min(5200, Math.max(900, units * 280));
}

export function portalBuildFrame(input: {
  elapsedMs: number;
  sealElapsedMs: number | null;
  plan: PortalBuildSegment[];
}): { percent: number; finished: boolean } {
  const total = portalBuildTotal(input.plan);
  const linkUnits = input.plan.at(-1)?.id === "link" ? input.plan.at(-1)!.units : 0;
  const workUnits = Math.max(0, total - linkUnits);
  const cap = total === 0 ? 100 : (workUnits / total) * 100;
  const workMs = workDuration(workUnits);
  const linkMs = workDuration(Math.max(linkUnits, 1));

  if (workUnits === 0) {
    if (input.sealElapsedMs == null) {
      return { percent: Math.min(88, (input.elapsedMs / linkMs) * 88), finished: false };
    }
    const finish = Math.min(1, input.sealElapsedMs / Math.max(80, linkMs * 0.45));
    return { percent: 88 + 12 * finish, finished: finish >= 1 };
  }

  const workT = Math.min(1, input.elapsedMs / workMs);
  if (input.sealElapsedMs == null || workT < 1) {
    return { percent: cap * workT, finished: false };
  }
  const finish = Math.min(1, input.sealElapsedMs / linkMs);
  return { percent: cap + (100 - cap) * finish, finished: finish >= 1 };
}
