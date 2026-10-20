import { ApiClientError, type FleetImportParseResult, type FleetImportPreviewResult } from "@site-secure/api-client";
import { Button, Select } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type ChangeEvent } from "react";
import { useFleetDepartment } from "../../../components/fleet/FleetDepartmentContext";
import { EmptyRows, ErrorState, ModuleScaffold, useMutation } from "../../../components/modules/ModuleKit";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/fleet/import")({
  component: FleetImportPage,
});

type Step = "upload" | "preview" | "done";

function buildColumnMap(columns: string[], plateCol: string): Record<string, string> {
  const column_map: Record<string, string> = {};
  if (plateCol) column_map[plateCol] = "license_plate";
  for (const col of columns) {
    if (col === plateCol) continue;
    if (/mileage|ק.?מ|קילומטר/i.test(col)) column_map[col] = "current_mileage";
    else if (/manufacturer|יצרן/i.test(col)) column_map[col] = "manufacturer";
    else if (/model|דגם/i.test(col)) column_map[col] = "model";
    else if (/status|סטטוס/i.test(col)) column_map[col] = "status";
    else if (/type|סוג/i.test(col)) column_map[col] = "vehicle_type";
  }
  return column_map;
}

function FleetImportPage() {
  const { session, api } = useSession();
  const { workspaceId, departmentId, departments } = useFleetDepartment();
  const membership = session?.memberships[0];
  const canImport = can(membership?.role_key, "fleet.import", membership?.features ?? []);
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<FleetImportParseResult | null>(null);
  const [preview, setPreview] = useState<FleetImportPreviewResult | null>(null);
  const [created, setCreated] = useState(0);
  const [plateCol, setPlateCol] = useState("");
  const [dept, setDept] = useState(departmentId ?? departments[0]?.id ?? "");

  const parse = useMutation({
    mutationFn: (file: File) => api.fleetImportParse(workspaceId, file),
    onSuccess: (res) => {
      setParsed(res);
      setError(null);
      const guess = res.columns.find((c) => /plate|רישוי|מספר/i.test(c)) ?? res.columns[0] ?? "";
      setPlateCol(guess);
      setStep("preview");
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.fleetError),
  });

  const previewMut = useMutation({
    mutationFn: () => {
      if (!parsed) throw new Error("no parse");
      return api.fleetImportPreview(workspaceId, {
        column_map: buildColumnMap(parsed.columns, plateCol),
        rows: parsed.rows,
        department_id: dept || null,
        default_department_id: dept || null,
      });
    },
    onSuccess: (res) => {
      setPreview(res);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.fleetError),
  });

  const commit = useMutation({
    mutationFn: () => {
      if (!parsed) throw new Error("no parse");
      return api.fleetImportCommit(workspaceId, {
        column_map: buildColumnMap(parsed.columns, plateCol),
        rows: parsed.rows,
        department_id: dept || null,
        default_department_id: dept || null,
        confirm: true,
      });
    },
    onSuccess: (res) => {
      setCreated(res.created);
      setStep("done");
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : he.fleetError),
  });

  if (!canImport) return <ErrorState title={he.forbiddenTitle} description={he.forbiddenBody} />;

  function onFile(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    parse.mutate(file);
  }

  return (
    <ModuleScaffold title={he.fleetImportTitle} lead={he.fleetImportLead}>
      {error ? <p role="alert">{error}</p> : null}

      {step === "upload" ? (
        <div className="ss-module-create">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">{he.fleetImportSelectFile}</span>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={onFile} disabled={parse.isPending} />
          </label>
          {parse.isPending ? <p className="ss-module-empty-text">{he.fleetLoading}</p> : null}
        </div>
      ) : null}

      {step === "preview" && parsed ? (
        <div className="space-y-4">
          <Select
            id="import-dept"
            label={he.fleetDepartment}
            value={dept}
            onChange={(ev) => setDept(ev.target.value)}
          >
            <option value="">—</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name_he}
              </option>
            ))}
          </Select>
          <Select
            id="import-plate-col"
            label={he.fleetImportMapPlate}
            value={plateCol}
            onChange={(ev) => setPlateCol(ev.target.value)}
          >
            {parsed.columns.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </Select>
          <div className="ss-module-toolbar">
            <Button type="button" onClick={() => previewMut.mutate()} disabled={previewMut.isPending}>
              {he.fleetImportPreview}
            </Button>
            {preview ? (
              <Button type="button" onClick={() => commit.mutate()} disabled={commit.isPending || preview.valid < 1}>
                {he.fleetImportCommit} ({preview.valid})
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setStep("upload");
                setParsed(null);
                setPreview(null);
              }}
            >
              {he.cancel}
            </Button>
          </div>
          {preview ? (
            <div className="ss-module-empty-text">
              {preview.valid}/{preview.total} · {preview.invalid} שגיאות
              {preview.errors.slice(0, 5).map((e) => (
                <div key={`${e.row}-${e.message}`}>
                  #{e.row}: {e.message}
                </div>
              ))}
            </div>
          ) : (
            <EmptyRows message={he.fleetImportPreview} />
          )}
        </div>
      ) : null}

      {step === "done" ? (
        <div className="ss-module-create">
          <p className="font-medium">{he.fleetImportDone}</p>
          <p>{he.fleetImportCreated(created)}</p>
          <Button
            type="button"
            onClick={() => {
              setStep("upload");
              setParsed(null);
              setPreview(null);
              setCreated(0);
            }}
          >
            {he.fleetImportUpload}
          </Button>
        </div>
      ) : null}
    </ModuleScaffold>
  );
}
