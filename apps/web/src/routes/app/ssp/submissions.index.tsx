import { Button, Input, Select } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { useState } from "react";
import {
  EmptyRows,
  ErrorState,
  ModuleScaffold,
  SimpleEntityTable,
  useQuery,
} from "../../../components/modules/ModuleKit";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/ssp/submissions/")({
  component: SspSubmissionsPage,
});

function SspSubmissionsPage() {
  const { canViewSubmissions, isOfficer } = useSspWorkspace();
  if (!canViewSubmissions) {
    return <ErrorState title={he.forbiddenTitle} description={he.forbiddenBody} />;
  }
  if (isOfficer) {
    return <SspSubmissionsBody mine />;
  }
  return <SspSubmissionsBody />;
}

function SspSubmissionsBody({ mine = false }: { mine?: boolean }) {
  const { api, workspaceId } = useSspWorkspace();
  const [formId, setFormId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const forms = useQuery({
    queryKey: ["ssp-forms", workspaceId],
    enabled: Boolean(workspaceId) && !mine,
    queryFn: () => api.listSspForms(workspaceId!),
    retry: false,
  });
  const offices = useQuery({
    queryKey: ["ssp-sites", workspaceId, "actors"],
    enabled: Boolean(workspaceId) && !mine,
    queryFn: () => api.listSspSites(workspaceId!, { kind: "office,ops_center" }),
    retry: false,
  });
  const people = useQuery({
    queryKey: ["ssp-people", workspaceId, "active"],
    enabled: Boolean(workspaceId) && !mine,
    queryFn: () => api.listSspUsers(workspaceId!, { status: "active" }),
    retry: false,
  });
  const listQuery = useQuery({
    queryKey: ["ssp-submissions", workspaceId, formId, siteId, userId, status, fromDate, toDate, mine],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      api.listSspSubmissions(workspaceId!, {
        form_id: formId || undefined,
        site_id: siteId || undefined,
        submitted_by: userId || undefined,
        status: status || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      }),
    retry: false,
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div data-testid={mine ? "ssp-my-submissions-alias" : "ssp-submissions"}>
      <ModuleScaffold title={mine ? he.sspNavMySubmissions : he.sspSubmissions} lead={he.sspSubmissionsLead}>
        {!mine ? (
          <div className="ss-module-toolbar grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Select id="ssp-filter-form" label={he.sspFilterForm} value={formId} onChange={(e) => setFormId(e.target.value)}>
              <option value="">הכול</option>
              {(forms.data?.items ?? []).map((form) => (
                <option key={form.id} value={form.id}>
                  {form.title}
                </option>
              ))}
            </Select>
            <Select id="ssp-filter-office" label={he.sspFilterOffice} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">הכול</option>
              {(offices.data?.items ?? []).map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </Select>
            <Select id="ssp-filter-user" label={he.sspFilterUser} value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">הכול</option>
              {(people.data?.items ?? []).map((person) => (
                <option key={person.user_id} value={person.user_id}>
                  {person.full_name || person.email || person.user_id.slice(0, 8)}
                </option>
              ))}
            </Select>
            <Select id="ssp-filter-status" label={he.sspFilterStatus} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">הכול</option>
              <option value="submitted">{he.sspFillSubmitted}</option>
            </Select>
            <Input
              id="ssp-filter-from"
              label="מתאריך"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <Input id="ssp-filter-to" label="עד תאריך" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        ) : null}
        {listQuery.isError ? (
          <ErrorState
            title={he.apiUnavailable}
            action={
              <Button type="button" variant="secondary" onClick={() => void listQuery.refetch()}>
                {he.retry}
              </Button>
            }
          />
        ) : null}
        {listQuery.isLoading ? <EmptyRows message={he.loading} /> : null}
        {!listQuery.isLoading && !listQuery.isError && !(listQuery.data?.items.length) ? (
          <div className="ops-card flex flex-col items-start gap-3 p-6">
            <p className="text-base font-semibold text-fg">{he.sspNoSubmissions}</p>
          </div>
        ) : !listQuery.isLoading && !listQuery.isError ? (
          <SimpleEntityTable
            empty={he.sspNoSubmissions}
            leadingIcon={Inbox}
            rows={(listQuery.data?.items ?? []).map((row) => ({
              id: row.id,
              title: row.form_title || row.form_id.slice(0, 8),
              meta: [
                `${he.sspSubmittedAt}: ${new Date(row.submitted_at).toLocaleString("he-IL")}`,
                row.submitted_by_name || row.submitted_by
                  ? `${he.sspSubmittedBy}: ${row.submitted_by_name || row.submitted_by.slice(0, 8)}`
                  : "",
              ]
                .filter(Boolean)
                .join(" · "),
              status: row.status,
              href: `/app/ssp/submissions/${row.id}`,
            }))}
          />
        ) : null}
      </ModuleScaffold>
    </div>
  );
}
