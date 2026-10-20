import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useMutation } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { QrScanner } from "../components/QrScanner";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { canSubmitScan, normalizeScanCode, scanResultTone } from "../lib/scanGate";
import { useSession } from "../lib/session";

const scanRouteApi = getRouteApi("/authenticated/scan");

export function ScanPage() {
  return (
    <RequireSspAccess permission="ssp.scans.create">
      <Body />
    </RequireSspAccess>
  );
}

function Body() {
  const { api, workspaceId } = useSession();
  const search = scanRouteApi.useSearch();
  const [code, setCode] = useState(search.code ?? "");
  const [runId, setRunId] = useState(search.runId ?? "");
  const [last, setLast] = useState<{ result: string; message: string } | null>(null);
  const [manualOpen, setManualOpen] = useState(Boolean(search.code));
  const pendingRef = useRef(false);

  const scan = useMutation({
    mutationFn: (payload: { code: string; run_id?: string }) => api.createSspScan(workspaceId!, payload),
    onSuccess: (res) => {
      const labels: Record<string, string> = {
        ok: he.scanOk,
        duplicate: he.scanDuplicate,
        out_of_route: he.scanOutOfRoute,
        unauthorized: he.scanUnauthorized,
        error: he.scanError,
      };
      setLast({
        result: res.result,
        message: `${labels[res.result] ?? res.result} · ${res.checkpoint.name ?? res.checkpoint.code}`,
      });
    },
    onError: (e: unknown) => {
      setLast({
        result: "error",
        message: e instanceof Error ? e.message : he.apiUnavailable,
      });
    },
    onSettled: () => {
      pendingRef.current = false;
    },
  });

  const submit = useCallback(
    (raw: string) => {
      const next = normalizeScanCode(raw);
      if (!canSubmitScan({ code: next, pending: pendingRef.current || scan.isPending })) return;
      pendingRef.current = true;
      setCode(next);
      scan.mutate({ code: next, run_id: runId.trim() || undefined });
    },
    [runId, scan],
  );

  const onCameraCode = useCallback(
    (value: string) => {
      submit(value);
    },
    [submit],
  );

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  const tone = last ? scanResultTone(last.result) : null;
  const paused = pendingRef.current || scan.isPending;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4" data-testid="ssp-scan-mobile" dir="rtl">
      <PageHeader title={he.scanTitle} description={he.scanLead} />
      <p className="text-xs text-fg-muted">{he.scanAuthNote}</p>
      <QrScanner paused={paused} onCode={onCameraCode} />
      <Input
        id="scan-run"
        label={he.scanRunId}
        value={runId}
        onChange={(e) => setRunId(e.target.value)}
        hint={he.scanRunHint}
      />
      <button
        type="button"
        className="text-start text-sm text-fg-muted underline"
        onClick={() => setManualOpen((v) => !v)}
      >
        {he.scanManualFallback}
      </button>
      {manualOpen ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <Input
            id="scan-code"
            label={he.scanCode}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            inputMode="text"
          />
          <Button
            type="button"
            className="min-h-12 w-full text-base"
            onClick={() => submit(code)}
            disabled={!canSubmitScan({ code, pending: scan.isPending })}
          >
            {scan.isPending ? he.loading : he.scanAction}
          </Button>
        </div>
      ) : null}
      {scan.isPending ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      {last ? (
        <p
          className={
            tone === "ok"
              ? "rounded-md border border-border bg-bg-subtle px-3 py-3 text-sm text-fg"
              : tone === "warn"
                ? "rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-fg"
                : "rounded-md border border-border px-3 py-3 text-sm text-danger"
          }
          data-testid="ssp-scan-result"
          data-result={last.result}
        >
          {last.message}
        </p>
      ) : null}
    </div>
  );
}
