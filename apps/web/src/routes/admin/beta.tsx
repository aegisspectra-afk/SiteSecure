import { Button, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/admin/beta")({
  component: AdminBeta,
});

function AdminBeta() {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin-orgs"], queryFn: () => api.adminOrganizations() });
  const patch = useMutation({
    mutationFn: (input: { id: string; is_beta: boolean }) =>
      api.adminPatchOrganization(input.id, { is_beta: input.is_beta, beta_program: input.is_beta ? "early" : undefined }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-summary"] });
    },
  });
  const enrolled = (query.data ?? []).filter((org) => org.is_beta);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={he.adminBeta} description={he.betaBadgeHint} />
      {enrolled.length === 0 ? <p className="text-sm text-fg-muted">{he.adminBetaOff}</p> : null}
      <ul className="flex flex-col gap-3">
        {enrolled.map((org) => (
          <li key={org.id} className="ops-card flex items-center justify-between gap-3 px-4 py-4">
            <div>
              <p className="font-medium text-fg">{org.name}</p>
              <p className="ltr-meta mt-1 text-xs text-fg-muted">{org.beta_program ?? "early"}</p>
            </div>
            <Button variant="secondary" onClick={() => patch.mutate({ id: org.id, is_beta: false })}>
              {he.adminLeaveBeta}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
