import { ApiClientError } from "@site-secure/api-client";
import { Button, Input, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminSummaryStrip, AdminTabPanel, AdminTabs } from "../../components/admin/AdminTabs";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

type OrgsTab = "active" | "archived";

type OrgsSearch = {
  tab: OrgsTab;
  q?: string;
};

export const Route = createFileRoute("/admin/organizations")({
  validateSearch: (search: Record<string, unknown>): OrgsSearch => {
    const tabRaw = typeof search.tab === "string" ? search.tab : "active";
    return {
      tab: tabRaw === "archived" ? "archived" : "active",
      q: typeof search.q === "string" ? search.q : undefined,
    };
  },
  component: AdminOrganizations,
});

function formatCreated(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("he-IL");
}

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("he-IL");
}

function AdminOrganizations() {
  const { api } = useSession();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [planKey, setPlanKey] = useState("business");
  const [note, setNote] = useState("");
  const tab = search.tab;
  const q = search.q ?? "";

  const setSearch = (patch: Partial<OrgsSearch>) => {
    void navigate({
      search: (prev) => ({ ...prev, ...patch }),
      replace: true,
    });
  };

  const query = useQuery({ queryKey: ["admin-orgs"], queryFn: () => api.adminOrganizations() });
  const archiveWs = useQuery({
    queryKey: ["admin-archive", "workspaces", q],
    queryFn: () =>
      api.adminArchive({
        kind: "workspaces",
        q: q.trim() || undefined,
        limit: 500,
      }),
    enabled: tab === "archived" || true,
  });

  const patch = useMutation({
    mutationFn: (input: { id: string; is_beta: boolean }) =>
      api.adminPatchOrganization(input.id, { is_beta: input.is_beta }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-summary"] });
    },
  });
  const create = useMutation({
    mutationFn: () =>
      api.adminCreateOrganization({
        name: name.trim(),
        plan_key: planKey,
        is_beta: true,
        beta_program: "early",
        internal_note: note.trim() || null,
      }),
    onSuccess: () => {
      setName("");
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-summary"] });
    },
  });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const items = (query.data ?? []).filter((org) => String(org.status || "") === "active");
    if (!needle) return items;
    return items.filter(
      (org) =>
        org.name.toLowerCase().includes(needle) ||
        (org.plan_key || "").toLowerCase().includes(needle) ||
        org.id.toLowerCase().includes(needle),
    );
  }, [query.data, q]);

  const activeOrgCount = useMemo(
    () => (query.data ?? []).filter((org) => String(org.status || "") === "active").length,
    [query.data],
  );
  const archivedRows = archiveWs.data?.workspaces ?? [];

  const errorMessage =
    query.error instanceof ApiClientError ? query.error.message : query.isError ? he.adminOrgsError : null;
  const createError =
    create.error instanceof ApiClientError ? create.error.message : create.isError ? he.adminOrgCreateError : null;
  const archiveError =
    archiveWs.error instanceof ApiClientError
      ? archiveWs.error.message
      : archiveWs.isError
        ? he.adminArchiveError
        : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={he.adminOrgs} description={he.adminOrgsLead} />

      <AdminSummaryStrip
        items={[
          { label: he.adminOrgsTabActive, value: activeOrgCount },
          { label: he.adminOrgsTabArchived, value: archivedRows.length },
        ]}
      />

      <AdminTabs
        ariaLabel={he.adminOrgsTabs}
        value={tab}
        onChange={(next) => setSearch({ tab: next })}
        tabs={[
          { id: "active", label: he.adminOrgsTabActive, count: activeOrgCount },
          { id: "archived", label: he.adminOrgsTabArchived, count: archivedRows.length },
        ]}
      />

      <AdminTabPanel tabId="active" active={tab === "active"}>
        <section className="admin-lifecycle-compose flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-fg">{he.adminOrgCreateTitle}</h2>
          <p className="text-xs text-fg-muted">{he.adminOrgCreateHint}</p>
          <Input
            id="admin-org-name"
            label={he.adminOrgName}
            value={name}
            onChange={(ev) => setName(ev.target.value)}
            placeholder={he.adminOrgNamePlaceholder}
          />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-fg-muted">{he.adminOrgPlan}</span>
            <select
              className="h-10 rounded-[var(--radius-control)] border border-border bg-bg px-3 text-fg"
              value={planKey}
              onChange={(ev) => setPlanKey(ev.target.value)}
            >
              <option value="business">business</option>
              <option value="solo">solo</option>
              <option value="enterprise">enterprise</option>
            </select>
          </label>
          <Input
            id="admin-org-note"
            label={he.adminOrgNote}
            value={note}
            onChange={(ev) => setNote(ev.target.value)}
            placeholder={he.adminOrgNotePlaceholder}
          />
          {createError ? (
            <p className="text-sm text-danger" role="alert">
              {createError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={name.trim().length < 2}
              loading={create.isPending}
              onClick={() => create.mutate()}
            >
              {he.adminOrgCreateCta}
            </Button>
            <Link
              to="/admin/users"
              search={{ tab: "invitations" }}
              className="inline-flex h-10 items-center text-sm text-fg-muted underline"
            >
              {he.adminInvitations}
            </Link>
          </div>
        </section>

        <Input
          id="admin-org-search"
          label={he.adminOrgSearch}
          value={q}
          onChange={(ev) => setSearch({ q: ev.target.value || undefined })}
          placeholder={he.adminOrgSearchPlaceholder}
        />
        {query.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
        {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
        {!query.isLoading && !errorMessage && rows.length === 0 ? (
          <p className="text-sm text-fg-muted">{he.adminOrgsEmpty}</p>
        ) : null}

        <div className="admin-lifecycle-desktop-table overflow-x-auto">
          <table className="w-full min-w-[48rem] text-start text-sm">
            <thead className="text-xs text-fg-muted">
              <tr>
                <th className="py-2 font-medium">שם</th>
                <th className="py-2 font-medium">{he.adminOrgStatus}</th>
                <th className="py-2 font-medium">תוכנית</th>
                <th className="py-2 font-medium">{he.adminOrgCreated}</th>
                <th className="py-2 font-medium">{he.adminBeta}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((org) => (
                <tr key={org.id} className="border-t border-border">
                  <td className="py-3 font-medium text-fg">{org.name}</td>
                  <td className="py-3">
                    <span className="admin-status-chip is-active">{org.status}</span>
                  </td>
                  <td className="ltr-meta py-3 text-fg-muted">{org.plan_key ?? "—"}</td>
                  <td className="ltr-meta py-3 text-fg-muted">{formatCreated(org.created_at)}</td>
                  <td className="py-3 text-fg-muted">{org.is_beta ? he.adminBetaOn : he.adminNotInBeta}</td>
                  <td className="py-3 text-end">
                    <Button
                      variant="secondary"
                      onClick={() => patch.mutate({ id: org.id, is_beta: !org.is_beta })}
                    >
                      {org.is_beta ? he.adminLeaveBeta : he.adminEnrollBeta}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="admin-lifecycle-mobile-list">
          {rows.map((org) => (
            <li key={org.id} className="admin-user-card">
              <p className="font-medium text-fg">{org.name}</p>
              <p className="mt-1 text-xs text-fg-muted">
                {org.plan_key ?? "—"} · {org.is_beta ? he.adminBetaOn : he.adminNotInBeta}
              </p>
              <div className="mt-3">
                <Button
                  variant="secondary"
                  onClick={() => patch.mutate({ id: org.id, is_beta: !org.is_beta })}
                >
                  {org.is_beta ? he.adminLeaveBeta : he.adminEnrollBeta}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </AdminTabPanel>

      <AdminTabPanel tabId="archived" active={tab === "archived"}>
        <p className="text-sm text-fg-muted">{he.adminOrgsArchivedLead}</p>
        <Input
          id="admin-org-archive-search"
          label={he.adminArchiveSearch}
          value={q}
          onChange={(ev) => setSearch({ q: ev.target.value || undefined })}
          placeholder={he.adminArchiveSearchPlaceholder}
        />
        {archiveWs.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
        {archiveError ? <p className="text-sm text-danger">{archiveError}</p> : null}
        {!archiveWs.isLoading && archivedRows.length === 0 ? (
          <p className="text-sm text-fg-muted">{he.adminOrgsEmptyArchived}</p>
        ) : null}

        <div className="admin-lifecycle-desktop-table overflow-x-auto">
          <table className="w-full min-w-[40rem] text-start text-sm">
            <thead className="text-xs text-fg-muted">
              <tr>
                <th className="py-2 font-medium">{he.adminArchiveColName}</th>
                <th className="py-2 font-medium">{he.adminArchiveColBatch}</th>
                <th className="py-2 font-medium">{he.adminArchiveColWhen}</th>
                <th className="py-2 font-medium">{he.adminArchiveColNote}</th>
              </tr>
            </thead>
            <tbody>
              {archivedRows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="py-3 font-medium text-fg">{row.name}</td>
                  <td className="ltr-meta py-3 text-fg-muted">{row.archive_batch}</td>
                  <td className="ltr-meta py-3 text-fg-muted">{formatWhen(row.archived_at)}</td>
                  <td className="py-3 text-fg-muted">{row.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="admin-lifecycle-mobile-list">
          {archivedRows.map((row) => (
            <li key={row.id} className="admin-user-card">
              <p className="font-medium text-fg">{row.name}</p>
              <p className="ltr-meta mt-1 text-xs text-fg-muted">{row.archive_batch}</p>
              <p className="ltr-meta mt-1 text-xs text-fg-muted">{formatWhen(row.archived_at)}</p>
            </li>
          ))}
        </ul>
      </AdminTabPanel>
    </div>
  );
}
