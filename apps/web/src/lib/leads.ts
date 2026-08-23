import type { CustomerOut, LeadOut, QuoteOut, TaskOut } from "@site-secure/api-client";
import { he } from "../i18n/he";

export type LeadStatus =
  | "new"
  | "contacted"
  | "visit_scheduling"
  | "visit_scheduled"
  | "meeting"
  | "quote_preparing"
  | "spec"
  | "quoted"
  | "follow_up"
  | "won"
  | "lost"
  | "cancelled";

export type LeadPriority = "low" | "normal" | "high" | "urgent";

export type LeadSource =
  | "manual"
  | "phone"
  | "whatsapp"
  | "website"
  | "referral"
  | "advertising"
  | "facebook"
  | "instagram"
  | "existing_customer"
  | "other";

export type LeadServiceType =
  | "cctv"
  | "alarm"
  | "access_control"
  | "intercom"
  | "communication"
  | "low_voltage"
  | "infrastructure"
  | "maintenance"
  | "other";

export type VisitTimeWindow = "morning" | "afternoon" | "evening";

export type VisitStatus = "pending_schedule" | "scheduled" | "completed" | "cancelled" | "no_show";

export type LeadActivityEvent = {
  id: string;
  at: string;
  label: string;
  href?: string;
};

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "visit_scheduling",
  "visit_scheduled",
  "quote_preparing",
  "quoted",
  "follow_up",
  "won",
  "lost",
  "cancelled",
];

export const LEAD_PRIORITIES: LeadPriority[] = ["low", "normal", "high", "urgent"];

export const LEAD_SOURCES: LeadSource[] = [
  "whatsapp",
  "phone",
  "website",
  "facebook",
  "instagram",
  "referral",
  "existing_customer",
  "advertising",
  "manual",
  "other",
];

export const LEAD_SERVICE_TYPES: LeadServiceType[] = [
  "cctv",
  "alarm",
  "access_control",
  "intercom",
  "communication",
  "low_voltage",
  "infrastructure",
  "maintenance",
  "other",
];

export function leadStatusLabel(status: string): string {
  return he.leadStatuses[status as LeadStatus] ?? status;
}

export function leadPriorityLabel(priority: string): string {
  return he.leadPriorities[priority as LeadPriority] ?? priority;
}

export function leadSourceLabel(source: string): string {
  return he.leadSources[source as LeadSource] ?? source;
}

export function leadServiceLabel(service: string | null | undefined): string {
  if (!service) return "—";
  return he.leadServiceTypes[service as LeadServiceType] ?? service;
}

export function visitTimeWindowLabel(window: string | null | undefined): string {
  if (!window) return he.leadVisitTimeNotSet;
  return he.leadVisitTimeWindows[window as VisitTimeWindow] ?? window;
}

export function visitStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return he.leadVisitStatuses[status as VisitStatus] ?? status;
}

export function formatEstimatedValue(cents: number | null | undefined): string {
  if (cents == null) return he.leadValueUnknown;
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(
    cents / 100,
  );
}

export function leadDisplayTitle(lead: LeadOut): string {
  return lead.title?.trim() || leadServiceLabel(lead.service_type) || he.leadsLead;
}

export function leadAddressLine(lead: LeadOut, siteAddress?: string | null): string {
  return siteAddress?.trim() || lead.address_text?.trim() || "—";
}

export function leadRequirementsSummary(lead: LeadOut): string {
  const req = lead.requirements ?? {};
  const parts: string[] = [];
  if (req.camera_count) parts.push(he.leadReqCameras(req.camera_count));
  if (req.location) parts.push(req.location);
  if (req.infrastructure) parts.push(req.infrastructure);
  return parts.join(" · ") || lead.notes?.trim() || "—";
}

export function defaultLeadTitle(serviceType: LeadServiceType, address?: string): string {
  const service = leadServiceLabel(serviceType);
  if (address?.trim()) {
    const city = address.split(",").pop()?.trim();
    return city ? `${service} — ${city}` : `${service} — ${address.trim()}`;
  }
  return service;
}

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a ?? "");
  const nb = normalizePhone(b ?? "");
  if (!na || !nb) return false;
  return na === nb || na.endsWith(nb) || nb.endsWith(na);
}

