import { createFileRoute } from "@tanstack/react-router";
import { SiteDossier } from "../../../components/sites/SiteDossier";
import { RequirePermission } from "../../../components/settings/RequirePermission";

export const Route = createFileRoute("/app/sites/$siteId")({
  component: SiteDetailPage,
});

function SiteDetailPage() {
  return (
    <RequirePermission permission="sites.view">
      <SiteDetailBody />
    </RequirePermission>
  );
}

function SiteDetailBody() {
  const { siteId } = Route.useParams();
  return <SiteDossier siteId={siteId} />;
}
