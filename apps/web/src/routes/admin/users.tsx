import { PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const { api } = useSession();
  const query = useQuery({ queryKey: ["admin-users"], queryFn: () => api.adminUsers() });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={he.adminUsers} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-start text-sm">
          <thead className="text-xs text-fg-muted">
            <tr>
              <th className="py-2 font-medium">שם</th>
              <th className="py-2 font-medium">דוא״ל</th>
              <th className="py-2 font-medium">סביבות</th>
              <th className="py-2 font-medium">פלטפורמה</th>
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="py-3 text-fg">{row.full_name || "—"}</td>
                <td className="ltr-meta py-3 text-fg-muted">{row.email}</td>
                <td className="py-3 text-fg-muted">
                  {row.memberships.map((m) => m.workspace_name || m.workspace_id).join(" · ") || "—"}
                </td>
                <td className="py-3 text-fg-muted">{row.is_platform_admin ? he.adminNav : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
