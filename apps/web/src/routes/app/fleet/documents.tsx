import { Link, createFileRoute } from "@tanstack/react-router";
import { useFleetDepartment } from "../../../components/fleet/FleetDepartmentContext";
import { vehicleTitle } from "../../../components/fleet/fleet-labels";
import { EmptyRows, ErrorState, ModuleScaffold, useQuery } from "../../../components/modules/ModuleKit";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/fleet/documents")({
  component: FleetDocumentsPage,
});

function FleetDocumentsPage() {
  const { api } = useSession();
  const { workspaceId, departmentId } = useFleetDepartment();

  const docsQuery = useQuery({
    queryKey: ["fleet-documents", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listDocuments(workspaceId, { entity_type: "vehicle", limit: 100 }),
  });

  const vehiclesQuery = useQuery({
    queryKey: ["fleet-vehicles", workspaceId, departmentId, "docs"],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listFleetVehicles(workspaceId, { department_id: departmentId, limit: 100 }),
  });

  if (docsQuery.isError && vehiclesQuery.isError) return <ErrorState title={he.fleetError} />;

  const docs = docsQuery.data?.items ?? [];
  const vehicles = vehiclesQuery.data?.items ?? [];

  return (
    <ModuleScaffold title={he.fleetDocumentsTitle} lead={he.fleetDocumentsLead}>
      {docsQuery.isLoading ? (
        <p className="ss-module-empty-text">{he.fleetLoading}</p>
      ) : docs.length > 0 ? (
        <ul className="ss-module-mobile-list">
          {docs.map((doc) => (
            <li key={doc.id} className="ss-module-mobile-row is-static">
              <div className="font-medium">{doc.original_filename ?? doc.kind}</div>
              <div className="ss-module-empty-text">
                {doc.entity_id} · {new Date(doc.created_at).toLocaleString("he-IL")}
              </div>
            </li>
          ))}
        </ul>
      ) : vehicles.length === 0 ? (
        <EmptyRows message={he.fleetDocumentsEmpty} />
      ) : (
        <ul className="ss-module-mobile-list">
          {vehicles.map((v) => (
            <li key={v.id}>
              <Link
                to="/app/fleet/vehicles/$vehicleId"
                params={{ vehicleId: v.id }}
                search={{ departmentId, tab: "documents" }}
                className="ss-module-mobile-row"
              >
                <div className="font-medium">{vehicleTitle(v)}</div>
                <div className="ss-module-empty-text">{he.fleetDocumentsOpenVehicle}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ModuleScaffold>
  );
}
