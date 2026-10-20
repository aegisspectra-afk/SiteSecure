import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo } from "react";
import { FleetDepartmentProvider } from "../../../components/fleet/FleetDepartmentContext";
import { FleetDepartmentSwitcher } from "../../../components/fleet/FleetDepartmentSwitcher";
import { ErrorState, useQuery } from "../../../components/modules/ModuleKit";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { hasFeature } from "../../../lib/home";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/fleet")({
  validateSearch: (search: Record<string, unknown>): { departmentId?: string } => {
    if (typeof search.departmentId === "string" && search.departmentId) {
      return { departmentId: search.departmentId };
    }
    return {};
  },
  component: FleetLayoutPage,
});

const SUBNAV: Array<{ to: string; label: string }> = [
  { to: "/app/fleet", label: he.fleetNavDashboard },
  { to: "/app/fleet/vehicles", label: he.fleetNavVehicles },
  { to: "/app/fleet/mileage", label: he.fleetNavMileage },
  { to: "/app/fleet/my-vehicle", label: he.fleetNavMyVehicle },
  { to: "/app/fleet/maintenance", label: he.fleetNavMaintenance },
  { to: "/app/fleet/schedules", label: he.fleetNavSchedules },
  { to: "/app/fleet/documents", label: he.fleetNavDocuments },
  { to: "/app/fleet/equipment", label: he.fleetNavEquipment },
  { to: "/app/fleet/assignments", label: he.fleetNavAssignments },
  { to: "/app/fleet/reports", label: he.fleetNavReports },
  { to: "/app/fleet/import", label: he.fleetNavImport },
  { to: "/app/fleet/access", label: he.fleetNavAccess },
];

function storageKey(workspaceId: string) {
  return `ss-fleet-dept-${workspaceId}`;
}

function FleetLayoutPage() {
  const { session } = useSession();
  const features = session?.memberships[0]?.features ?? [];
  if (!hasFeature(features, "fleet")) {
    return <ErrorState title={he.forbiddenTitle} description={he.forbiddenBody} />;
  }
  return (
    <RequirePermission permission="fleet.view">
      <FleetLayoutBody />
    </RequirePermission>
  );
}

function FleetLayoutBody() {
  const { session, api } = useSession();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;

  const departmentsQuery = useQuery({
    queryKey: ["fleet-departments", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listFleetDepartments(workspaceId!),
  });

  const departments = departmentsQuery.data?.items ?? [];

  const setDepartmentId = useCallback(
    (id: string | undefined) => {
      if (workspaceId) {
        try {
          if (id) localStorage.setItem(storageKey(workspaceId), id);
          else localStorage.removeItem(storageKey(workspaceId));
        } catch {
          /* ignore */
        }
      }
      void navigate({
        to: pathname as "/app/fleet",
        search: (prev) => ({ ...prev, departmentId: id }),
        replace: true,
      });
    },
    [navigate, pathname, workspaceId],
  );

  useEffect(() => {
    if (!workspaceId || search.departmentId) return;
    try {
      const stored = localStorage.getItem(storageKey(workspaceId));
      if (stored) {
        void navigate({
          to: pathname as "/app/fleet",
          search: (prev) => ({ ...prev, departmentId: stored }),
          replace: true,
        });
      }
    } catch {
      /* ignore */
    }
  }, [navigate, pathname, search.departmentId, workspaceId]);

  useEffect(() => {
    if (!search.departmentId || !departments.length) return;
    if (!departments.some((d) => d.id === search.departmentId)) {
      setDepartmentId(undefined);
    }
  }, [departments, search.departmentId, setDepartmentId]);

  const ctx = useMemo(
    () => ({
      workspaceId: workspaceId ?? "",
      departmentId: search.departmentId,
      setDepartmentId,
      departments,
      departmentsLoading: departmentsQuery.isLoading,
      departmentsError: departmentsQuery.isError,
    }),
    [
      workspaceId,
      search.departmentId,
      setDepartmentId,
      departments,
      departmentsQuery.isLoading,
      departmentsQuery.isError,
    ],
  );

  if (!workspaceId) return <ErrorState title={he.fleetError} />;

  return (
    <FleetDepartmentProvider value={ctx}>
      <div className="ss-module space-y-4">
        <div className="fleet-subnav-bar">
          <nav className="fleet-subnav" aria-label={he.fleetTitle}>
            {SUBNAV.map((item) => {
              const active =
                item.to === "/app/fleet"
                  ? pathname === "/app/fleet" || pathname === "/app/fleet/"
                  : pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  search={(prev) => ({ ...prev, departmentId: search.departmentId })}
                  className={active ? "fleet-subnav-link is-active" : "fleet-subnav-link"}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <FleetDepartmentSwitcher
            departments={departments}
            value={search.departmentId}
            onChange={setDepartmentId}
            disabled={departmentsQuery.isLoading}
          />
        </div>
        <Outlet />
      </div>
    </FleetDepartmentProvider>
  );
}
