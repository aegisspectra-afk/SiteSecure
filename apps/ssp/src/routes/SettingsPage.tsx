import { PageHeader } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";

export function SettingsPage() {
  return (
    <RequireSspAccess permission="ssp.settings.view">
      <div className="flex flex-col gap-4" data-testid="ssp-settings">
        <PageHeader title={he.settingsTitle} description={he.settingsLead} />
        <p className="text-sm text-fg-muted">{he.settingsBody}</p>
        <Link to="/organization" className="text-sm font-medium text-fg underline">
          {he.navOrg}
        </Link>
      </div>
    </RequireSspAccess>
  );
}
