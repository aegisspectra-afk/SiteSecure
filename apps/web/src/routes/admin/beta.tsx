import { Button, Checkbox, PageHeader, Select } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AdminTabPanel, AdminTabs } from "../../components/admin/AdminTabs";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

type BetaTab = "overview" | "badges" | "flags";

type BetaSearch = { tab: BetaTab };

export const Route = createFileRoute("/admin/beta")({
  validateSearch: (search: Record<string, unknown>): BetaSearch => {
    const tabRaw = typeof search.tab === "string" ? search.tab : "overview";
    const tab: BetaTab =
      tabRaw === "badges" || tabRaw === "flags" || tabRaw === "overview" ? tabRaw : "overview";
    return { tab };
  },
  component: AdminBeta,
});

function AdminBeta() {
  const { api } = useSession();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [badge, setBadge] = useState("");
  const tab = search.tab;

  const setTab = (next: BetaTab) => {
    void navigate({ search: { tab: next }, replace: true });
  };

  const orgs = useQuery({ queryKey: ["admin-orgs"], queryFn: () => api.adminOrganizations() });
  const participants = useQuery({
    queryKey: ["admin-beta-participants", status, badge],
    queryFn: () =>
      api.adminBetaParticipants({
        status: status || undefined,
        badge: badge || undefined,
      }),
    enabled: tab === "overview",
  });
  const flags = useQuery({
    queryKey: ["admin-flags"],
    queryFn: () => api.adminFeatureFlags(),
    enabled: tab === "flags",
  });

  const patchOrg = useMutation({
    mutationFn: (input: { id: string; is_beta: boolean }) =>
      api.adminPatchOrganization(input.id, {
        is_beta: input.is_beta,
        beta_program: input.is_beta ? "early" : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-audit"] });
    },
  });

  const patchFlag = useMutation({
    mutationFn: (input: { id: string; enabled_for_beta?: boolean; enabled_for_production?: boolean }) =>
      api.adminPatchFeatureFlag(input.id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-flags"] }),
  });

  const enrolled = useMemo(() => (orgs.data ?? []).filter((org) => org.is_beta), [orgs.data]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={he.adminBeta} description={he.adminBetaLead} />

      <AdminTabs
        ariaLabel={he.adminBetaTabs}
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: he.adminBetaTabOverview },
          { id: "badges", label: he.adminBadges },
          { id: "flags", label: he.adminFlags },
        ]}
      />

      <AdminTabPanel tabId="overview" active={tab === "overview"}>
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-fg">{he.adminBetaOrgs}</h3>
          {enrolled.length === 0 ? <p className="text-sm text-fg-muted">{he.adminBetaOff}</p> : null}
          <ul className="flex flex-col gap-2">
            {enrolled.map((org) => (
              <li
                key={org.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-border px-4 py-3"
              >
                <div>
                  <p className="font-medium text-fg">{org.name}</p>
                  <p className="ltr-meta mt-1 text-xs text-fg-muted">{org.beta_program ?? "early"}</p>
                </div>
                <Button variant="secondary" onClick={() => patchOrg.mutate({ id: org.id, is_beta: false })}>
                  {he.adminLeaveBeta}
                </Button>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-fg">{he.adminBetaParticipants}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              id="beta-filter-status"
              label={he.adminBetaFilterStatus}
              value={status}
              onChange={(ev) => setStatus(ev.target.value)}
            >
              <option value="">{he.adminFilterAll}</option>
              <option value="invited">{he.adminBetaStatusInvited}</option>
              <option value="registered">{he.adminBetaStatusRegistered}</option>
              <option value="activated">{he.adminBetaStatusActivated}</option>
              <option value="active">{he.adminBetaStatusActive}</option>
              <option value="paused">{he.adminBetaStatusPaused}</option>
              <option value="exited">{he.adminBetaStatusExited}</option>
            </Select>
            <Select
              id="beta-filter-badge"
              label={he.adminBetaFilterBadge}
              value={badge}
              onChange={(ev) => setBadge(ev.target.value)}
            >
              <option value="">{he.adminFilterAll}</option>
              <option value="founding_technician">{he.adminBadgeFounding}</option>
            </Select>
          </div>
          <div className="admin-lifecycle-desktop-table overflow-x-auto">
            <table className="w-full min-w-[48rem] text-start text-sm">
              <thead className="text-xs text-fg-muted">
                <tr>
                  <th className="py-2 font-medium">משתתף</th>
                  <th className="py-2 font-medium">סביבה</th>
                  <th className="py-2 font-medium">תפקיד</th>
                  <th className="py-2 font-medium">סטטוס</th>
                  <th className="py-2 font-medium">Cohort</th>
                  <th className="py-2 font-medium">Badge</th>
                </tr>
              </thead>
              <tbody>
                {(participants.data ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="py-3 text-fg">
                      {row.full_name || "—"}
                      <div className="ltr-meta text-xs text-fg-muted">{row.email}</div>
                    </td>
                    <td className="py-3 text-fg-muted">{row.workspace_name || row.workspace_id.slice(0, 8)}</td>
                    <td className="py-3 text-fg-muted">{row.role_key || "—"}</td>
                    <td className="py-3 text-fg">{row.status}</td>
                    <td className="py-3 text-fg-muted">{row.cohort}</td>
                    <td className="py-3 text-fg-muted">
                      {(row.recognition_badges || []).includes("founding_technician")
                        ? he.adminBadgeFounding
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </AdminTabPanel>

      <AdminTabPanel tabId="badges" active={tab === "badges"}>
        <p className="text-sm text-fg-muted">{he.adminBadgesLead}</p>
        <p className="text-sm text-fg-muted">{he.foundingTechnicianBadgeHint}</p>
        <div className="mt-3">
          <Link to="/admin/users" search={{ tab: "active" }}>
            <Button variant="secondary">{he.adminUsers}</Button>
          </Link>
        </div>
      </AdminTabPanel>

      <AdminTabPanel tabId="flags" active={tab === "flags"}>
        <ul className="flex flex-col gap-2">
          {(flags.data ?? []).map((flag) => (
            <li
              key={flag.id}
              className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border px-4 py-3"
            >
              <div>
                <p className="ltr-meta font-medium text-fg">{flag.name}</p>
                {flag.description ? <p className="mt-1 text-sm text-fg-muted">{flag.description}</p> : null}
              </div>
              <div className="flex flex-wrap gap-4">
                <Checkbox
                  label={he.adminFlagBeta}
                  checked={flag.enabled_for_beta}
                  onChange={(ev) => patchFlag.mutate({ id: flag.id, enabled_for_beta: ev.target.checked })}
                />
                <Checkbox
                  label={he.adminFlagProd}
                  checked={flag.enabled_for_production}
                  onChange={(ev) =>
                    patchFlag.mutate({ id: flag.id, enabled_for_production: ev.target.checked })
                  }
                />
              </div>
            </li>
          ))}
        </ul>
        {flags.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      </AdminTabPanel>
    </div>
  );
}
