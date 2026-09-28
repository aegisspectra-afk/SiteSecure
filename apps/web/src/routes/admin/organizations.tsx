import { ApiClientError } from "@site-secure/api-client";
import { Button, Input, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/admin/organizations")({
  component: AdminOrganizations,
});

function formatCreated(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("he-IL");
}

function AdminOrganizations() {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [planKey, setPlanKey] = useState("business");
  const [note, setNote] = useState("");
  const query = useQuery({ queryKey: ["admin-orgs"], queryFn: () => api.adminOrganizations() });
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
    const items = query.data ?? [];
    if (!needle) return items;
    return items.filter(
      (org) =>
        org.name.toLowerCase().includes(needle) ||
        (org.plan_key || "").toLowerCase().includes(needle) ||
        org.id.toLowerCase().includes(needle),
    );
  }, [query.data, q]);

  const errorMessage =
    query.error instanceof ApiClientError ? query.error.message : query.isError ? he.adminOrgsError : null;
  const createError =
    create.error instanceof ApiClientError ? create.error.message : create.isError ? he.adminOrgCreateError : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={he.adminOrgs} description={he.adminOrgsLead} />

      <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border p-4">
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
          <Link to="/admin/invitations" className="inline-flex h-10 items-center text-sm text-fg-muted underline">
            {he.adminInvitations}
          </Link>
        </div>
      </section>

      <Input
        id="admin-org-search"
        label={he.adminOrgSearch}
        value={q}
        onChange={(ev) => setQ(ev.target.value)}
        placeholder={he.adminOrgSearchPlaceholder}
      />
      {query.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
      {!query.isLoading && !errorMessage && rows.length === 0 ? (
        <p className="text-sm text-fg-muted">{he.adminOrgsEmpty}</p>
      ) : null}
      <div className="overflow-x-auto">
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
                <td className="py-3 text-fg-muted">{org.status}</td>
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
    </div>
  );
}
