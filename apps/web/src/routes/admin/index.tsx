import { ApiClientError } from "@site-secure/api-client";
import { Button, Input } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OpsCommandCenter } from "../../components/admin/OpsCommandCenter";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function FoundingTechnicianOnboard({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { api } = useSession();
  const [workspaceName, setWorkspaceName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceLabel, setWorkspaceLabel] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [phaseError, setPhaseError] = useState<string | null>(null);

  const createWorkspace = useMutation({
    mutationFn: () =>
      api.adminCreateOrganization({
        name: workspaceName.trim(),
        plan_key: "business",
        is_beta: true,
        beta_program: "early",
        internal_note: "Founding Technician — ops center",
      }),
    onSuccess: (org) => {
      setWorkspaceId(org.id);
      setWorkspaceLabel(org.name);
      setPhaseError(null);
    },
    onError: (err) => {
      setPhaseError(err instanceof ApiClientError ? err.message : he.adminOrgCreateError);
    },
  });

  const createInvite = useMutation({
    mutationFn: (wsId: string) =>
      api.adminCreateInvitation({
        workspace_id: wsId,
        email: ownerEmail.trim(),
        role_key: "owner",
      }),
    onSuccess: (row) => {
      if (row.token) {
        const link = `${window.location.origin}/invite/${row.token}`;
        setInviteLink(link);
        void navigator.clipboard.writeText(link).then(() => setCopied(true));
      }
      setPhaseError(null);
      onDone();
    },
    onError: (err) => {
      setPhaseError(
        err instanceof ApiClientError
          ? `${he.adminFtInviteFailed} (${err.message})`
          : he.adminFtInviteFailed,
      );
    },
  });

  const reset = () => {
    setWorkspaceName("");
    setOwnerEmail("");
    setWorkspaceId(null);
    setWorkspaceLabel(null);
    setInviteLink(null);
    setCopied(false);
    setPhaseError(null);
    createWorkspace.reset();
    createInvite.reset();
  };

  if (!open) return null;

  const step =
    inviteLink && workspaceId
      ? 5
      : workspaceId
        ? 4
        : workspaceName.trim().length >= 2 && ownerEmail.includes("@")
          ? 3
          : ownerEmail
            ? 2
            : 1;

  return (
    <section className="admin-ft-panel" aria-labelledby="admin-ft-panel-title">
      <div className="admin-ft-panel-head">
        <h2 id="admin-ft-panel-title" className="admin-ft-panel-title">
          {he.adminFtCta}
        </h2>
        <Button
          variant="ghost"
          onClick={() => {
            onOpenChange(false);
            if (inviteLink) reset();
          }}
        >
          {he.feedbackClose}
        </Button>
      </div>

      <ol className="admin-ft-steps" aria-label={he.adminFtCta}>
        <li className={step >= 1 ? "is-done" : ""}>{he.adminFtStepWorkspace}</li>
        <li className={step >= 2 ? "is-done" : ""}>{he.adminFtStepEmail}</li>
        <li className={step >= 3 ? "is-done" : ""}>{he.adminFtStepCreate}</li>
        <li className={step >= 4 ? "is-done" : ""}>{he.adminFtStepInvite}</li>
        <li className={step >= 5 ? "is-done" : ""}>{he.adminFtStepLink}</li>
      </ol>

      {!workspaceId ? (
        <div className="admin-ft-form">
          <Input
            id="ft-workspace-name"
            label={he.adminFtStepWorkspace}
            value={workspaceName}
            onChange={(ev) => setWorkspaceName(ev.target.value)}
            placeholder={he.adminOrgNamePlaceholder}
          />
          <Input
            id="ft-owner-email"
            label={he.adminFtStepEmail}
            type="email"
            value={ownerEmail}
            onChange={(ev) => setOwnerEmail(ev.target.value)}
            placeholder="owner@example.com"
          />
          {phaseError ? (
            <p className="text-sm text-danger" role="alert">
              {phaseError}
            </p>
          ) : null}
          <Button
            variant="primary"
            disabled={workspaceName.trim().length < 2 || !ownerEmail.includes("@")}
            loading={createWorkspace.isPending}
            onClick={() => createWorkspace.mutate()}
          >
            {he.adminFtCreateWorkspace}
          </Button>
        </div>
      ) : !inviteLink ? (
        <div className="admin-ft-form">
          <p className="admin-ft-ok" role="status">
            {he.adminFtWorkspaceOk}
            {workspaceLabel ? ` — ${workspaceLabel}` : null}
          </p>
          <p className="text-xs text-fg-muted ltr-meta" dir="ltr">
            {he.adminFtPartialWorkspace}: {workspaceId}
          </p>
          <Input
            id="ft-owner-email-retry"
            label={he.adminFtStepEmail}
            type="email"
            value={ownerEmail}
            onChange={(ev) => setOwnerEmail(ev.target.value)}
          />
          {phaseError ? (
            <p className="text-sm text-danger" role="alert">
              {phaseError}
            </p>
          ) : null}
          <Button
            variant="primary"
            disabled={!ownerEmail.includes("@") || !workspaceId}
            loading={createInvite.isPending}
            onClick={() => workspaceId && createInvite.mutate(workspaceId)}
          >
            {phaseError ? he.adminFtRetryInvite : he.adminFtCreateInvite}
          </Button>
        </div>
      ) : (
        <div className="admin-ft-form">
          <p className="admin-ft-ok" role="status">
            {he.adminFtInviteOk}
          </p>
          <div className="admin-ft-link-box">
            <p className="text-xs text-fg-muted">{he.adminInviteLinkCopied}</p>
            <p className="ltr-meta break-all text-sm text-fg" dir="ltr">
              {inviteLink}
            </p>
          </div>
          <div className="admin-ft-link-actions">
            <Button
              variant="secondary"
              onClick={() => {
                if (!inviteLink) return;
                void navigator.clipboard.writeText(inviteLink).then(() => setCopied(true));
              }}
            >
              {copied ? he.adminInviteCopied : he.adminFtCopyLink}
            </Button>
            <a className="admin-ft-open-link" href={inviteLink} target="_blank" rel="noreferrer">
              {he.adminFtOpenInvite}
            </a>
            <Button
              variant="primary"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              {he.adminFtDone}
            </Button>
            <Button variant="ghost" onClick={reset}>
              {he.adminFtReset}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function AdminHome() {
  const { api } = useSession();
  const queryClient = useQueryClient();
  const [ftOpen, setFtOpen] = useState(false);
  const query = useQuery({ queryKey: ["admin-summary"], queryFn: () => api.adminSummary() });
  const data = query.data;
  const errorMessage =
    query.error instanceof ApiClientError ? query.error.message : query.isError ? he.adminSummaryError : null;

  const revoke = useMutation({
    mutationFn: (id: string) => api.adminRevokeInvitation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
    },
  });
  const reissue = useMutation({
    mutationFn: (id: string) => api.adminReissueInvitation(id),
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
      if (row.token) {
        const link = `${window.location.origin}/invite/${row.token}`;
        void navigator.clipboard.writeText(link);
      }
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-orgs"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-invitations"] });
  };

  return (
    <>
      <OpsCommandCenter
        data={data}
        loading={query.isLoading}
        errorMessage={errorMessage}
        onRefresh={() => void query.refetch()}
        onOpenFt={() => setFtOpen(true)}
        ftPanelOpen={ftOpen}
        onRevoke={(id) => revoke.mutate(id)}
        onReissue={(id) => reissue.mutate(id)}
        revokePending={revoke.isPending}
        reissuePending={reissue.isPending}
      />
      <FoundingTechnicianOnboard open={ftOpen} onOpenChange={setFtOpen} onDone={invalidate} />
    </>
  );
}
