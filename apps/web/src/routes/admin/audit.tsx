import { PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/admin/audit")({
  component: AdminAudit,
});

function AdminAudit() {
  const { api } = useSession();
  const query = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => api.adminAuditLogs({ limit: 100 }),
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={he.adminAudit} description={he.adminAuditLead} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-start text-sm">
          <thead className="text-xs text-fg-muted">
            <tr>
              <th className="py-2 font-medium">זמן</th>
              <th className="py-2 font-medium">Workspace</th>
              <th className="py-2 font-medium">פעולה</th>
              <th className="py-2 font-medium">ישות</th>
              <th className="py-2 font-medium">שחקן</th>
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="ltr-meta py-3 text-fg-muted">{row.created_at}</td>
                <td className="py-3 text-fg-muted">{row.workspace_name || row.workspace_id}</td>
                <td className="py-3 text-fg">{row.action}</td>
                <td className="py-3 text-fg-muted">
                  {row.entity_type}
                  {row.entity_id ? ` · ${row.entity_id.slice(0, 8)}` : ""}
                </td>
                <td className="py-3 text-fg-muted">{row.actor_email || row.actor_user_id || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!query.isLoading && !(query.data ?? []).length ? (
          <p className="py-6 text-sm text-fg-muted">{he.adminAuditEmpty}</p>
        ) : null}
      </div>
    </div>
  );
}
