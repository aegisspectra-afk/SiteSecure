import { Button, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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

function AdminUsers() {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-users"], queryFn: () => api.adminUsers() });
  const patch = useMutation({
    mutationFn: (input: { id: string; recognition_badges: string[] }) =>
      api.adminPatchUserBadges(input.id, { recognition_badges: input.recognition_badges }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={he.adminUsers} description={he.foundingTechnicianBadge} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-start text-sm">
          <thead className="text-xs text-fg-muted">
            <tr>
              <th className="py-2 font-medium">שם</th>
              <th className="py-2 font-medium">דוא״ל</th>
              <th className="py-2 font-medium">סביבות</th>
              <th className="py-2 font-medium">Badge</th>
              <th className="py-2 font-medium">פלטפורמה</th>
              <th className="py-2 font-medium">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map((row) => {
              const badges = row.recognition_badges ?? [];
              return (
                <tr key={row.id} className="border-t border-border">
                  <td className="py-3 text-fg">{row.full_name || "—"}</td>
                  <td className="ltr-meta py-3 text-fg-muted">{row.email}</td>
                  <td className="py-3 text-fg-muted">
                    {row.memberships.map((m) => m.workspace_name || m.workspace_id).join(" · ") || "—"}
                  </td>
                  <td className="py-3 text-fg-muted">
                    {badges.length
                      ? badges
                          .map((b) => BADGE_OPTIONS.find((o) => o.value === b)?.label ?? b)
                          .join(" · ")
                      : "—"}
                  </td>
                  <td className="py-3 text-fg-muted">{row.is_platform_admin ? he.adminNav : "—"}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {BADGE_OPTIONS.map((opt) => (
                        <Button
                          key={opt.value}
                          variant="ghost"
                          disabled={patch.isPending}
                          onClick={() =>
                            patch.mutate({
                              id: row.id,
                              recognition_badges: badges.includes(opt.value)
                                ? badges.filter((b) => b !== opt.value)
                                : [...badges, opt.value],
                            })
                          }
                        >
                          {badges.includes(opt.value) ? `− ${opt.label}` : `+ ${opt.label}`}
                        </Button>
                      ))}
                      {badges.length ? (
                        <Button
                          variant="ghost"
                          disabled={patch.isPending}
                          onClick={() => patch.mutate({ id: row.id, recognition_badges: [] })}
                        >
                          {he.adminBadgeClear}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