export function leadPrimaryAction(status: string): "schedule_visit" | "open_visit" | "create_quote" | "open_quote" | "open_project" | null {
  if (status === "visit_scheduling" || status === "contacted" || status === "new") return "schedule_visit";
  if (status === "visit_scheduled" || status === "meeting") return "open_visit";
  if (status === "quote_preparing" || status === "spec") return "create_quote";
  if (status === "quoted" || status === "follow_up") return "open_quote";
  if (status === "won") return "open_project";
  return null;
}

export function statusAfterVisitScheduled(): LeadStatus {
  return "visit_scheduled";
}

export function statusAfterVisitCompleted(): LeadStatus {
  return "quote_preparing";
}

export function buildLeadActivity(opts: {
  lead: LeadOut;
  visits: TaskOut[];
  quotes: QuoteOut[];
}): LeadActivityEvent[] {
  const events: LeadActivityEvent[] = [];
  events.push({
    id: `lead-created-${opts.lead.id}`,
    at: opts.lead.created_at,
    label: he.leadActivityCreated,
  });
  if (opts.lead.customer_id) {
    events.push({
      id: `lead-customer-${opts.lead.id}`,
      at: opts.lead.updated_at,
      label: he.leadActivityCustomerLinked,
      href: `/app/customers/${opts.lead.customer_id}`,
    });
  }
  for (const visit of opts.visits) {
    if (visit.created_at) {
      events.push({
        id: `visit-created-${visit.id}`,
        at: visit.created_at,
        label: he.leadActivityVisitRequested,
      });
    }
    if (visit.visit_status === "scheduled" && visit.due_at) {
      events.push({
        id: `visit-scheduled-${visit.id}`,
        at: visit.updated_at,
        label: he.leadActivityVisitScheduled(formatVisitWhen(visit)),
      });
    }
    if (visit.visit_status === "completed") {
      events.push({
        id: `visit-done-${visit.id}`,
        at: visit.updated_at,
        label: he.leadActivityVisitCompleted,
      });
    }
  }
  for (const quote of opts.quotes) {
    events.push({
      id: `quote-${quote.id}`,
      at: quote.updated_at ?? quote.created_at ?? opts.lead.updated_at,
      label: he.leadActivityQuoteCreated(quote.number || quote.id.slice(0, 8)),
      href: `/app/quotes/${quote.id}`,
    });
    if (quote.status === "approved") {
      events.push({
        id: `quote-approved-${quote.id}`,
        at: quote.updated_at ?? opts.lead.updated_at,
        label: he.leadActivityQuoteApproved(quote.number || quote.id.slice(0, 8)),
        href: `/app/quotes/${quote.id}`,
      });
    }
  }
  return events.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function formatVisitWhen(visit: TaskOut): string {
  if (!visit.due_at) {
    return visit.time_window ? visitTimeWindowLabel(visit.time_window) : he.leadVisitTimeNotSet;
  }
  const dt = new Date(visit.due_at);
  if (Number.isNaN(dt.getTime())) return he.leadVisitTimeNotSet;
  const date = dt.toLocaleDateString("he-IL");
  // Midnight UTC marker = date only (window or "not scheduled"), never invent a clock time.
  const isDateMarker =
    dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0 && dt.getUTCSeconds() === 0;
  if (isDateMarker) {
    return visit.time_window ? `${date} · ${visitTimeWindowLabel(visit.time_window)}` : date;
  }
  const time = dt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

export function formatNextActionDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function customerMatchHint(customer: CustomerOut, lead: { contact_name?: string | null; phone?: string | null }): boolean {
  const name = lead.contact_name?.trim();
  if (name && customer.display_name.trim().includes(name)) return true;
  return phonesMatch(customer.phone, lead.phone);
}

export function isoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** @deprecated Prefer date marker + time_window; do not invent afternoon clock times. */
export function afternoonSlotIso(dateOnly: string): string {
  return `${dateOnly}T00:00:00.000Z`;
}

export function isDateOnlyVisitMarker(dueAt: string | null | undefined): boolean {
  if (!dueAt) return false;
  const dt = new Date(dueAt);
  return !Number.isNaN(dt.getTime()) && dt.getUTCHours() === 0 && dt.getUTCMinutes() === 0 && dt.getUTCSeconds() === 0;
}
