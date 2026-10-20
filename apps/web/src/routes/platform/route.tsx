import { Button, ErrorState } from "@site-secure/ui";
import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { guestEntryPath } from "../../lib/auth-routes";
import { useDocumentMeta } from "../../lib/document-meta";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/platform")({
  component: PlatformLayout,
});

function PlatformLayout() {
  const { loading, user, session, error, refresh } = useSession();

  useDocumentMeta({
    title: `${he.platformHomeTitle} — ${he.brand}`,
    robots: "noindex, nofollow",
  });

  if (loading) {
    return (
      <div className="platform-home flex min-h-dvh items-center justify-center p-6" dir="rtl">
        <p className="text-sm text-fg-muted">{he.loading}</p>
      </div>
    );
  }
  if (!user) return <Navigate to={guestEntryPath()} />;
  if (error && !session) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-3xl items-center justify-center p-6" dir="rtl">
        <ErrorState
          title={he.apiUnavailable}
          description={error}
          action={
            <Button variant="secondary" onClick={() => void refresh()}>
              {he.retry}
            </Button>
          }
        />
      </div>
    );
  }
  if (!session?.has_workspace) {
    return <Navigate to="/onboarding" />;
  }

  return (
    <div className="min-h-dvh" dir="rtl">
      <Outlet />
    </div>
  );
}
