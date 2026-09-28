import { createFileRoute } from "@tanstack/react-router";
import { JobsListPage } from "../../../components/jobs/JobsListPage";
import { RequirePermission } from "../../../components/settings/RequirePermission";

export const Route = createFileRoute("/app/jobs/")({
  component: JobsRoute,
});

function JobsRoute() {
  return (
    <RequirePermission permission="jobs.view">
      <JobsListPage />
    </RequirePermission>
  );
}
