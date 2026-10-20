import { Button, ErrorState, PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { CheckpointPrintCard } from "../components/CheckpointPrintCard";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { printableCheckpoints } from "../lib/printCheckpoints";
import { useSession } from "../lib/session";

export function CheckpointPrintPage() {
  return (
    <RequireSspAccess permission="ssp.checkpoints.view">
      <Body />
    </RequireSspAccess>
  );
}

function Body() {
  const { checkpointId } = useParams({ from: "/authenticated/checkpoints/$checkpointId/print" });
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

  const printable = printableCheckpoints(list.data?.items ?? []);
  const cp = printable.find((c) => c.id === checkpointId);
  if (!cp) return <ErrorState title={he.printMissingCode} />;

  return (
    <div className="flex flex-col gap-4" data-testid="ssp-checkpoint-print" dir="rtl">
      <div className="ssp-print-hide">
        <PageHeader
          title={he.printTitle}
          description={he.printLead}
          action={
            <Button type="button" onClick={() => window.print()}>
              {he.printAction}
            </Button>
          }
        />
      </div>
      <div className="ssp-print-sheet ssp-print-sheet--single mx-auto w-full max-w-sm">
        <CheckpointPrintCard checkpoint={cp} />
      </div>
    </div>
  );
}
