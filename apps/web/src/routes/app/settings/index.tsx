import { Link, createFileRoute } from "@tanstack/react-router";
import { cn } from "@site-secure/ui";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { SettingsHubRows, useSettingsIdentity, useSettingsNavGroups } from "../../../components/settings/SettingsShell";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/settings/")({
  component: SettingsHubPage,
});

function SettingsHubPage() {
  return (
    <RequirePermission permission="settings.view">
      <SettingsHubBody />
    </RequirePermission>
  );
}

function SettingsHubBody() {
  const identity = useSettingsIdentity();
  const groups = useSettingsNavGroups();

  return (
    <div className="settings-hub" data-testid="settings-hub">
      <header className="settings-hub-header">
        <h1 className="settings-hub-title">{he.settingsTitle}</h1>
      </header>

      <div className="settings-hub-identity">
        <img
          className="settings-hub-avatar"
          src={identity.avatarUrl}
          alt=""
          width={96}
          height={96}
          decoding="async"
        />
        <p className={cn("settings-hub-name", !identity.hasName && "is-placeholder")}>{identity.name}</p>
        {identity.email ? <p className="settings-hub-email ltr-meta">{identity.email}</p> : null}
        <div className="settings-hub-meta">
          {identity.role ? <span>{identity.role}</span> : null}
          {identity.role && identity.workspace ? <span aria-hidden>·</span> : null}
          {identity.workspace ? <span>{identity.workspace}</span> : null}
        </div>
        <Link to="/app/settings/profile" className="settings-hub-cta">
          {he.settingsEditProfile}
        </Link>
      </div>

      <SettingsHubRows groups={groups} />
    </div>
  );
}
