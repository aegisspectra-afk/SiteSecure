import { createFileRoute } from "@tanstack/react-router";
import { PublicCctvStorageTool } from "../../components/public/marketing/PublicCctvStorageTool";

export const Route = createFileRoute("/tools/cctv-storage")({
  component: CctvStorageToolRoute,
});

function CctvStorageToolRoute() {
  return <PublicCctvStorageTool />;
}