import { ApiClientError, type AdminUser, type BetaParticipantStatus } from "@site-secure/api-client";
import { Button, Input, Modal, PageHeader, Select } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AdminInvitationsPanel,
  type InviteStatusFilter,
} from "../../components/admin/AdminInvitationsPanel";
import {
  AdminSummaryStrip,
  AdminTabPanel,
  AdminTabs,
  primaryRole,
  userInitials,
} from "../../components/admin/AdminTabs";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

type UsersTab = "active" | "archived" | "invitations";

type UsersSearch = {
  tab: UsersTab;
  q?: string;
  workspace?: string;
  role?: string;
  inviteStatus?: InviteStatusFilter;
};

export const Route = createFileRoute("/admin/users")({
  validateSearch: (search: Record<string, unknown>): UsersSearch => {
    const tabRaw = typeof search.tab === "string" ? search.tab : "active";
    const tab: UsersTab =
      tabRaw === "archived" || tabRaw === "invitations" || tabRaw === "active" ? tabRaw : "active";
    const inviteRaw = typeof search.inviteStatus === "string" ? search.inviteStatus : "all";
    const inviteStatus: InviteStatusFilter =
      inviteRaw === "pending" ||
      inviteRaw === "accepted" ||
      inviteRaw === "expired" ||
      inviteRaw === "revoked" ||
      inviteRaw === "all"
        ? inviteRaw
        : "all";
    return {
      tab,
      q: typeof search.q === "string" ? search.q : undefined,
      workspace: typeof search.workspace === "string" ? search.workspace : undefined,
      role: typeof search.role === "string" ? search.role : undefined,
      inviteStatus,
    };
  },
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

function StatusChip({ status }: { status: "active" | "archived" }) {
  const archived = status === "archived";
  return (
    <span className={`admin-status-chip ${archived ? "is-archived" : "is-active"}`}>
      {archived ? he.adminUserStatusArchived : he.adminUserStatusActive}
    </span>
  );
}

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("he-IL");
}

function AdminUsers() {
  const { api } = useSession();
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [betaStatus, setBetaStatus] = useState<BetaParticipantStatus>("active");
  const [betaWorkspaceId, setBetaWorkspaceId] = useState("");
  const [betaNote, setBetaNote] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<AdminUser | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<AdminUser | null>(null);
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkResult, setBulkResult] = useState<{
    ok: number;
    fail: Array<{ id: string; label: string; error: string }>;
  } | null>(null);

  const tab = search.tab;
  const q = search.q ?? "";
  const workspaceFilter = search.workspace ?? "";
  const roleFilter = search.role ?? "";
  const inviteStatus = search.inviteStatus ?? "all";

  useEffect(() => {
    if (tab !== "active") {
      setSelectedIds([]);
      setBulkArchiveOpen(false);
      setBulkResult(null);
      setBulkProgress(null);
    }
  }, [tab]);

  const setSearch = (patch: Partial<UsersSearch>) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
      }),
      replace: true,
    });
  };

  const activeQuery = useQuery({
    queryKey: ["admin-users", "active", q],
    queryFn: () => api.adminUsers({ q: q.trim() || undefined, status: "active" }),
  });
  const archivedQuery = useQuery({
    queryKey: ["admin-users", "archived", q],
    queryFn: () => api.adminUsers({ q: q.trim() || undefined, status: "archived" }),
  });
  const invitesQuery = useQuery({
    queryKey: ["admin-invitations", "summary"],
    queryFn: () => api.adminInvitations({}),
  });

  const activeUsers = useMemo(() => {
    let rows = activeQuery.data ?? [];
    if (workspaceFilter) {
      rows = rows.filter((r) => r.memberships.some((m) => m.workspace_id === workspaceFilter));
    }
    if (roleFilter) {
      rows = rows.filter((r) => r.memberships.some((m) => m.role_key === roleFilter));
    }
    return rows;
  }, [activeQuery.data, roleFilter, workspaceFilter]);

  const archivedUsers = archivedQuery.data ?? [];
  const pendingInviteCount = useMemo(
    () => (invitesQuery.data ?? []).filter((r) => r.status === "pending").length,
    [invitesQuery.data],
  );

  const workspaceOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of activeQuery.data ?? []) {
      for (const m of u.memberships) {
        if (!map.has(m.workspace_id)) {
          map.set(m.workspace_id, m.workspace_name || m.workspace_id.slice(0, 8));
        }
      }
    }
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [activeQuery.data]);

  const selected = useMemo(() => {
    const pool = [...(activeQuery.data ?? []), ...(archivedQuery.data ?? [])];
    return pool.find((row) => row.id === selectedId) ?? null;
  }, [activeQuery.data, archivedQuery.data, selectedId]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-archive"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
  };

  const patchBadges = useMutation({
    mutationFn: (input: { id: string; recognition_badges: string[] }) =>
      api.adminPatchUserBadges(input.id, {
        recognition_badges: input.recognition_badges,
        reason: "admin_users_ui",
      }),
    onSuccess: () => invalidate(),
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
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["admin-beta-participants"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-audit"] });
    },
  });

  const archiveMut = useMutation({
    mutationFn: () =>
      api.adminArchiveUser(archiveTarget!.id, {
        reason: archiveReason.trim() || null,
      }),
    onSuccess: () => {
      setArchiveTarget(null);
      setArchiveReason("");
      setActionError(null);
      setSelectedIds((ids) => ids.filter((id) => id !== archiveTarget?.id));
      invalidate();
    },
    onError: (err) => {
      setActionError(err instanceof ApiClientError ? err.message : he.adminSaveFailed);
    },
  });

  const bulkArchiveMut = useMutation({
    mutationFn: async () => {
      const targets = activeUsers.filter((u) => selectedIds.includes(u.id));
      const fail: Array<{ id: string; label: string; error: string }> = [];
      let ok = 0;
      setBulkProgress({ done: 0, total: targets.length });
      for (let i = 0; i < targets.length; i += 1) {
        const u = targets[i]!;
        try {
          await api.adminArchiveUser(u.id, { reason: archiveReason.trim() || null });
          ok += 1;
        } catch (err) {
          fail.push({
            id: u.id,
            label: u.full_name || u.email || u.id.slice(0, 8),
            error: err instanceof ApiClientError ? err.message : he.adminSaveFailed,
          });
        }
        setBulkProgress({ done: i + 1, total: targets.length });
      }
      return { ok, fail };
    },
    onSuccess: (result) => {
      setBulkResult(result);
      setSelectedIds((ids) => ids.filter((id) => result.fail.some((f) => f.id === id)));
      setBulkArchiveOpen(false);
      setArchiveReason("");
      setBulkProgress(null);
      invalidate();
    },
    onError: (err) => {
      setActionError(err instanceof ApiClientError ? err.message : he.adminSaveFailed);
      setBulkProgress(null);
    },
  });

  const restoreMut = useMutation({
    mutationFn: () => api.adminRestoreUser(restoreTarget!.id),
    onSuccess: () => {
      setRestoreTarget(null);
      setActionError(null);
      invalidate();
    },
    onError: (err) => {
      setActionError(err instanceof ApiClientError ? err.message : he.adminSaveFailed);
    },
  });

  const openUser = (row: AdminUser) => {
    setSelectedId(row.id);
    setDetailUser(row);
    setBetaWorkspaceId(row.memberships[0]?.workspace_id || "");
    setBetaStatus((row.beta_participations?.[0]?.status as BetaParticipantStatus) || "active");
    setBetaNote(row.beta_participations?.[0]?.internal_note || "");
  };

  const roleSummary = (row: AdminUser) => {
    const roles = [...new Set(row.memberships.map((m) => m.role_key))];
    return roles.join(" · ") || "—";
  };

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected =
    activeUsers.length > 0 && activeUsers.every((u) => selectedSet.has(u.id));
  const someVisibleSelected = activeUsers.some((u) => selectedSet.has(u.id));
  const selectedUsers = useMemo(
    () => activeUsers.filter((u) => selectedSet.has(u.id)),
    [activeUsers, selectedSet],
  );

  const toggleOne = (id: string, on: boolean) => {
    setSelectedIds((prev) => {
      if (on) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const toggleAllVisible = (on: boolean) => {
    if (!on) {
      const visible = new Set(activeUsers.map((u) => u.id));
      setSelectedIds((prev) => prev.filter((id) => !visible.has(id)));
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const u of activeUsers) next.add(u.id);
      return [...next];
    });
  };

  return (
    <div className="admin-users-lifecycle flex flex-col gap-4">
      <PageHeader title={he.adminUsers} description={he.adminUsersLifecycleLead} />

      <AdminSummaryStrip
        items={[
          {
            label: he.adminUserFilterActive,
            value: activeQuery.data?.length ?? "—",
          },
          {
            label: he.adminUserFilterArchived,
            value: archivedQuery.data?.length ?? "—",
          },
          {
            label: he.adminInvitePendingCount,
            value: invitesQuery.isLoading ? "—" : pendingInviteCount,
          },
        ]}
      />

      <AdminTabs
        ariaLabel={he.adminUsersTabs}
        value={tab}
        onChange={(next) => setSearch({ tab: next })}
        tabs={[
          { id: "active", label: he.adminUserFilterActive, count: activeQuery.data?.length },
          { id: "archived", label: he.adminUserFilterArchived, count: archivedQuery.data?.length },
          { id: "invitations", label: he.adminInvitations, count: pendingInviteCount },
        ]}
      />

      <AdminTabPanel tabId="active" active={tab === "active"}>
        <div className="admin-lifecycle-toolbar flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <Input
              id="admin-user-search"
              label={he.adminUserSearch}
              value={q}
              onChange={(ev) => setSearch({ q: ev.target.value || undefined })}
              placeholder={he.adminUserSearchPlaceholder}
            />
          </div>
          <Select
            id="admin-user-workspace"
            label={he.adminFilterWorkspace}
            value={workspaceFilter}
            onChange={(ev) => setSearch({ workspace: ev.target.value || undefined })}
          >
            <option value="">{he.adminFilterAll}</option>
            {workspaceOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <Select
            id="admin-user-role"
            label={he.adminFilterRole}
            value={roleFilter}
            onChange={(ev) => setSearch({ role: ev.target.value || undefined })}
          >
            <option value="">{he.adminFilterAll}</option>
            <option value="owner">owner</option>
            <option value="administrator">administrator</option>
            <option value="manager">manager</option>
            <option value="sales">sales</option>
            <option value="technician">technician</option>
            <option value="viewer">viewer</option>
          </Select>
        </div>

        {selectedIds.length > 0 ? (
          <div className="admin-bulk-bar" role="region" aria-label={he.adminUserBulkArchive}>
            <p className="text-sm text-fg">
              {he.adminUserBulkSelected.replace("{count}", String(selectedIds.length))}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setSelectedIds([])}>
                {he.adminUserBulkClear}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setActionError(null);
                  setBulkResult(null);
                  setArchiveReason("");
                  setBulkArchiveOpen(true);
                }}
              >
                {he.adminUserBulkArchive}
              </Button>
            </div>
          </div>
        ) : null}

        {bulkResult ? (
          <div className="rounded-[var(--radius-panel)] border border-border px-3 py-2 text-sm" role="status">
            <p className="text-fg">
              {he.adminUserBulkArchiveResultOk.replace("{count}", String(bulkResult.ok))}
            </p>
            {bulkResult.fail.length ? (
              <div className="mt-2 text-fg-muted">
                <p>
                  {he.adminUserBulkArchiveResultFail.replace("{count}", String(bulkResult.fail.length))}
                </p>
                <ul className="mt-1 list-inside list-disc">
                  {bulkResult.fail.slice(0, 8).map((f) => (
                    <li key={f.id}>
                      {f.label}: {f.error}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Button variant="ghost" className="mt-2" onClick={() => setBulkResult(null)}>
              {he.cancel}
            </Button>
          </div>
        ) : null}

        {activeQuery.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
        {!activeQuery.isLoading && activeUsers.length === 0 ? (
          <p className="text-sm text-fg-muted">{he.adminUsersEmptyActive}</p>
        ) : null}

        <div className="admin-lifecycle-desktop-table overflow-x-auto">
          <table className="w-full min-w-[48rem] text-start text-sm">
            <thead className="text-xs text-fg-muted">
              <tr>
                <th className="w-10 py-2 font-medium">
                  <input
                    type="checkbox"
                    className="admin-user-check"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                    }}
                    onChange={(ev) => toggleAllVisible(ev.target.checked)}
                    aria-label={he.adminUserBulkSelectAll}
                  />
                </th>
                <th className="py-2 font-medium">{he.adminColUser}</th>
                <th className="py-2 font-medium">{he.adminStatus}</th>
                <th className="py-2 font-medium">{he.adminColWorkspaces}</th>
                <th className="py-2 font-medium">{he.adminColRole}</th>
                <th className="py-2 font-medium">{he.adminColActions}</th>
              </tr>
            </thead>
            <tbody>
              {activeUsers.map((row) => {
                const role = primaryRole(row.memberships);
                const checked = selectedSet.has(row.id);
                return (
                  <tr key={row.id} className={`border-t border-border${checked ? " is-selected" : ""}`}>
                    <td className="py-3">
                      <input
                        type="checkbox"
                        className="admin-user-check"
                        checked={checked}
                        onChange={(ev) => toggleOne(row.id, ev.target.checked)}
                        aria-label={`${he.adminUserSelectRow}: ${row.full_name || row.email || row.id}`}
                      />
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <span className="admin-user-avatar" aria-hidden>
                          {userInitials(row.full_name, row.email)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-fg">{row.full_name || "—"}</p>
                          <p
                            className="ltr-meta max-w-[16rem] truncate text-xs text-fg-muted"
                            title={row.email ?? undefined}
                          >
                            {row.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <StatusChip status="active" />
                    </td>
                    <td className="ltr-meta py-3 text-fg-muted">{row.memberships.length}</td>
                    <td className="py-3 text-fg-muted">{role || "—"}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button variant={selectedId === row.id ? "primary" : "ghost"} onClick={() => openUser(row)}>
                          {he.adminUserOpen}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setActionError(null);
                            setArchiveReason("");
                            setArchiveTarget(row);
                          }}
                        >
                          {he.adminUserArchive}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ul className="admin-lifecycle-mobile-list">
          {activeUsers.map((row) => {
            const role = primaryRole(row.memberships);
            const checked = selectedSet.has(row.id);
            return (
              <li key={row.id} className={`admin-user-card${checked ? " is-selected" : ""}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="admin-user-check mt-1"
                    checked={checked}
                    onChange={(ev) => toggleOne(row.id, ev.target.checked)}
                    aria-label={`${he.adminUserSelectRow}: ${row.full_name || row.email || row.id}`}
                  />
                  <span className="admin-user-avatar" aria-hidden>
                    {userInitials(row.full_name, row.email)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-fg">{row.full_name || "—"}</p>
                    <p className="ltr-meta truncate text-xs text-fg-muted" title={row.email ?? undefined}>
                      {row.email}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusChip status="active" />
                      <span className="text-xs text-fg-muted">
                        {row.memberships.length} · {role || "—"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => openUser(row)}>
                    {he.adminUserOpen}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setActionError(null);
                      setArchiveReason("");
                      setArchiveTarget(row);
                    }}
                  >
                    {he.adminUserArchive}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </AdminTabPanel>

      <AdminTabPanel tabId="archived" active={tab === "archived"}>
        <p className="text-sm text-fg-muted">{he.adminArchiveSoftUsersLead}</p>
        <div className="admin-lifecycle-toolbar">
          <Input
            id="admin-archived-search"
            label={he.adminUserSearch}
            value={q}
            onChange={(ev) => setSearch({ q: ev.target.value || undefined })}
            placeholder={he.adminUserSearchPlaceholder}
          />
        </div>
        {archivedQuery.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
        {!archivedQuery.isLoading && archivedUsers.length === 0 ? (
          <p className="text-sm text-fg-muted">{he.adminUsersEmptyArchived}</p>
        ) : null}

        <div className="admin-lifecycle-desktop-table overflow-x-auto">
          <table className="w-full min-w-[52rem] text-start text-sm">
            <thead className="text-xs text-fg-muted">
              <tr>
                <th className="py-2 font-medium">{he.adminColUser}</th>
                <th className="py-2 font-medium">{he.adminStatus}</th>
                <th className="py-2 font-medium">{he.adminArchiveColWhen}</th>
                <th className="py-2 font-medium">{he.adminArchiveColBy}</th>
                <th className="py-2 font-medium">{he.adminArchiveColReason}</th>
                <th className="py-2 font-medium">{he.adminColWorkspaces}</th>
                <th className="py-2 font-medium">{he.adminColRole}</th>
                <th className="py-2 font-medium">{he.adminColActions}</th>
              </tr>
            </thead>
            <tbody>
              {archivedUsers.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="py-3">
                    <p className="font-medium text-fg">{row.full_name || "—"}</p>
                    <p className="ltr-meta max-w-[14rem] truncate text-xs text-fg-muted" title={row.email ?? undefined}>
                      {row.email}
                    </p>
                  </td>
                  <td className="py-3">
                    <StatusChip status="archived" />
                  </td>
                  <td className="ltr-meta py-3 text-fg-muted">{formatWhen(row.archived_at)}</td>
                  <td className="py-3 text-fg-muted">{row.archived_by_name || "—"}</td>
                  <td className="max-w-[10rem] truncate py-3 text-fg-muted" title={row.archive_reason ?? undefined}>
                    {row.archive_reason || "—"}
                  </td>
                  <td className="ltr-meta py-3 text-fg-muted">{row.memberships.length}</td>
                  <td className="py-3 text-fg-muted">{roleSummary(row)}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        variant="primary"
                        onClick={() => {
                          setActionError(null);
                          setRestoreTarget(row);
                        }}
                      >
                        {he.adminUserRestore}
                      </Button>
                      <Button variant="ghost" onClick={() => openUser(row)}>
                        {he.adminUserOpenDetails}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="admin-lifecycle-mobile-list">
          {archivedUsers.map((row) => (
            <li key={row.id} className="admin-user-card">
              <p className="font-medium text-fg">{row.full_name || "—"}</p>
              <p className="ltr-meta truncate text-xs text-fg-muted" title={row.email ?? undefined}>
                {row.email}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusChip status="archived" />
                <span className="text-xs text-fg-muted">{formatWhen(row.archived_at)}</span>
              </div>
              <p className="mt-2 text-xs text-fg-muted">
                {row.memberships.length} סביבות · {roleSummary(row)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    setActionError(null);
                    setRestoreTarget(row);
                  }}
                >
                  {he.adminUserRestore}
                </Button>
                <Button variant="ghost" onClick={() => openUser(row)}>
                  {he.adminUserOpenDetails}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </AdminTabPanel>

      <AdminTabPanel tabId="invitations" active={tab === "invitations"}>
        <AdminInvitationsPanel
          embedded
          statusFilter={inviteStatus}
          onStatusFilterChange={(next) => setSearch({ inviteStatus: next })}
        />
      </AdminTabPanel>

      {selected && detailUser ? (
        <section className="ops-card flex flex-col gap-3 p-4" aria-label={he.adminManageUser}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-fg">
              {selected.full_name || selected.email} · {he.adminManageUser}
            </h3>
            <StatusChip status={selected.lifecycle_status === "archived" ? "archived" : "active"} />
            <Button variant="ghost" onClick={() => { setSelectedId(null); setDetailUser(null); }}>
              {he.cancel}
            </Button>
          </div>
          <p className="text-sm text-fg-muted">{he.adminManageUserHint}</p>
          <div className="flex flex-wrap gap-2">
            {BADGE_OPTIONS.map((opt) => {
              const badges = selected.recognition_badges ?? [];
              const on = badges.includes(opt.value);
              return (
                <Button
                  key={opt.value}
                  variant={on ? "secondary" : "ghost"}
                  disabled={patchBadges.isPending || selected.lifecycle_status === "archived"}
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
            disabled={!betaWorkspaceId || patchBeta.isPending || selected.lifecycle_status === "archived"}
            onClick={() => patchBeta.mutate()}
          >
            {he.adminSaveBeta}
          </Button>
          {patchBeta.isError ? <p className="text-sm text-danger">{he.adminSaveFailed}</p> : null}
        </section>
      ) : null}

      <Modal
        open={Boolean(archiveTarget)}
        onClose={() => {
          if (!archiveMut.isPending) setArchiveTarget(null);
        }}
        title={he.adminUserArchiveTitle}
      >
        {archiveTarget ? (
          <div className="flex flex-col gap-3 text-sm">
            <p className="font-medium text-fg">{archiveTarget.full_name || "—"}</p>
            <p className="ltr-meta break-all text-fg-muted">{archiveTarget.email}</p>
            <ul className="list-inside list-disc text-fg-muted">
              {archiveTarget.memberships.length === 0 ? <li>—</li> : null}
              {archiveTarget.memberships.map((m) => (
                <li key={`${m.workspace_id}-${m.role_key}`}>
                  {m.workspace_name || m.workspace_id.slice(0, 8)} · {m.role_key}
                </li>
              ))}
            </ul>
            <p className="rounded-[var(--radius-control)] border border-warning/40 bg-warning/10 px-3 py-2 text-fg">
              {he.adminUserArchiveConfirm}
            </p>
            <Input
              id="admin-archive-reason"
              label={he.adminUserArchiveReason}
              value={archiveReason}
              onChange={(ev) => setArchiveReason(ev.target.value)}
            />
            {actionError ? (
              <p className="text-danger" role="alert">
                {actionError}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" disabled={archiveMut.isPending} onClick={() => setArchiveTarget(null)}>
                {he.cancel}
              </Button>
              <Button
                variant="primary"
                loading={archiveMut.isPending}
                disabled={archiveMut.isPending}
                onClick={() => archiveMut.mutate()}
              >
                {he.adminUserArchiveConfirmCta}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={bulkArchiveOpen}
        onClose={() => {
          if (!bulkArchiveMut.isPending) setBulkArchiveOpen(false);
        }}
        title={he.adminUserBulkArchiveTitle}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-fg">
            {he.adminUserBulkSelected.replace("{count}", String(selectedUsers.length))}
          </p>
          <ul className="max-h-40 list-inside list-disc overflow-y-auto text-fg-muted">
            {selectedUsers.slice(0, 40).map((u) => (
              <li key={u.id}>
                {u.full_name || "—"}
                {u.email ? (
                  <span className="ltr-meta text-fg-muted"> · {u.email}</span>
                ) : null}
              </li>
            ))}
            {selectedUsers.length > 40 ? <li>… +{selectedUsers.length - 40}</li> : null}
          </ul>
          <p className="rounded-[var(--radius-control)] border border-warning/40 bg-warning/10 px-3 py-2 text-fg">
            {he.adminUserBulkArchiveConfirm}
          </p>
          <Input
            id="admin-bulk-archive-reason"
            label={he.adminUserArchiveReason}
            value={archiveReason}
            onChange={(ev) => setArchiveReason(ev.target.value)}
          />
          {bulkProgress ? (
            <p className="ltr-meta text-fg-muted">
              {he.adminUserBulkArchiveProgress
                .replace("{done}", String(bulkProgress.done))
                .replace("{total}", String(bulkProgress.total))}
            </p>
          ) : null}
          {actionError ? (
            <p className="text-danger" role="alert">
              {actionError}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              disabled={bulkArchiveMut.isPending}
              onClick={() => setBulkArchiveOpen(false)}
            >
              {he.cancel}
            </Button>
            <Button
              variant="primary"
              loading={bulkArchiveMut.isPending}
              disabled={bulkArchiveMut.isPending || selectedUsers.length === 0}
              onClick={() => {
                setActionError(null);
                bulkArchiveMut.mutate();
              }}
            >
              {he.adminUserBulkArchiveCta.replace("{count}", String(selectedUsers.length))}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(restoreTarget)}
        onClose={() => {
          if (!restoreMut.isPending) setRestoreTarget(null);
        }}
        title={he.adminUserRestoreConfirmTitle}
      >
        {restoreTarget ? (
          <div className="flex flex-col gap-3 text-sm">
            <p className="font-medium text-fg">{restoreTarget.full_name || "—"}</p>
            <p className="ltr-meta break-all text-fg-muted">{restoreTarget.email}</p>
            <p className="text-fg-muted">
              {restoreTarget.memberships.length} סביבות · {roleSummary(restoreTarget)}
            </p>
            <p className="text-fg-muted">{he.adminUserRestoreConfirm}</p>
            {actionError ? (
              <p className="text-danger" role="alert">
                {actionError}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" disabled={restoreMut.isPending} onClick={() => setRestoreTarget(null)}>
                {he.cancel}
              </Button>
              <Button
                variant="primary"
                loading={restoreMut.isPending}
                disabled={restoreMut.isPending}
                onClick={() => restoreMut.mutate()}
              >
                {he.adminUserRestore}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
