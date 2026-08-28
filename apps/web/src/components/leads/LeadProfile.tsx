import { ApiClientError, type ApiClient, type LeadOut } from "@site-secure/api-client";
import { Button, Status } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarClock, MapPin, Phone, Plus, User } from "lucide-react";
import { useMemo, useState } from "react";
import { addressLine } from "../modules/ModuleKit";
import { he } from "../../i18n/he";
import {
  buildLeadActivity,
  formatEstimatedValue,
  formatNextActionDate,
  leadAddressLine,
  leadDisplayTitle,
  leadPrimaryAction,
  leadPriorityLabel,
  leadRequirementsSummary,
  leadServiceLabel,
  leadSourceLabel,
  leadStatusLabel,
  visitStatusLabel,
  formatVisitWhen,
} from "../../lib/leads";
import { quoteCreateSearch } from "../../lib/workflow-context";
import { ScheduleVisitSheet } from "./ScheduleVisitSheet";

export function LeadProfile({
  leadId,
  workspaceId,
  api,
  canEdit,
  canCreateQuote,
  canCreateCustomer,
  canCreateSite,
}: {
  leadId: string;
  workspaceId: string;
  api: ApiClient;
  canEdit: boolean;
  canCreateQuote: boolean;
  canCreateCustomer: boolean;
  canCreateSite: boolean;
}) {
  const queryClient = useQueryClient();
  const [visitOpen, setVisitOpen] = useState(false);

  const leadQuery = useQuery({
    queryKey: ["lead", workspaceId, leadId],
    queryFn: () => api.getLead(workspaceId, leadId),
  });

  const visitsQuery = useQuery({
    queryKey: ["lead-visits", workspaceId, leadId],
    queryFn: () => api.listTasks(workspaceId, { lead_id: leadId, type: "visit", limit: 20 }),
  });

  const quotesQuery = useQuery({
    queryKey: ["lead-quotes", workspaceId, leadId],
    queryFn: async () => {
      const res = await api.listQuotes(workspaceId, { lead_id: leadId, limit: 50 });
      return res.items;
    },
  });

  const lead = leadQuery.data;
  const quotes = quotesQuery.data ?? [];
  const approvedQuote = quotes.find((q) => q.status === "approved");
  const primaryPreview = lead ? leadPrimaryAction(lead.status) : null;

  const linkedProjectQuery = useQuery({
    queryKey: ["lead-project", workspaceId, approvedQuote?.id],
    enabled: Boolean(primaryPreview === "open_project" && approvedQuote?.id),
    queryFn: async () => {
      const res = await api.listProjects(workspaceId, { source_quote_id: approvedQuote!.id, limit: 1 });
      return res.items[0] ?? null;
    },
  });

  const customerQuery = useQuery({
    queryKey: ["customer", workspaceId, leadQuery.data?.customer_id],
    enabled: Boolean(leadQuery.data?.customer_id),
    queryFn: () => api.getCustomer(workspaceId, leadQuery.data!.customer_id!),
  });

  const siteQuery = useQuery({
    queryKey: ["site", workspaceId, leadQuery.data?.site_id],
    enabled: Boolean(leadQuery.data?.site_id),
    queryFn: () => api.getSite(workspaceId, leadQuery.data!.site_id!),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["lead", workspaceId, leadId] });
    void queryClient.invalidateQueries({ queryKey: ["lead-visits", workspaceId, leadId] });
    void queryClient.invalidateQueries({ queryKey: ["lead-quotes", workspaceId, leadId] });
    void queryClient.invalidateQueries({ queryKey: ["leads", workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ["customers", workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ["directory-leads", workspaceId] });
  };

  const visits = visitsQuery.data?.items ?? [];
  const activity = useMemo(
    () => (lead ? buildLeadActivity({ lead, visits, quotes }) : []),
    [lead, visits, quotes],
  );

  const primary = lead ? leadPrimaryAction(lead.status) : null;
  const siteAddress = siteQuery.data ? addressLine(siteQuery.data.address) : null;
  const linkedProject = linkedProjectQuery.data ?? null;
  const linkCustomer = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      if (!canCreateCustomer) throw new ApiClientError(403, "FORBIDDEN", he.forbiddenTitle);
      const customer = await api.createCustomer(workspaceId, {
        display_name: lead.contact_name?.trim() || lead.title,
        phone: lead.phone ?? undefined,
        email: lead.email ?? undefined,
      });
      let siteId = lead.site_id ?? undefined;
      if (!siteId && canCreateSite && lead.address_text?.trim()) {
        const site = await api.createSite(workspaceId, {
          customer_id: customer.id,
          name: lead.address_text.trim(),
          address: { line: lead.address_text.trim() },
        });
        siteId = site.id;
      }
      await api.patchLead(workspaceId, lead.id, {
        customer_id: customer.id,
        site_id: siteId,
      });
    },
    onSuccess: invalidate,
  });

  if (leadQuery.isLoading || !lead) {
    return <p className="text-sm text-fg-muted">{he.loading}</p>;
  }

  return (
    <div className="customer-360 space-y-6">
      <header className="customer-360-header">
        <div className="min-w-0">
          <Link to="/app/leads" className="text-sm text-fg-muted hover:text-fg">
            {he.leadsTitle}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg">{leadDisplayTitle(lead)}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Status label={leadStatusLabel(lead.status)} tone="info" />
            <Status
              label={leadPriorityLabel(lead.priority ?? "normal")}
              tone={lead.priority === "high" || lead.priority === "urgent" ? "warning" : "neutral"}
            />
          </div>
          <div className="mt-3 grid gap-1 text-sm text-fg-muted">
            {lead.contact_name || customerQuery.data ? (
              <p className="inline-flex items-center gap-2">
                <User className="size-4 shrink-0" aria-hidden />
                {customerQuery.data ? (
                  <Link
                    to="/app/customers/$customerId"
                    params={{ customerId: customerQuery.data.id }}
                    className="font-medium text-fg hover:underline"
                  >
                    {customerQuery.data.display_name}
                  </Link>
                ) : (
                  lead.contact_name
                )}
              </p>
            ) : null}
            {lead.phone || customerQuery.data?.phone ? (
              <p className="inline-flex items-center gap-2" dir="ltr">
                <Phone className="size-4 shrink-0" aria-hidden />
                {lead.phone || customerQuery.data?.phone}
              </p>
            ) : null}
            <p className="inline-flex items-center gap-2">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {leadAddressLine(lead, siteAddress)}
            </p>
            {lead.next_action ? (
              <p className="inline-flex items-center gap-2">
                <CalendarClock className="size-4 shrink-0" aria-hidden />
                {lead.next_action}
                {lead.next_action_at ? ` · ${formatNextActionDate(lead.next_action_at)}` : null}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!lead.customer_id && canCreateCustomer ? (
            <Button type="button" variant="secondary" loading={linkCustomer.isPending} onClick={() => linkCustomer.mutate()}>
              <Plus aria-hidden />
              {he.leadsCreateCustomer}
            </Button>
          ) : null}
          {(primary === "schedule_visit" || primary === "open_visit") && canEdit ? (
            <Button type="button" onClick={() => setVisitOpen(true)}>
              <Plus aria-hidden />
              {primary === "open_visit" ? he.leadsOpenVisit : he.leadsScheduleVisit}
            </Button>
          ) : null}
          {primary === "create_quote" && canCreateQuote && lead.customer_id ? (
            <Link
              to="/app/quotes/new"
              search={quoteCreateSearch({
                customerId: lead.customer_id,
                siteId: lead.site_id ?? undefined,
                leadId: lead.id,
              })}
              className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg hover:opacity-90"
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              {he.leadsCreateQuote}
            </Link>
          ) : null}
          {(primary === "open_quote" || primary === "open_project") && quotes[0] ? (
            primary === "open_project" && linkedProject ? (
              <Link
                to="/app/projects/$projectId"
                params={{ projectId: linkedProject.id }}
                className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg"
              >
                {he.leadsOpenProject}
              </Link>
            ) : (
              <Link
                to="/app/quotes/$quoteId"
                params={{ quoteId: (approvedQuote ?? quotes[0]).id }}
                className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg"
              >
                {primary === "open_project" ? he.leadsOpenProject : he.leadsOpenQuote}
              </Link>
            )
          ) : null}
        </div>
      </header>

      {!lead.customer_id ? (
        <section className="ops-card p-4">
          <p className="text-sm font-medium text-fg">{he.leadsLinkCustomerNeeded}</p>
          <p className="mt-1 text-sm text-fg-muted">{he.leadsLinkCustomerNeededBody}</p>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="ops-card space-y-4 p-5">
          <h2 className="text-base font-semibold text-fg">{he.leadsRequirements}</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-fg-muted">{he.leadsServiceType}</dt>
              <dd className="font-medium">{leadServiceLabel(lead.service_type)}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">{he.leadsSource}</dt>
              <dd className="font-medium">{leadSourceLabel(lead.source)}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">{he.leadsEstimatedValue}</dt>
              <dd className="font-medium">{formatEstimatedValue(lead.estimated_value_cents)}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">{he.leadsProperty}</dt>
              <dd className="font-medium">{lead.property_notes?.trim() || "—"}</dd>
            </div>
          </dl>
          <p className="text-sm text-fg">{leadRequirementsSummary(lead)}</p>
          {lead.notes ? <p className="text-sm text-fg-muted">{lead.notes}</p> : null}
        </section>

        <section className="ops-card space-y-3 p-5">
          <h2 className="text-base font-semibold text-fg">{he.leadsVisitTitle}</h2>
          {visits.length ? (
            visits.map((visit) => (
              <article key={visit.id} className="rounded-[var(--radius-card)] border border-border p-3">
                <p className="text-sm font-medium">{visit.title}</p>
                <p className="text-sm text-fg-muted">{formatVisitWhen(visit)}</p>
                <p className="text-xs text-fg-muted">{visitStatusLabel(visit.visit_status)}</p>
                {canEdit && visit.status !== "done" ? (
                  <CompleteVisitButton workspaceId={workspaceId} api={api} lead={lead} visitId={visit.id} onDone={invalidate} />
                ) : null}
              </article>
            ))
          ) : (
            <p className="text-sm text-fg-muted">{he.leadsVisitPending}</p>
          )}
        </section>
      </div>

      <section className="ops-card p-5">
        <h2 className="text-base font-semibold text-fg">{he.customer360Timeline}</h2>
        <ul className="mt-4 space-y-3">
          {activity.slice(0, 12).map((event) => (
            <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="text-fg-muted tabular-nums">
                {new Date(event.at).toLocaleString("he-IL", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              {event.href?.startsWith("/app/quotes/") ? (
                <Link
                  to="/app/quotes/$quoteId"
                  params={{ quoteId: event.href.slice("/app/quotes/".length) }}
                  className="font-medium text-fg hover:underline"
                >
                  {event.label}
                </Link>
              ) : event.href?.startsWith("/app/customers/") ? (
                <Link
                  to="/app/customers/$customerId"
                  params={{ customerId: event.href.slice("/app/customers/".length) }}
                  className="font-medium text-fg hover:underline"
                >
                  {event.label}
                </Link>
              ) : (
                <span className="font-medium text-fg">{event.label}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <ScheduleVisitSheet
        open={visitOpen}
        onClose={() => setVisitOpen(false)}
        workspaceId={workspaceId}
        api={api}
        lead={lead}
        onUpdated={invalidate}
      />
    </div>
  );
}

function CompleteVisitButton({
  workspaceId,
  api,
  lead,
  visitId,
  onDone,
}: {
  workspaceId: string;
  api: ApiClient;
  lead: LeadOut;
  visitId: string;
  onDone: () => void;
}) {
  const complete = useMutation({
    mutationFn: async () => {
      await api.patchTask(workspaceId, visitId, { status: "done", visit_status: "completed" });
      await api.patchLead(workspaceId, lead.id, { status: "quote_preparing" });
    },
    onSuccess: onDone,
  });
  return (
    <Button type="button" variant="secondary" className="mt-2" loading={complete.isPending} onClick={() => complete.mutate()}>
      {he.leadsVisitComplete}
    </Button>
  );
}
