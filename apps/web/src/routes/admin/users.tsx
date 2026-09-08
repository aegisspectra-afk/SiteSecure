import { Button, Input, PageHeader, Select } from "@site-secure/ui";
import type { BetaParticipantStatus } from "@site-secure/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

const BADGE_OPTIONS = [
  { value: "founding_technician", label: he.adminBadgeFounding },
  { value: "verified_technician", label: he.adminBadgeVerified },
  { value: "early_access", label: he.adminBadgeEarly },
] as const;

const BETA_STATUSES: Array<{ value: BetaParticipantStatus; label: string }> = [
  { value: "invited", label: he.adminBetaStatusInvited },
  { value: "registered", label: he.adminBetaStatusRegistered },
  { value: "activated", label: he.adminBetaStatusActivated },
  { value: "active", label: he.adminBetaStatusActive },
  { value: "paused", label: he.adminBetaStatusPaused },
  { value: "exited", label: he.adminBetaStatusExited },
];

function AdminUsers() {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [betaStatus, setBetaStatus] = useState<BetaParticipantStatus>("active");
  const [betaWorkspaceId, setBetaWorkspaceId] = useState("");
  const [betaNote, setBetaNote] = useState("");

  const query = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => api.adminUsers({ q: search.trim() || undefined }),
  });

  const selected = useMemo(
    () => (query.data ?? []).find((row) => row.id === selectedId) ?? null,
    [query.data, selectedId],
  );

  const patchBadges = useMutation({
    mutationFn: (input: { id: string; recognition_badges: string[] }) =>
      api.adminPatchUserBadges(input.id, {
        recognition_badges: input.recognition_badges,
        reason: "admin_users_ui",
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const patchBeta = useMutation({
    mutationFn: () => {
      if (!selected || !betaWorkspaceId) throw new Error("missing workspace");
      return api.adminPatchUserBeta(selected.id, {
        workspace_id: betaWorkspaceId,
        status: betaStatus,
        cohort: "Founding Technicians — 2026",
        internal_note: betaNote.trim() || null,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-beta-participants"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-audit"] });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={he.adminUsers} description={he.adminUsersLead} />
      <Input
        id="admin-user-search"
        label={he.adminUserSearch}
        value={search}
        onChange={(ev) => setSearch(ev.target.value)}
        placeholder="email / name"
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-start text-sm">
          <thead className="text-xs text-fg-muted">
            <tr>
              <th className="py-2 font-medium">שם</th>
              <th className="py-2 font-medium">דוא״ל</th>
              <th className="py-2 font-medium">תפקיד / סביבה</th>
              <th className="py-2 font-medium">Beta</th>
              <th className="py-2 font-medium">Badge</th>
              <th className="py-2 font-medium">פלטפורמה</th>
              <th className="py-2 font-medium">בחירה</th>
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map((row) => {
              const badges = row.recognition_badges ?? [];
              const beta = row.beta_participations?.[0];
              return (
                <tr key={row.id} className="border-t border-border">
                  <td className="py-3 text-fg">{row.full_name || "—"}</td>
                  <td className="ltr-meta py-3 text-fg-muted">{row.email}</td>
                  <td className="py-3 text-fg-muted">
                    {row.memberships
                      .map((m) => `${m.role_key} · ${m.workspace_name || m.workspace_id.slice(0, 8)}`)
                      .join(" · ") || "—"}
                  </td>
                  <td className="py-3 text-fg-muted">{beta?.status ?? "—"}</td>
                  <td className="py-3 text-fg-muted">
                    {badges.length
                      ? badges
                          .map((b) => BADGE_OPTIONS.find((o) => o.value === b)?.label ?? b)
                          .join(" · ")
                      : "—"}
                  </td>
                  <td className="py-3 text-fg-muted">
                    {row.is_platform_admin ? row.platform_role || "platform_super_admin" : "—"}
                  </td>
                  <td className="py-3">
                    <Button
                      variant={selectedId === row.id ? "primary" : "ghost"}
                      onClick={() => {
                        setSelectedId(row.id);
                        setBetaWorkspaceId(row.memberships[0]?.workspace_id || "");
                        setBetaStatus((row.beta_participations?.[0]?.status as BetaParticipantStatus) || "active");
                        setBetaNote(row.beta_participations?.[0]?.internal_note || "");
                      }}
                    >
                      {he.adminSelectUser}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected ? (
        <section className="ops-card flex flex-col gap-3 p-4" aria-label={he.adminManageUser}>
          <h3 className="text-base font-semibold text-fg">
            {selected.full_name || selected.email} · {he.adminManageUser}
          </h3>
          <p className="text-sm text-fg-muted">{he.adminManageUserHint}</p>

          <div className="flex flex-wrap gap-2">
            {BADGE_OPTIONS.map((opt) => {
              const badges = selected.recognition_badges ?? [];
              const on = badges.includes(opt.value);
              return (
                <Button
                  key={opt.value}
                  variant={on ? "secondary" : "ghost"}
                  disabled={patchBadges.isPending}
                  onClick={() =>
                    patchBadges.mutate({
                      id: selected.id,
                      recognition_badges: on
                        ? badges.filter((b) => b !== opt.value)
                        : [...badges, opt.value],
                    })
                  }
                >
                  {on ? `− ${opt.label}` : `+ ${opt.label}`}
                </Button>
              );
            })}
            {(selected.recognition_badges ?? []).length ? (
              <Button
                variant="ghost"
                disabled={patchBadges.isPending}
                onClick={() => patchBadges.mutate({ id: selected.id, recognition_badges: [] })}
              >
                {he.adminBadgeClear}
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              id="admin-beta-workspace"
              label={he.adminBetaWorkspace}
              value={betaWorkspaceId}
              onChange={(ev) => setBetaWorkspaceId(ev.target.value)}
            >
              <option value="">—</option>
              {selected.memberships.map((m) => (
                <option key={m.workspace_id} value={m.workspace_id}>
                  {m.workspace_name || m.workspace_id} · {m.role_key}
                </option>
              ))}
            </Select>
            <Select
              id="admin-beta-status"
              label={he.adminManageBeta}
              value={betaStatus}
              onChange={(ev) => setBetaStatus(ev.target.value as BetaParticipantStatus)}
            >
              {BETA_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Input
              id="admin-beta-note"
              label={he.adminBetaNote}
              value={betaNote}
              onChange={(ev) => setBetaNote(ev.target.value)}
            />
          </div>
          <Button
            disabled={!betaWorkspaceId || patchBeta.isPending}
            onClick={() => patchBeta.mutate()}
          >
            {he.adminSaveBeta}
          </Button>
          {patchBeta.isError ? <p className="text-sm text-danger">{he.adminSaveFailed}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
