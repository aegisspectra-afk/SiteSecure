import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { guestEntryPath } from "../../lib/auth-routes";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/portal/choose")({
  component: PortalChoosePage,
});

function PortalChoosePage() {
  const { loading, user } = useSession();
  if (loading) return <p className="p-6 text-sm text-fg-muted">{he.loading}</p>;
  if (!user) return <Navigate to={guestEntryPath()} />;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-xl font-semibold text-fg">{he.portalChooseTitle}</h1>
      <Link
        to="/app"
        className="inline-flex h-11 items-center justify-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg"
      >
        {he.portalChooseWorkspace}
      </Link>
      <Link
        to="/portal"
        className="inline-flex h-11 items-center justify-center rounded-[var(--radius-control)] border border-border px-4 text-sm font-medium text-fg"
      >
        {he.portalChoosePortal}
      </Link>
    </main>
  );
}
