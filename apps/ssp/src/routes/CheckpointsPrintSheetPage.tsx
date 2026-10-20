import { Button, ErrorState, PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { CheckpointPrintCard } from "../components/CheckpointPrintCard";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { printableCheckpoints } from "../lib/printCheckpoints";
import { useSession } from "../lib/session";

export function CheckpointsPrintSheetPage() {
  return (
    <RequireSspAccess permission="ssp.checkpoints.view">
      <Body />
    </RequireSspAccess>
  );
}

function Body() {
  const { api, workspaceId } = useSession();
  const list = useQuery({
    queryKey: ["ssp-checkpoints", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspCheckpoints(workspaceId!),
    retry: false,
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (list.isLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
  if (list.isError) {
    return (
      <ErrorState
        title={he.apiUnavailable}
        action={
          <Button type="button" variant="secondary" onClick={() => void list.refetch()}>
            {he.retry}
          </Button>
        }
      />
    );
  }

  const cards = printableCheckpoints((list.data?.items ?? []).filter((c) => c.is_active));

  return (
    <div className="flex flex-col gap-4" data-testid="ssp-checkpoint-print-sheet" dir="rtl">
      <div className="ssp-print-hide">
        <PageHeader
          title={he.printSheetTitle}
          description={he.printSheetLead}
          action={
            <Button type="button" onClick={() => window.print()} disabled={!cards.length}>
              {he.printAction}
            </Button>
          }
        />
      </div>
      {!cards.length ? <p className="text-sm text-fg-muted">{he.noItems}</p> : null}
      <div className="ssp-print-sheet grid gap-4 sm:grid-cols-2">
        {cards.map((cp) => (
          <CheckpointPrintCard key={cp.id} checkpoint={cp} />
        ))}
      </div>
    </div>
  );
}
