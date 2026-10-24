import { Button, Card, Select } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorState, ModuleScaffold } from "../../../components/modules/ModuleKit";
import { SspHubLinks } from "../../../components/ssp/SspHubLinks";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/ssp/unit-codes")({
  component: SspUnitCodesPage,
});

function SspUnitCodesPage() {
  const { api, workspaceId, isOfficer, sspCan } = useSspWorkspace();
  const qc = useQueryClient();
  const [siteId, setSiteId] = useState("");
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const canManage = sspCan("ssp.sites.edit") || sspCan("ssp.forms.edit");

  const offices = useQuery({
    queryKey: ["ssp-sites", workspaceId, "actors-unit"],
    enabled: Boolean(workspaceId) && canManage,
    queryFn: () => api.listSspSites(workspaceId!, { kind: "office,ops_center", is_active: true }),
    retry: false,
  });

  const items = offices.data?.items ?? [];
  const selected = useMemo(() => siteId || items[0]?.id || "", [siteId, items]);

  const current = useQuery({
    queryKey: ["ssp-unit-code", workspaceId, selected],
    enabled: Boolean(workspaceId && selected && canManage),
    queryFn: () => api.getSspUnitLoginCode(workspaceId!, selected),
    retry: false,
    refetchInterval: 15_000,
  });

  const issue = useMutation({
    mutationFn: () => api.issueSspUnitLoginCode(workspaceId!, selected),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["ssp-unit-code", workspaceId, selected] });
    },
  });
  const revoke = useMutation({
    mutationFn: () => api.revokeSspUnitLoginCode(workspaceId!, current.data?.id || ""),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["ssp-unit-code", workspaceId, selected] });
    },
  });
  const disconnect = useMutation({
    mutationFn: () => api.revokeSspUnitSessions(workspaceId!, selected),
  });

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const remaining = current.data?.remaining_seconds ?? 0;
  const updatedAt = current.dataUpdatedAt || now;
  const left = Math.max(0, remaining - Math.max(0, Math.floor((now - updatedAt) / 1000)));
  const autoKey = `${selected}:${current.data?.id || "none"}:${current.data?.code && left > 0 ? "live" : "need"}`;
  const lastAuto = useRef("");

  useEffect(() => {
    if (!canManage || !selected || !current.isSuccess || issue.isPending || issue.isError) return;
    if (current.data?.code && left > 0) {
      lastAuto.current = "";
      return;
    }
    if (lastAuto.current === autoKey) return;
    lastAuto.current = autoKey;
    issue.mutate();
  }, [autoKey, canManage, current.data?.code, current.isSuccess, issue.isError, issue.isPending, left, selected]);

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (isOfficer || !canManage) {
    return (
      <ModuleScaffold title={he.sspUnitCodesTitle} lead={he.sspUnitCodesLead}>
        <ErrorState title={he.forbiddenTitle} description={he.forbiddenBody} />
      </ModuleScaffold>
    );
  }

  const minutes = Math.floor(left / 60);
  const seconds = left % 60;
  const code = current.data?.code;

  return (
    <div data-testid="ssp-unit-codes">
      <ModuleScaffold title={he.sspUnitCodesTitle} lead={he.sspUnitCodesLead}>
        <SspHubLinks
          items={[
            { to: "/app/ssp/offices", label: he.sspNavOffices },
            { to: "/app/ssp/users", label: he.sspNavPeople },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            id="unit-code-site"
            label={he.sspUnitSelect}
            value={selected}
            onChange={(e) => setSiteId(e.target.value)}
          >
            {items.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </Select>
        </div>
        <Card className="flex flex-col items-start gap-4 p-6" data-testid="ssp-unit-code-card">
          <p className="text-sm text-fg-muted">{current.data?.site?.name}</p>
          <p className="font-mono text-4xl tracking-[0.3em]" data-testid="ssp-unit-code-value">
            {code || "————"}
          </p>
          <p className="text-sm text-fg-muted">
            {he.sspUnitExpiresIn}: {minutes}:{String(seconds).padStart(2, "0")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!code}
              onClick={async () => {
                if (!code) return;
                await navigator.clipboard.writeText(code.replace("-", ""));
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? he.sspUnitCopied : he.sspUnitCopy}
            </Button>
            <Button type="button" variant="secondary" disabled={issue.isPending} onClick={() => issue.mutate()}>
              {he.sspUnitRotate}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!current.data?.id || current.data.status !== "active" || revoke.isPending}
              onClick={() => revoke.mutate()}
            >
              {he.sspUnitRevoke}
            </Button>
            <Button type="button" variant="secondary" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>
              {he.sspUnitDisconnect}
            </Button>
          </div>
          {issue.error ? <p className="text-sm text-danger">{issue.error.message}</p> : null}
        </Card>
      </ModuleScaffold>
    </div>
  );
}
