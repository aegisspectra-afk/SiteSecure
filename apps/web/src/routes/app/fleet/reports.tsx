import { Button, Select, Table, TBody, TD, TH, THead, TR } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useFleetDepartment } from "../../../components/fleet/FleetDepartmentContext";
import { downloadCsv, FLEET_REPORT_KEYS, type FleetReportKey } from "../../../components/fleet/fleet-labels";
import { EmptyRows, ErrorState, ModuleScaffold, useQuery } from "../../../components/modules/ModuleKit";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/fleet/reports")({
  component: FleetReportsPage,
});

function FleetReportsPage() {
  const { session, api } = useSession();
  const { workspaceId, departmentId } = useFleetDepartment();
  const membership = session?.memberships[0];
  const canReports = can(membership?.role_key, "fleet.reports", membership?.features ?? []);
  const [reportKey, setReportKey] = useState<FleetReportKey>("vehicles");
  const [activeKey, setActiveKey] = useState<FleetReportKey | null>(null);

  const reportQuery = useQuery({
    queryKey: ["fleet-report", workspaceId, activeKey, departmentId],
    enabled: Boolean(workspaceId && activeKey && canReports),
    queryFn: () => api.getFleetReport(workspaceId, activeKey!, { department_id: departmentId }),
  });

  const columns = useMemo(() => {
    const rows = reportQuery.data?.rows ?? [];
    if (!rows.length) return [] as string[];
    const keys = new Set<string>();
    rows.forEach((row) => Object.keys(row).forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [reportQuery.data?.rows]);

  if (!canReports) return <ErrorState title={he.forbiddenTitle} description={he.forbiddenBody} />;
  if (reportQuery.isError) return <ErrorState title={he.fleetError} />;

  return (
    <ModuleScaffold title={he.fleetReportsTitle} lead={he.fleetReportsLead}>
      <div className="ss-module-toolbar">
        <Select
          id="fleet-report-key"
          label={he.fleetReportType}
          value={reportKey}
          onChange={(ev) => setReportKey(ev.target.value as FleetReportKey)}
        >
          {FLEET_REPORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {he.fleetReportKeys[key]}
            </option>
          ))}
        </Select>
        <Button type="button" onClick={() => setActiveKey(reportKey)}>
          {he.fleetReportLoad}
        </Button>
        {reportQuery.data?.rows?.length ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              downloadCsv(`fleet-${activeKey ?? reportKey}.csv`, reportQuery.data!.rows)
            }
          >
            {he.fleetReportDownload}
          </Button>
        ) : null}
      </div>

      {!activeKey ? (
        <EmptyRows message={he.fleetReportEmpty} />
      ) : reportQuery.isLoading ? (
        <p className="ss-module-empty-text">{he.fleetLoading}</p>
      ) : !(reportQuery.data?.rows?.length) ? (
        <EmptyRows message={he.fleetReportEmpty} />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                {columns.map((col) => (
                  <TH key={col}>{col}</TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {reportQuery.data.rows.map((row, idx) => (
                <TR key={idx}>
                  {columns.map((col) => (
                    <TD key={col}>{row[col] == null ? "—" : String(row[col])}</TD>
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </ModuleScaffold>
  );
}
