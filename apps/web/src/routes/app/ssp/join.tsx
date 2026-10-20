import { Button, Card, Input } from "@site-secure/ui";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ErrorState, ModuleScaffold } from "../../../components/modules/ModuleKit";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/ssp/join")({
  validateSearch: (search: Record<string, unknown>): { code?: string } => {
    const code = typeof search.code === "string" ? search.code : undefined;
    return code ? { code } : {};
  },
  component: SspJoinPage,
});

function SspJoinPage() {
  const { api, workspaceId } = useSspWorkspace();
  const search = Route.useSearch();
  const [code, setCode] = useState(search.code ?? "");
  const [done, setDone] = useState<string | null>(null);

  const join = useMutation({
    mutationFn: () => api.requestSspSiteJoin(workspaceId!, { code: code.trim() }),
    onSuccess: (row) => setDone(row.message || he.sspJoinPending),
    onError: (e: unknown) => setDone(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div data-testid="ssp-join">
      <ModuleScaffold title={he.sspJoinTitle} lead={he.sspJoinLead}>
        <Card className="flex max-w-lg flex-col gap-3">
          <Input
            id="ssp-join-code"
            label={he.sspJoinCode}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
          />
          <Button
            type="button"
            onClick={() => join.mutate()}
            disabled={join.isPending || !code.trim()}
          >
            {he.sspJoinSubmit}
          </Button>
          {done ? <p className="text-sm text-fg-muted">{done}</p> : null}
        </Card>
      </ModuleScaffold>
    </div>
  );
}
