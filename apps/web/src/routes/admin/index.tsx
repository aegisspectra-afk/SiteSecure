import { PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const { api } = useSession();
  const query = useQuery({ queryKey: ["admin-summary"], queryFn: () => api.adminSummary() });
  const data = query.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={he.adminTitle} description={he.adminLead} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={he.adminOrgs} value={data?.organizations} />
        <Stat label={he.adminBeta} value={data?.beta_organizations} />
        <Stat label={he.adminUsers} value={data?.users} />
        <Stat label={he.adminOpenFeedback} value={data?.feedback_open} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="ops-card px-4 py-4">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-fg">{value ?? "—"}</p>
    </div>
  );
}
