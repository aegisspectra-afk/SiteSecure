import { Button, Select, Status, Table, TBody, TD, TH, THead, TR } from "@site-secure/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { NewLeadSheet } from "../../../components/leads/NewLeadSheet";
import { EmptyRows, ErrorState, ModuleScaffold, SearchCreateBar, useQuery } from "../../../components/modules/ModuleKit";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import {
  LEAD_PRIORITIES,
  LEAD_STATUSES,
  formatEstimatedValue,
  formatNextActionDate,
  leadDisplayTitle,
  leadPriorityLabel,
  leadRequirementsSummary,
  leadServiceLabel,
  leadStatusLabel,
  type LeadPriority,
  type LeadStatus,
} from "../../../lib/leads";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/leads/")({
  component: LeadsPage,
});

function LeadsPage() {
  return (
    <RequirePermission permission="leads.view">
      <LeadsBody />
    </RequirePermission>
  );
}

function LeadsBody() {
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const canCreate = can(membership?.role_key, "leads.create", features);
  const canCreateCustomer = can(membership?.role_key, "crm.create", features);
  const canCreateSite = can(membership?.role_key, "sites.create", features);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const [priorityFilter, setPriorityFilter] = useState<LeadPriority | "">("");
  const [sheetOpen, setSheetOpen] = useState(() => {
    try {
      if (sessionStorage.getItem("site-secure-open-new-lead") === "1") {
        sessionStorage.removeItem("site-secure-open-new-lead");
        return true;
      }
    } catch {
      /* ignore */
    }
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("new") === "1";
  });

  const listQuery = useQuery({
    queryKey: ["leads", workspaceId, q, statusFilter, priorityFilter],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      api.listLeads(workspaceId!, {
        q,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        limit: 100,
      }),
  });

  const rows = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);

  if (!workspaceId) return <ErrorState title={he.leadsError} />;
  if (listQuery.isError) return <ErrorState title={he.leadsError} />;

  return (
    <ModuleScaffold
      title={he.leadsTitle}
      lead={he.leadsLead}
      action={
        canCreate ? (
          <Button type="button" onClick={() => setSheetOpen(true)}>
            + {he.leadsCreate}
          </Button>
        ) : null
      }
    >
      <SearchCreateBar
        query={q}
        onQuery={setQ}
        canCreate={false}
        creating={false}
        onToggleCreate={() => setSheetOpen(true)}
        createLabel={he.leadsCreate}
      />
      <div className="flex flex-wrap gap-3">
        <Select id="lead-filter-status" label={he.status} value={statusFilter} onChange={(ev) => setStatusFilter(ev.target.value as LeadStatus | "")}>
          <option value="">{he.all}</option>
          {LEAD_STATUSES.map((value) => (
            <option key={value} value={value}>{he.leadStatuses[value]}</option>
          ))}
        </Select>
        <Select id="lead-filter-priority" label={he.leadsPriority} value={priorityFilter} onChange={(ev) => setPriorityFilter(ev.target.value as LeadPriority | "")}>
          <option value="">{he.all}</option>
          {LEAD_PRIORITIES.map((value) => (
            <option key={value} value={value}>{he.leadPriorities[value]}</option>
          ))}
        </Select>
      </div>

      {listQuery.isLoading ? (
        <EmptyRows message={he.loading} />
      ) : !rows.length ? (
        <EmptyRows message={he.leadsEmpty} />
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <THead>
                <TR>
                  <TH>{he.leadsLead}</TH>
                  <TH>{he.leadsServiceType}</TH>
                  <TH>{he.status}</TH>
                  <TH>{he.leadsPriority}</TH>
                  <TH>{he.leadsNextAction}</TH>
                  <TH>{he.leadsEstimatedValue}</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <Link to="/app/leads/$leadId" params={{ leadId: row.id }} className="font-medium text-fg hover:underline">
                        {leadDisplayTitle(row)}
                      </Link>
                      <p className="text-xs text-fg-muted">{[row.contact_name, row.phone].filter(Boolean).join(" · ")}</p>
                    </TD>
                    <TD>{leadServiceLabel(row.service_type)}</TD>
                    <TD><Status label={leadStatusLabel(row.status)} tone="info" /></TD>
                    <TD>{leadPriorityLabel(row.priority ?? "normal")}</TD>
                    <TD>
                      <p className="text-sm">{row.next_action || "—"}</p>
                      <p className="text-xs text-fg-muted">{formatNextActionDate(row.next_action_at)}</p>
                    </TD>
                    <TD>{formatEstimatedValue(row.estimated_value_cents)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          <div className="grid gap-3 md:hidden">
            {rows.map((row) => (
              <Link key={row.id} to="/app/leads/$leadId" params={{ leadId: row.id }} className="ops-card block p-4 hover:border-border-strong">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-fg">{leadDisplayTitle(row)}</p>
                    <p className="text-sm text-fg-muted">{leadRequirementsSummary(row)}</p>
                  </div>
                  <Status label={leadStatusLabel(row.status)} tone="info" />
                </div>
                <p className="mt-2 text-sm text-fg-muted">{row.next_action || "—"}</p>
              </Link>
            ))}
          </div>
        </>
      )}

      <NewLeadSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        workspaceId={workspaceId}
        api={api}
        canCreateCustomer={canCreateCustomer}
        canCreateSite={canCreateSite}
      />
    </ModuleScaffold>
  );
}
