import { RequirePermission } from "../components/RequirePermission";
import { EmptyRows, ModuleScaffold } from "../components/Kit";
import { he } from "../i18n/he";

export function ReportsPage() {
  return (
    <RequirePermission permission="workforce.reports.view">
      <ModuleScaffold title={he.reportsTitle} lead={he.reportsLead}>
        <EmptyRows message={he.reportsBlocked} />
      </ModuleScaffold>
    </RequirePermission>
  );
}
