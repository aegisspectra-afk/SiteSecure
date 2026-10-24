import { Button, ErrorState } from "@site-secure/ui";
import { Navigate } from "@tanstack/react-router";
import { RequireAnyPermission } from "../components/RequirePermission";
import { WorkforceShell } from "../components/WorkforceShell";
import { he } from "../i18n/he";
import { workforceGate } from "../lib/access";
import { openConfiguredUrl, platformHomeUrl } from "../lib/env";
import { useSession } from "../lib/session";

function PlatformLink() {
  const url = platformHomeUrl();
  if (!url) return null;
  return (
    <Button type="button" variant="secondary" onClick={() => openConfiguredUrl(url)}>
      {he.backToPlatform}
    </Button>
  );
}

export function AuthenticatedLayout() {
  const { loading, session, hasWorkspace, hasWorkforce, error, signOut } = useSession();
  const gate = workforceGate({
    loading,
    hasSession: Boolean(session),
    hasWorkspace,
    hasWorkforce,
  });

  if (gate === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-fg-muted">{he.loading}</p>
      </main>
    );
  }

  if (gate === "login") {
    return <Navigate to="/login" />;
  }

  if (gate === "no-workspace") {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-4">
        <ErrorState title={he.sessionError} description={error ?? undefined} />
        <Button type="button" variant="secondary" onClick={() => void signOut()}>
          {he.signOut}
        </Button>
        <PlatformLink />
      </main>
    );
  }

  if (gate === "blocked") {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-4" data-testid="workforce-entitlement-blocked">
        <ErrorState title={he.entitlementBlockedTitle} description={he.entitlementBlockedBody} />
        <Button type="button" variant="secondary" onClick={() => void signOut()}>
          {he.signOut}
        </Button>
        <PlatformLink />
      </main>
    );
  }

  return (
    <RequireAnyPermission permissions={["workforce.view", "workforce.portal.view"]}>
      <WorkforceShell />
    </RequireAnyPermission>
  );
}
