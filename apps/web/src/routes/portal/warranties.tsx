import { Navigate, createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "../../components/portal/PortalShell";
import { he } from "../../i18n/he";
import { usePortalContext } from "../../lib/use-portal-context";

export const Route = createFileRoute("/portal/warranties")({
  component: PortalWarrantiesPage,
});

function PortalWarrantiesPage() {
  const ctx = usePortalContext();
  if (!ctx.authed) return <Navigate to="/portal/login" />;
  const home = ctx.home;
  if (!home) return <p className="p-6 text-sm text-fg-muted">{he.loading}</p>;
  return (
    <PortalShell title={he.portalSectionWarranties} brand={home.installer_brand} onSignOut={ctx.signOut}>
      <ul className="space-y-3 text-sm">
        {home.warranties.map((item) => (
          <li key={item.id} className="rounded border border-border p-3 text-fg">
            <p className="font-medium">
              {item.number} · {item.status}
            </p>
            {item.ends_on ? <p className="text-fg-muted">עד {new Date(item.ends_on).toLocaleDateString("he-IL")}</p> : null}
          </li>
        ))}
      </ul>
    </PortalShell>
  );
}