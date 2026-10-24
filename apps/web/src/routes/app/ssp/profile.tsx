import { Card, LoadingBlock } from "@site-secure/ui";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ErrorState, ModuleScaffold } from "../../../components/modules/ModuleKit";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";
import { productRoleLabelHe } from "../../../lib/ssp-product-authz";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/ssp/profile")({
  component: SspProfilePage,
});

function SspProfilePage() {
  const { session } = useSession();
  const { org, orgLoading, productRole } = useSspWorkspace();
  const membership = session?.memberships[0];

  if (orgLoading) return <LoadingBlock label={he.loading} />;

  return (
    <div data-testid="ssp-profile">
      <ModuleScaffold title={he.sspNavProfile} lead={he.sspProfileLead}>
        {!org && !orgLoading ? <ErrorState title={he.apiUnavailable} /> : null}
        <Card className="flex flex-col gap-3 text-sm">
          <p>
            <span className="text-fg-muted">{he.name}: </span>
            {session?.profile?.full_name || session?.email || "—"}
          </p>
          <p>
            <span className="text-fg-muted">{he.email}: </span>
            {session?.email || "—"}
          </p>
          <p>
            <span className="text-fg-muted">{he.sspProductRole}: </span>
            {productRoleLabelHe(productRole)}
          </p>
          <p>
            <span className="text-fg-muted">{he.sspWorkspaceRole}: </span>
            {membership?.role_key || org?.workspace_role_key || "—"}
          </p>
          <p>
            <span className="text-fg-muted">{he.sspNavOrganization}: </span>
            {org?.company?.name || "—"}
          </p>
          <Link to="/app/settings/profile" className="ops-section-link w-fit">
            {he.sspNavProfile}
          </Link>
        </Card>
      </ModuleScaffold>
    </div>
  );
}
