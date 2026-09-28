import { createFileRoute } from "@tanstack/react-router";
import { AssetDetail } from "../../../components/sites/AssetDetail";
import { RequirePermission } from "../../../components/settings/RequirePermission";

export const Route = createFileRoute("/app/sites/$siteId_/assets/$assetId")({
  component: SiteAssetPage,
});

function SiteAssetPage() {
  return (
    <RequirePermission permission="systems.view">
      <SiteAssetBody />
    </RequirePermission>
  );
}

function SiteAssetBody() {
  const { siteId, assetId } = Route.useParams();
  return <AssetDetail siteId={siteId} assetId={assetId} />;
}
