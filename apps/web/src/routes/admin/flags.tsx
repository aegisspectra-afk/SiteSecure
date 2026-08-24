import { Checkbox, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/admin/flags")({
  component: AdminFlags,
});

function AdminFlags() {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-flags"], queryFn: () => api.adminFeatureFlags() });
  const patch = useMutation({
    mutationFn: (input: { id: string; enabled_for_beta?: boolean; enabled_for_production?: boolean }) =>
      api.adminPatchFeatureFlag(input.id, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-flags"] }),
  });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={he.adminFlags} />
      <ul className="flex flex-col gap-3">
        {(query.data ?? []).map((flag) => (
          <li key={flag.id} className="ops-card flex flex-col gap-3 px-4 py-4">
            <div>
              <p className="ltr-meta font-medium text-fg">{flag.name}</p>
              {flag.description ? <p className="mt-1 text-sm text-fg-muted">{flag.description}</p> : null}
            </div>
            <div className="flex flex-wrap gap-4">
              <Checkbox
                label={he.adminFlagBeta}
                checked={flag.enabled_for_beta}
                onChange={(ev) => patch.mutate({ id: flag.id, enabled_for_beta: ev.target.checked })}
              />
              <Checkbox
                label={he.adminFlagProd}
                checked={flag.enabled_for_production}
                onChange={(ev) => patch.mutate({ id: flag.id, enabled_for_production: ev.target.checked })}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
