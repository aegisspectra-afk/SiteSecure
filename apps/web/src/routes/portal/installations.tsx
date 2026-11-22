import { Navigate, createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "../../components/portal/PortalShell";
import { he } from "../../i18n/he";
import { usePortalContext } from "../../lib/use-portal-context";

export const Route = createFileRoute("/portal/installations")({
  component: PortalInstallationsPage,
});

function PortalInstallationsPage() {
  const ctx = usePortalContext();
  if (!ctx.authed) return <Navigate to="/portal/login" />;
  const home = ctx.home;
  if (!home) return <p className="p-6 text-sm text-fg-muted">{he.loading}</p>;
  const siteName = new Map(home.sites.map((s) => [s.id, s.name]));
  return (
    <PortalShell title={he.portalSectionInstallations} brand={home.installer_brand} onSignOut={ctx.signOut}>
      <ul className="space-y-3 text-sm">
        {home.installations.map((job) => (
          <li key={job.id} className="rounded border border-border p-3">
            <p className="font-medium text-fg">
              {job.number} · {job.title}
            </p>
            <p className="text-fg-muted">
              {job.site_id ? siteName.get(job.site_id) ?? "—" : "—"}
              {job.completed_at ? ` · ${new Date(job.completed_at).toLocaleDateString("he-IL")}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </PortalShell>
  );
}