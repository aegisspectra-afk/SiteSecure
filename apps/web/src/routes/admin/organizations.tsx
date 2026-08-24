import { Button, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/admin/organizations")({
  component: AdminOrganizations,
});

function AdminOrganizations() {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-orgs"], queryFn: () => api.adminOrganizations() });
  const patch = useMutation({
    mutationFn: (input: { id: string; is_beta: boolean }) =>
      api.adminPatchOrganization(input.id, { is_beta: input.is_beta }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-orgs"] }),
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={he.adminOrgs} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-start text-sm">
          <thead className="text-xs text-fg-muted">
            <tr>
              <th className="py-2 font-medium">שם</th>
              <th className="py-2 font-medium">תוכנית</th>
              <th className="py-2 font-medium">{he.adminBeta}</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map((org) => (
              <tr key={org.id} className="border-t border-border">
                <td className="py-3 font-medium text-fg">{org.name}</td>
                <td className="ltr-meta py-3 text-fg-muted">{org.plan_key ?? "—"}</td>
                <td className="py-3 text-fg-muted">{org.is_beta ? he.adminBetaOn : he.adminBetaOff}</td>
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
