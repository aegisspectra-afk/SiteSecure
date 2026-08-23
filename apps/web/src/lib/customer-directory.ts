import type { CustomerOut, LeadOut, ProjectOut, QuoteOut, ServiceCallOut, SiteOut } from "@site-secure/api-client";
import { addressSearchBlob } from "./address";
import { he } from "../i18n/he";
import { customerStatusLabel, customerStatusTone, customerTypeLabel } from "./customer-profile";

export type CustomerDirectoryCounts = {
  sites: number;
  quotes: number;
  projects: number;
  service: number;
  leads: number;
  leadsNeedingAttention: number;
};

export type CustomerDirectoryRow = CustomerOut & {
  counts: CustomerDirectoryCounts;
};

export type CustomerDirectorySummary = {
  total: number;
  active: number;
  sites: number;
  leadsNeedingAttention: number;
};

export type CustomerDirectoryFilter = {
  status?: string;
  type?: string;
  hasSites?: boolean;
  hasOpenQuotes?: boolean;
  hasProjects?: boolean;
  hasService?: boolean;
  hasLeadAttention?: boolean;
};

const ATTENTION_LEAD_STATUSES = new Set([
  "new",
  "contacted",
  "visit_scheduling",
  "quote_preparing",
  "follow_up",
]);

export function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1);
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`;
}

export function countByCustomerId(rows: { customer_id?: string | null }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const id = row.customer_id;
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

export function leadAttentionByCustomer(leads: LeadOut[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const lead of leads) {
    if (!lead.customer_id) continue;
    if (!ATTENTION_LEAD_STATUSES.has(lead.status) && !lead.next_action?.trim()) continue;
    map.set(lead.customer_id, (map.get(lead.customer_id) ?? 0) + 1);
  }
  return map;
}

export function buildCustomerDirectoryRows(opts: {
  customers: CustomerOut[];
  sites: SiteOut[];
  quotes: QuoteOut[];
  projects: ProjectOut[];
  serviceCalls: ServiceCallOut[];
  leads: LeadOut[];
}): CustomerDirectoryRow[] {
  const sites = countByCustomerId(opts.sites);
  const quotes = countByCustomerId(opts.quotes);
  const projects = countByCustomerId(opts.projects);
  const service = countByCustomerId(opts.serviceCalls);
  const leads = countByCustomerId(opts.leads);
  const attention = leadAttentionByCustomer(opts.leads);

  return opts.customers.map((customer) => ({
    ...customer,
    counts: {
      sites: sites.get(customer.id) ?? 0,
      quotes: quotes.get(customer.id) ?? 0,
      projects: projects.get(customer.id) ?? 0,
      service: service.get(customer.id) ?? 0,
      leads: leads.get(customer.id) ?? 0,
      leadsNeedingAttention: attention.get(customer.id) ?? 0,
    },
  }));
}

export function summarizeDirectory(rows: CustomerDirectoryRow[]): CustomerDirectorySummary {
  return {
    total: rows.length,
    active: rows.filter((row) => row.status === "active" || !row.status).length,
    sites: rows.reduce((sum, row) => sum + row.counts.sites, 0),
    leadsNeedingAttention: rows.reduce((sum, row) => sum + row.counts.leadsNeedingAttention, 0),
  };
}

export function filterDirectoryRows(
  rows: CustomerDirectoryRow[],
  filter: CustomerDirectoryFilter,
): CustomerDirectoryRow[] {
  return rows.filter((row) => {
    if (filter.status && (row.status ?? "active") !== filter.status) return false;
    if (filter.type && (row.type ?? "private") !== filter.type) return false;
    if (filter.hasSites && row.counts.sites === 0) return false;
    if (filter.hasOpenQuotes && row.counts.quotes === 0) return false;
    if (filter.hasProjects && row.counts.projects === 0) return false;
    if (filter.hasService && row.counts.service === 0) return false;
    if (filter.hasLeadAttention && row.counts.leadsNeedingAttention === 0) return false;
    return true;
  });
}

/** Client-side match for name / phone / email / customer address / site addresses. */
export function customerMatchesDirectoryQuery(
  row: CustomerDirectoryRow,
  query: string,
  sites: SiteOut[],
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    row.display_name,
    row.phone ?? "",
    row.email ?? "",
    addressSearchBlob(row.billing_address),
    ...sites.filter((site) => site.customer_id === row.id).map((site) => addressSearchBlob(site.address)),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export function filterDirectoryByQuery(
  rows: CustomerDirectoryRow[],
  query: string,
  sites: SiteOut[],
): CustomerDirectoryRow[] {
  const needle = query.trim();
  if (!needle) return rows;
  return rows.filter((row) => customerMatchesDirectoryQuery(row, needle, sites));
}

export function activeFilterCount(filter: CustomerDirectoryFilter): number {
  return Object.values(filter).filter((value) => value === true || (typeof value === "string" && value.length > 0)).length;
}

export function formatCustomerMeta(counts: CustomerDirectoryCounts): string {
  const parts = [
    he.customerDirectorySites(counts.sites),
    he.customerDirectoryQuotes(counts.quotes),
    he.customerDirectoryProjects(counts.projects),
    he.customerDirectoryService(counts.service),
  ];
  if (counts.leads > 0) parts.push(he.customerDirectoryLeads(counts.leads));
  return parts.join(" · ");
}

export { customerStatusLabel, customerStatusTone, customerTypeLabel };
