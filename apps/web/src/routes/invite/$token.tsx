import { Button } from "@site-secure/ui";
import { ApiClientError } from "@site-secure/api-client";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AuthLayout } from "../../components/AuthLayout";
import { he } from "../../i18n/he";
import { roleLabel } from "../../lib/app-nav";
import { homeVariant } from "../../lib/home";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/invite/$token")({
  component: InviteAcceptPage,
});

function InviteAcceptPage() {
  const { token } = Route.useParams();
  const { loading, user, session, api, refresh, signOut } = useSession();
  const navigate = useNavigate();
  const invitePath = `/invite/${token}`;

  const preview = useQuery({
    queryKey: ["invite-peek", token],
    enabled: Boolean(user && session && !loading && token),
    queryFn: () => api.peekInvitation(token),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => api.acceptInvitation(token),
    onSuccess: async () => {
      const hydrated = await refresh();
      const role = hydrated?.memberships[0]?.role_key;
      const variant = homeVariant(role);
      await navigate({ to: variant === "today" ? "/app/today" : "/app/dashboard" });
    },
  });

  const shell = useMemo(
    () => ({
      title: he.inviteTitle,
      kicker: he.inviteKicker,
      heading: he.inviteHeading,
      description: he.inviteDescription,
      variant: "login" as const,
    }),
    [],
  );

  if (loading) {
    return (
      <AuthLayout {...shell}>
        <p className="text-sm text-fg-muted">{he.loading}</p>
      </AuthLayout>
    );
  }

  if (!user || !session) {
    return (
      <AuthLayout {...shell}>
        <p className="mb-4 text-sm text-fg">{he.inviteAuthRequired}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            to="/login"
            search={{ next: invitePath }}
            className="inline-flex h-11 items-center justify-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg"
          >
            {he.loginTitle}
          </Link>
          <Link
            to="/register"
            search={{ next: invitePath }}
            className="inline-flex h-11 items-center justify-center rounded-[var(--radius-control)] border border-border px-4 text-sm font-medium text-fg"
          >
            {he.registerTitle}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (preview.isLoading) {
    return (
      <AuthLayout {...shell}>
        <p className="text-sm text-fg-muted">{he.loading}</p>
      </AuthLayout>
    );
  }

  const status = preview.data?.status ?? (preview.isError ? "invalid" : "invalid");
  const errorMessage =
    accept.error instanceof ApiClientError
      ? inviteErrorMessage(accept.error.code)
      : accept.error
        ? he.inviteAcceptError
        : null;

  if (status === "wrong_account") {
    return (
      <AuthLayout {...shell}>
        <p className="mb-2 text-sm text-fg" role="alert">
          {he.inviteWrongAccount}
        </p>
        {preview.data?.email ? (
          <p className="mb-4 text-sm text-fg-muted ltr-meta">{preview.data.email}</p>
        ) : null}
        <p className="mb-4 text-sm text-fg-muted">{he.inviteWrongAccountHint(session.email)}</p>
        <Button type="button" variant="secondary" onClick={() => void signOut()}>
          {he.signOut}
        </Button>
      </AuthLayout>
    );
  }

  if (status !== "valid") {
    return (
      <AuthLayout {...shell}>
        <p className="text-sm text-danger" role="alert">
          {inviteStatusMessage(status)}
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout {...shell}>
      <dl className="mb-6 grid gap-3 rounded-[var(--radius-panel)] border border-border bg-bg px-4 py-3 text-sm">
        <div>
          <dt className="text-xs text-fg-muted">{he.inviteWorkspace}</dt>
          <dd className="font-semibold text-fg">{preview.data?.workspace_name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">{he.role}</dt>
          <dd className="font-semibold text-fg">{roleLabel(preview.data?.role_key ?? undefined)}</dd>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">{he.email}</dt>
          <dd className="ltr-meta font-semibold text-fg">{preview.data?.email ?? session.email ?? "—"}</dd>
        </div>
      </dl>
      {errorMessage ? (
        <p className="mb-3 text-sm text-danger" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <Button
        type="button"
        variant="primary"
        className="h-11 w-full"
        loading={accept.isPending}
        onClick={() => accept.mutate()}
      >
        {he.inviteAcceptCta}
      </Button>
    </AuthLayout>
  );
}

function inviteStatusMessage(status: string): string {
  switch (status) {
    case "expired":
      return he.inviteExpired;
    case "already_accepted":
      return he.inviteAlreadyAccepted;
    default:
      return he.inviteInvalid;
  }
}

function inviteErrorMessage(code: string): string {
  switch (code) {
    case "INVITE_EXPIRED":
      return he.inviteExpired;
    case "INVITE_ALREADY_ACCEPTED":
      return he.inviteAlreadyAccepted;
    case "INVITE_EMAIL_MISMATCH":
      return he.inviteWrongAccount;
    case "PLAN_LIMIT_REACHED":
      return he.inviteSeatLimit;
    case "ROLE_NOT_ALLOWED":
      return he.inviteRoleNotAllowed;
    case "SUBSCRIPTION_INVALID":
      return he.inviteSubscriptionInvalid;
    case "TENANT_INACTIVE":
      return he.inviteWorkspaceInactive;
    default:
      return he.inviteInvalid;
  }
}
