import { createFileRoute } from "@tanstack/react-router";
import { FieldJob } from "../../../components/field/FieldJob";
import { RequirePermission } from "../../../components/settings/RequirePermission";

export const Route = createFileRoute("/app/jobs/$jobId")({
  component: JobDetailPage,
});

function JobDetailPage() {
  return (
    <RequirePermission permission="jobs.view">
      <JobRouteBody />
    </RequirePermission>
  );
}

function JobRouteBody() {
  const { jobId } = Route.useParams();
  return <FieldJob jobId={jobId} />;
}
