import { PageHeader } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { ThemePicker } from "../../../components/ThemePicker";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/settings/appearance")({
  component: AppearancePage,
});

function AppearancePage() {
  return (
    <RequirePermission permission="workspace.edit">
      <div className="settings-panel flex flex-col gap-6">
        <PageHeader title={he.settingsNavAppearance} description={he.settingsAppearanceLead} />
        <section className="settings-section">
          <h2 className="settings-section-title">{he.appearanceTitle}</h2>
          <p className="settings-section-lead">{he.themeSystemHint}</p>
          <ThemePicker id="settings-theme" />
        </section>
      </div>
    </RequirePermission>
  );
}
