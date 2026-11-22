import { Navigate, createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "../../components/portal/PortalShell";
import { formatAddressLine } from "../../lib/address";
import { he } from "../../i18n/he";
import { usePortalContext } from "../../lib/use-portal-context";

export const Route = createFileRoute("/portal/sites/$siteId")({
  component: PortalSiteFilePage,
});

function PortalSiteFilePage() {
  const { siteId } = Route.useParams();
  const ctx = usePortalContext();
  if (!ctx.authed) return <Navigate to="/portal/login" />;
  const home = ctx.home;
  if (!home) return <p className="p-6 text-sm text-fg-muted">{he.loading}</p>;
  const site = home.sites.find((s) => s.id === siteId);
  if (!site) return <p className="p-6 text-sm text-fg">{he.portalEmpty}</p>;
  const equipment = home.equipment.filter((e) => e.site_id === siteId);
  const docs = home.documents;

  return (
    <PortalShell title={`${he.portalSiteFileTitle}: ${site.name}`} brand={home.installer_brand} onSignOut={ctx.signOut}>
      <section className="rounded border border-border p-4 text-sm">
        <p className="text-fg">{formatAddressLine(site.address) || site.name}</p>
        <p className="text-fg-muted">{site.installation_status}</p>
      </section>
      <section className="rounded border border-border p-4">
        <h2 className="text-sm font-semibold">{he.portalSectionEquipment}</h2>
        <ul className="mt-2 space-y-1 text-sm text-fg-muted">
          {equipment.map((eq) => (
            <li key={eq.id}>
              {eq.name}
              {eq.serial ? ` · ${eq.serial}` : ""}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded border border-border p-4">
        <h2 className="text-sm font-semibold">{he.portalSectionDocuments}</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {docs.map((doc) => (
            <li key={doc.id}>
              <button
                type="button"
                className="text-action underline"
                onClick={() => {
                  if (!ctx.accessId) return;
                  void ctx.api.getPortalDocumentUrl(ctx.accessId, doc.id).then((result) => {
                    window.open(result.url, "_blank", "noopener,noreferrer");
                  });
                }}
              >
                {doc.filename || he.portalOpenDocument}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </PortalShell>
  );
}