import type { CustomerContact, CustomerOut, LeadOut, ProjectOut, QuoteOut, ServiceCallOut, SiteOut } from "@site-secure/api-client";
import { he } from "../i18n/he";

const LEAD_ATTENTION_STATUSES = new Set(["new", "contacted", "visit_scheduling", "quote_preparing", "follow_up"]);

export type CustomerProfileTab = "overview" | "sites" | "quotes" | "projects" | "service" | "documents";

export type CustomerActivityEvent = {
  id: string;
  at: string;
  label: string;
  href?:
    | { to: "/app/quotes/$quoteId"; params: { quoteId: string } }
    | { to: "/app/sites/$siteId"; params: { siteId: string } }
    | { to: "/app/leads/$leadId"; params: { leadId: string } };
};

export type SiteCardStats = {
  quoteCount: number;
  serviceCount: number;
  projectCount: number;
};

export function customerTypeLabel(type?: string | null): string {
  if (type === "business") return he.customer360TypeBusiness;
  if (type === "private") return he.customer360TypePrivate;
  return type?.trim() || he.customer360TypePrivate;
}

export function customerStatusLabel(status?: string | null): string {
  if (status === "active") return he.customer360StatusActive;
  if (status === "archived") return he.customer360StatusArchived;
  if (status === "inactive") return he.customer360StatusInactive;
  return status?.trim() || he.customer360StatusActive;
}

export function customerStatusTone(status?: string | null): "success" | "neutral" | "danger" {
  if (status === "active") return "success";
  if (status === "archived" || status === "inactive") return "neutral";
  return "success";
}

export function projectStatusLabel(status: string): string {
  return he.projectStatuses[status as keyof typeof he.projectStatuses] ?? status;
}

export function serviceStatusLabel(status: string): string {
  return he.serviceStatuses[status as keyof typeof he.serviceStatuses] ?? status;
}

export function installationStatusLabel(status?: string | null): string {
  if (!status?.trim()) return "";
  return he.installationStatuses[status as keyof typeof he.installationStatuses] ?? status;
}

export function formatActivityDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
}

