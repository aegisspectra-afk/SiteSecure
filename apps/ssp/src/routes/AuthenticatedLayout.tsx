import { Button, ErrorState } from "@site-secure/ui";
import { Navigate } from "@tanstack/react-router";
import { RequireSspAccess } from "../components/RequirePermission";
import { SspShell } from "../components/SspShell";
import { he } from "../i18n/he";
import { platformHomeUrl } from "../lib/env";
import { OrgProvider } from "../lib/org";
import { useSession } from "../lib/session";

/**
 * Gate for all authenticated SSP product routes:
 * session → active workspace → ssp entitlement → ssp.forms.view (catalog OR product role).
 * Server still re-validates JWT / membership / authorize on every API call.
 */
export function AuthenticatedLayout() {
  const { loading, session, hasWorkspace, hasSsp, error, errorCode, refresh } = useSession();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-fg-muted">{he.loading}</p>
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" />;
  }

  if (!hasWorkspace) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-4">
        <ErrorState title={he.sessionError} description={error ?? undefined} />
        <Button type="button" variant="secondary" onClick={() => window.location.assign(platformHomeUrl())}>
          {he.backToPlatform}
        </Button>
      </main>
    );
  }

  if (!hasSsp) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-4" data-testid="ssp-entitlement-blocked">
        <ErrorState title={he.entitlementBlockedTitle} description={he.entitlementBlockedBody} />
        {errorCode === "FEATURE_NOT_INCLUDED" ? (
          <p className="text-sm text-fg-muted">{error}</p>
        ) : null}
        <Button type="button" variant="primary" onClick={() => window.location.assign(platformHomeUrl())}>
          {he.backToPlatform}
        </Button>
        <Button type="button" variant="ghost" onClick={() => void refresh()}>
          {he.retry}
        </Button>
      </main>
    );
  }

  return (
    <OrgProvider>
      <RequireSspAccess anyOf={["ssp.forms.view", "ssp.dashboard.view"]}>
        <SspShell />
      </RequireSspAccess>
    </OrgProvider>
  );
}
