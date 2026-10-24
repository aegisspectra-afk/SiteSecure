import { createFileRoute } from "@tanstack/react-router";
import { WorkforceLegacyRedirect } from "../../../components/workforce/WorkforceLegacyRedirect";

export const Route = createFileRoute("/app/workforce/sites")({
  component: WorkforceLegacyRedirect,
});