export function formatActivityClock(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

export function formatActivityStamp(value: string): string {
  const day = formatActivityDay(value);
  const clock = formatActivityClock(value);
  return clock ? `${day} · ${clock}` : day;
}

export function formatActivityDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildSiteStats(
  sites: SiteOut[],
  quotes: QuoteOut[],
  serviceCalls: ServiceCallOut[],
  projects: ProjectOut[],
): Map<string, SiteCardStats> {
  const map = new Map<string, SiteCardStats>();
  for (const site of sites) {
    map.set(site.id, { quoteCount: 0, serviceCount: 0, projectCount: 0 });
  }
  for (const quote of quotes) {
    if (!quote.site_id) continue;
    const row = map.get(quote.site_id);
    if (row) row.quoteCount += 1;
  }
  for (const call of serviceCalls) {
    const row = map.get(call.site_id);
    if (row) row.serviceCount += 1;
  }
  for (const project of projects) {
    if (!project.site_id) continue;
    const row = map.get(project.site_id);
    if (row) row.projectCount += 1;
  }
  return map;
}

export function siteCardSummary(stats: SiteCardStats): string {
  const parts: string[] = [];
  if (stats.quoteCount > 0) {
    parts.push(he.customer360SiteQuotes(stats.quoteCount));
  }
  if (stats.serviceCount > 0) {
    parts.push(he.customer360SiteService(stats.serviceCount));
  }
  if (stats.projectCount > 0) {
    parts.push(he.customer360SiteProjects(stats.projectCount));
  }
  return parts.join(" · ") || he.customer360SiteNoActivity;
}

const CLOSED_LEAD = new Set(["won", "lost", "cancelled"]);

/** Prefer leads with next_action that still need attention. */
export function pickCustomerNextLead(leads: LeadOut[]): LeadOut | null {
  const open = leads.filter((lead) => !CLOSED_LEAD.has(lead.status) && Boolean(lead.next_action?.trim()));
  if (!open.length) return null;
  const ranked = [...open].sort((a, b) => {
    const aAttn = LEAD_ATTENTION_STATUSES.has(a.status) ? 0 : 1;
    const bAttn = LEAD_ATTENTION_STATUSES.has(b.status) ? 0 : 1;
    if (aAttn !== bAttn) return aAttn - bAttn;
    const aAt = a.next_action_at ? new Date(a.next_action_at).getTime() : Number.POSITIVE_INFINITY;
    const bAt = b.next_action_at ? new Date(b.next_action_at).getTime() : Number.POSITIVE_INFINITY;
    return aAt - bAt;
  });
  return ranked[0] ?? null;
}

export function buildCustomerActivity(input: {
  customer: CustomerOut;
  sites: SiteOut[];
  quotes: QuoteOut[];
  projects: ProjectOut[];
  serviceCalls: ServiceCallOut[];
  contacts?: CustomerContact[];
  leads?: LeadOut[];
}): CustomerActivityEvent[] {
  const events: CustomerActivityEvent[] = [];

  if (input.customer.created_at) {
    events.push({
      id: `customer-created-${input.customer.id}`,
      at: input.customer.created_at,
      label: he.customer360ActivityCustomerCreated(input.customer.display_name),
    });
  }

  for (const contact of input.contacts ?? []) {
    const at = (contact as { created_at?: string }).created_at;
    if (!at) continue;
    events.push({
      id: `contact-${contact.id}`,
      at,
      label: he.customer360ActivityContactAdded(contact.full_name),
    });
  }

  for (const lead of input.leads ?? []) {
    if (!lead.created_at) continue;
    events.push({
      id: `lead-${lead.id}`,
      at: lead.created_at,
      label: he.customer360ActivityLeadCreated(lead.title),
      href: { to: "/app/leads/$leadId", params: { leadId: lead.id } },
    });
  }

  for (const site of input.sites) {
    if (!site.created_at) continue;
    events.push({
      id: `site-${site.id}`,
      at: site.created_at,
      label: he.customer360ActivitySiteCreated(site.name),
      href: { to: "/app/sites/$siteId", params: { siteId: site.id } },
    });
  }

  for (const quote of input.quotes) {
    const at = quote.created_at ?? quote.updated_at;
    if (!at) continue;
    events.push({
      id: `quote-${quote.id}`,
      at,
      label: he.customer360ActivityQuoteCreated(quote.number),
      href: { to: "/app/quotes/$quoteId", params: { quoteId: quote.id } },
    });
  }

  for (const project of input.projects) {
    events.push({
      id: `project-${project.id}`,
      at: project.created_at,
      label: he.customer360ActivityProjectCreated(project.name),
    });
  }

  for (const call of input.serviceCalls) {
    events.push({
      id: `service-${call.id}`,
      at: call.created_at,
      label: he.customer360ActivityServiceOpened(call.title),
    });
  }

  return events
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 12);
}

export const CUSTOMER_PROFILE_TABS: { id: CustomerProfileTab; label: string }[] = [
  { id: "overview", label: he.customer360TabOverview },
  { id: "sites", label: he.customer360TabSites },
  { id: "quotes", label: he.customer360TabQuotes },
  { id: "projects", label: he.customer360TabProjects },
  { id: "service", label: he.customer360TabService },
  { id: "documents", label: he.customer360TabDocuments },
];

export function customerProfileTabs(counts: {
  sites: number;
  quotes: number;
  projects: number;
  service: number;
  documents: number;
}) {
  return CUSTOMER_PROFILE_TABS.map((tab) => {
    if (tab.id === "overview") return tab;
    const count =
      tab.id === "sites"
        ? counts.sites
        : tab.id === "quotes"
          ? counts.quotes
          : tab.id === "projects"
            ? counts.projects
            : tab.id === "service"
              ? counts.service
              : counts.documents;
    return { ...tab, count };
  });
}
