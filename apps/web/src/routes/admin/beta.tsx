import { Button, PageHeader, Select } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/admin/beta")({
  component: AdminBeta,
});

function AdminBeta() {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [badge, setBadge] = useState("");

  const orgs = useQuery({ queryKey: ["admin-orgs"], queryFn: () => api.adminOrganizations() });
  const participants = useQuery({
    queryKey: ["admin-beta-participants", status, badge],
    queryFn: () =>
      api.adminBetaParticipants({
        status: status || undefined,
        badge: badge || undefined,
      }),
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

  const enrolled = useMemo(() => (orgs.data ?? []).filter((org) => org.is_beta), [orgs.data]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={he.adminBeta} description={he.adminBetaLead} />

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-fg">{he.adminBetaOrgs}</h3>
        {enrolled.length === 0 ? <p className="text-sm text-fg-muted">{he.adminBetaOff}</p> : null}
        <ul className="flex flex-col gap-3">
          {enrolled.map((org) => (
            <li key={org.id} className="ops-card flex items-center justify-between gap-3 px-4 py-4">
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

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-fg">{he.adminBetaParticipants}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select id="beta-filter-status" label={he.adminBetaFilterStatus} value={status} onChange={(ev) => setStatus(ev.target.value)}>
            <option value="">{he.adminFilterAll}</option>
            <option value="invited">{he.adminBetaStatusInvited}</option>
            <option value="registered">{he.adminBetaStatusRegistered}</option>
            <option value="activated">{he.adminBetaStatusActivated}</option>
            <option value="active">{he.adminBetaStatusActive}</option>
            <option value="paused">{he.adminBetaStatusPaused}</option>
            <option value="exited">{he.adminBetaStatusExited}</option>
          </Select>
          <Select id="beta-filter-badge" label={he.adminBetaFilterBadge} value={badge} onChange={(ev) => setBadge(ev.target.value)}>
            <option value="">{he.adminFilterAll}</option>
            <option value="founding_technician">{he.adminBadgeFounding}</option>
          </Select>
        </div>
        <div className="overflow-x-auto">
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
    </div>
  );
}
