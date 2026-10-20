import { Button, ErrorState, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { DataModeNote } from "../components/DataModeNote";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useSession } from "../lib/session";

const STATUS_HE: Record<string, string> = {
  planned: he.runStatusPlanned,
  active: he.runStatusActive,
  late: he.runStatusLate,
  completed: he.runStatusCompleted,
  cancelled: he.runStatusCancelled,
};

function formatTs(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

export function PatrolRunDetailPage() {
  return (
    <RequireSspAccess permission="ssp.patrols.view">
      <Body />
    </RequireSspAccess>
  );
}

function Body() {
  const { runId } = useParams({ from: "/authenticated/patrols/runs/$runId" });
  const { api, workspaceId } = useSession();
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["ssp-run", workspaceId, runId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getSspPatrolRun(workspaceId!, runId),
    retry: false,
  });
  const checkpoints = useQuery({
    queryKey: ["ssp-checkpoints", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspCheckpoints(workspaceId!),
    retry: false,
  });
  const patrols = useQuery({
    queryKey: ["ssp-patrols", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspPatrols(workspaceId!),
    retry: false,
  });

  const start = useMutation({
    mutationFn: () => api.startSspPatrolRun(workspaceId!, runId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ssp-run", workspaceId, runId] }),
  });
  const complete = useMutation({
    mutationFn: () => api.completeSspPatrolRun(workspaceId!, runId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["ssp-run", workspaceId, runId] }),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (detail.isLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
  if (detail.isError || !detail.data) {
    return (
      <ErrorState
        title={he.apiUnavailable}
        action={
          <Button type="button" variant="secondary" onClick={() => void detail.refetch()}>
            {he.retry}
          </Button>
        }
      />
    );
  }

  const { run, progress, scans, stops, assignees } = detail.data;
  const canStart = run.status === "planned";
  const canComplete = run.status === "active" || run.status === "late";
  const byId = new Map((checkpoints.data?.items ?? []).map((c) => [c.id, c]));
  const patrolName = (patrols.data?.items ?? []).find((p) => p.id === run.patrol_id)?.name;
  const missing = new Set(progress.missing_checkpoint_ids);
  const statusLabel = STATUS_HE[run.status] ?? run.status;
  const nextStop = stops.find((s) => missing.has(s.checkpoint_id));
  const nextCp = nextStop ? byId.get(nextStop.checkpoint_id) : undefined;

  return (
    <div className="flex flex-col gap-4" data-testid="ssp-run-detail" dir="rtl">
      <PageHeader
        title={patrolName || he.runDetailTitle}
        description={`${statusLabel} · ${progress.percent}%`}
        action={
          <div className="flex flex-wrap gap-2">
            {canStart ? (
              <Button type="button" onClick={() => start.mutate()} disabled={start.isPending}>
                {start.isPending ? he.loading : he.runStart}
              </Button>
            ) : null}
            {canComplete ? (
              <Button type="button" onClick={() => complete.mutate()} disabled={complete.isPending}>
                {complete.isPending ? he.loading : he.runComplete}
              </Button>
            ) : null}
            <Link
              to="/scan"
              search={{ runId, code: nextCp?.code }}
              className="rounded-md bg-bg-subtle px-3 py-2 text-sm font-medium text-fg"
            >
              {he.navScan}
            </Link>
          </div>
        }
      />
      <DataModeNote mode={detail.data.data_mode} />
      {(start.error || complete.error) && (
        <p className="text-sm text-danger" role="alert">
          {(start.error || complete.error) instanceof Error
            ? ((start.error || complete.error) as Error).message
            : he.apiUnavailable}
        </p>
      )}
      {detail.isFetching && !detail.isLoading ? (
        <p className="text-xs text-fg-muted">{he.loading}</p>
      ) : null}

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <div className="text-xs text-fg-muted">{he.runProgress}</div>
          <div className="mt-1 text-lg font-semibold">
            {progress.completed_stops}/{progress.total_stops}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg-subtle" aria-hidden>
            <div
              className="h-full bg-[var(--color-action,#0b6bcb)]"
              style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
            />
          </div>
          {progress.missing_checkpoint_ids.length ? (
            <p className="mt-2 text-xs text-fg-muted">
              {he.runMissing}: {progress.missing_checkpoint_ids.length}
            </p>
          ) : (
            <p className="mt-2 text-xs text-fg-muted">{he.runAllDone}</p>
          )}
        </div>
        <div className="rounded-lg border border-border p-3 text-sm">
          <div>
            <span className="text-xs text-fg-muted">{he.runOfficer}: </span>
            {assignees.length ? assignees.map((id) => id.slice(0, 8)).join(" · ") : "—"}
          </div>
          <div className="mt-1">
            <span className="text-xs text-fg-muted">{he.runStartedAt}: </span>
            {formatTs(run.started_at)}
          </div>
          <div>
            <span className="text-xs text-fg-muted">{he.runCompletedAt}: </span>
            {formatTs(run.completed_at)}
          </div>
          {run.planned_start_at ? (
            <div>
              <span className="text-xs text-fg-muted">{he.runPlanned}: </span>
              {formatTs(run.planned_start_at)}
              {run.planned_end_at ? ` – ${formatTs(run.planned_end_at)}` : ""}
            </div>
          ) : null}
        </div>
      </div>

      {nextCp && canComplete ? (
        <p className="rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm">
          {he.runNextStop}: <span className="font-medium">{nextCp.name}</span>
        </p>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold">{he.runStops}</h2>
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {stops.map((s) => {
            const done = scans.some((sc) => sc.checkpoint_id === s.checkpoint_id && sc.result === "ok");
            const cp = byId.get(s.checkpoint_id);
            return (
              <li key={s.checkpoint_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium text-fg">{cp?.name || s.checkpoint_id.slice(0, 8)}</div>
                  {cp?.location_label ? <div className="text-xs text-fg-muted">{cp.location_label}</div> : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className={done ? "text-xs text-fg" : "text-xs text-fg-muted"}>
                    {done ? he.runStopDone : he.runStopPending}
                  </span>
                  {!done && cp?.code ? (
                    <Link
                      to="/scan"
                      search={{ runId, code: cp.code }}
                      className="text-xs font-medium text-fg underline"
                    >
                      {he.runScanThis}
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {!stops.length ? <p className="mt-2 text-sm text-fg-muted">{he.noItems}</p> : null}
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold">{he.runScans}</h2>
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {scans.map((sc) => {
            const cp = byId.get(sc.checkpoint_id);
            return (
              <li key={sc.id} className="flex justify-between gap-2 px-3 py-2">
                <span>
                  {cp?.name || sc.checkpoint_id.slice(0, 8)} · {sc.result}
                </span>
                <span className="text-xs text-fg-muted">{formatTs(sc.scanned_at)}</span>
              </li>
            );
          })}
        </ul>
        {!scans.length ? <p className="text-sm text-fg-muted">{he.noItems}</p> : null}
      </section>
    </div>
  );
}
