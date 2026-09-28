import { Button } from "@site-secure/ui";
import { ApiClientError } from "@site-secure/api-client";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AuthLayout } from "../../../components/AuthLayout";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/portal/invite/$token")({
  component: PortalInvitePage,
});

function PortalInvitePage() {
  const { token } = Route.useParams();
  const { loading, user, api, signOut } = useSession();
  const navigate = useNavigate();
  const invitePath = `/portal/invite/${token}`;

  const preview = useQuery({
    queryKey: ["portal-invite", token],
    enabled: Boolean(user && !loading && token),
    queryFn: () => api.peekPortalInvite(token),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => api.acceptPortalInvite(token),
    onSuccess: async () => {
      await navigate({ to: "/portal" });
    },
  });

  const shell = {
    title: he.portalInviteTitle,
    kicker: "SITE SECURE",
    heading: he.portalInviteHeading,
    description: he.portalInviteDescription,
    variant: "login" as const,
  };

  if (loading) {
    return (
      <AuthLayout {...shell}>
        <p className="text-sm text-fg-muted">{he.loading}</p>
      </AuthLayout>
    );
  }

  if (!user) {
    return (
      <AuthLayout {...shell}>
        <p className="mb-4 text-sm text-fg">{he.portalInviteAuthRequired}</p>
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

  const status = preview.data?.status;
  const error =
    accept.error instanceof ApiClientError
      ? accept.error.message
      : status === "wrong_account"
        ? he.portalInviteWrongAccount
        : status && status !== "valid"
          ? he.portalInviteTitle
          : null;

  return (
    <AuthLayout {...shell}>
      {preview.data?.customer_name ? <p className="mb-2 text-sm text-fg">{preview.data.customer_name}</p> : null}
      {preview.data?.workspace_name ? <p className="mb-4 text-sm text-fg-muted">{preview.data.workspace_name}</p> : null}
      {status === "wrong_account" ? (
        <Button type="button" variant="secondary" onClick={() => void signOut()}>
          {he.portalSignOut}
        </Button>
      ) : (
        <Button type="button" loading={accept.isPending} disabled={status !== "valid"} onClick={() => accept.mutate()}>
          {he.portalInviteAccept}
        </Button>
      )}
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </AuthLayout>
  );
}
