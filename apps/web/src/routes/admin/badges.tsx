import { Button, PageHeader } from "@site-secure/ui";
import { useNavigate, createFileRoute } from "@tanstack/react-router";
import { he } from "../../i18n/he";

export const Route = createFileRoute("/admin/badges")({
  component: AdminBadges,
});

function AdminBadges() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={he.adminBadges} description={he.adminBadgesLead} />
      <p className="text-sm text-fg-muted">{he.foundingTechnicianBadgeHint}</p>
      <Button variant="secondary" onClick={() => void navigate({ to: "/admin/users" })}>
        {he.adminUsers}
      </Button>
    </div>
  );
}
