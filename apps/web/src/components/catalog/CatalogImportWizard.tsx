import { Button, Input, Select, Status } from "@site-secure/ui";
import {
  ApiClientError,
  type CatalogCategory,
  type CatalogImportCommitResult,
  type CatalogImportParseResult,
  type CatalogImportPreviewResult,
  type CatalogImportSheetConfig,
} from "@site-secure/api-client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { he } from "../../i18n/he";
import { useSession } from "../../lib/session";

type Step = "upload" | "sheets" | "mapping" | "preview" | "done";

type SheetState = {
  sheet_index: number;
  include: boolean;
  header_row: number;
  category_id: string;
  manufacturer_default: string;
  unit_default: string;
  column_map: Record<string, string>;
};

const TARGET_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "— לא למפות —" },
  { value: "sku", label: "מק״ט" },
  { value: "manufacturer", label: "יצרן" },
  { value: "model", label: "דגם" },
  { value: "name", label: "שם" },
  { value: "description", label: "תיאור" },
  { value: "unit", label: "יחידה" },
  { value: "cost", label: "עלות / מחיר מתקין" },
  { value: "list_price", label: "מחיר מכירה" },
  { value: "attributes.resolution_mp", label: "רזולוציה MP" },
  { value: "attributes.form_factor", label: "מבנה מצלמה" },
  { value: "attributes.lens_mm", label: "עדשה מ״מ" },
  { value: "attributes.environment", label: "סביבה" },
  { value: "attributes.poe", label: "PoE" },
  { value: "attributes.max_power_w", label: "הספק W" },
  { value: "attributes.codec", label: "קודק" },
  { value: "attributes.fps", label: "FPS" },
  { value: "attributes.onvif", label: "ONVIF" },
  { value: "attributes.channels", label: "ערוצים" },
  { value: "attributes.poe_ports", label: "יציאות PoE" },
  { value: "attributes.poe_budget_w", label: "תקציב PoE" },
  { value: "attributes.drive_bays", label: "מפרצי דיסק" },
  { value: "attributes.max_hdd_tb", label: "נפח דיסק מרבי" },
  { value: "attributes.max_incoming_bandwidth_mbps", label: "רוחב פס" },
  { value: "attributes.capacity_tb", label: "נפח HDD" },
  { value: "attributes.surveillance_grade", label: "דיסק מעקב" },
  { value: "attributes.ports", label: "פורטים" },
  { value: "attributes.port_speed_mbps", label: "מהירות פורט" },
  { value: "attributes.uplink_speed_mbps", label: "אפלינק" },
];

function categoryIdForKey(categories: CatalogCategory[], key: string | null | undefined): string {
  if (!key) return "";
  const hit = categories.find((c) => c.key === key);
  return hit?.id ?? "";
}

export function CatalogImportWizard({
  open,
  onClose,
  onImported,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  categories: CatalogCategory[];
}) {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<CatalogImportParseResult | null>(null);
  const [sheets, setSheets] = useState<SheetState[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [duplicatePolicy, setDuplicatePolicy] = useState<"skip" | "update" | "new_only">("skip");
  const [preview, setPreview] = useState<CatalogImportPreviewResult | null>(null);
  const [result, setResult] = useState<CatalogImportCommitResult | null>(null);

  const leaves = useMemo(
    () => categories.filter((c) => c.parent_id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [categories],
  );

  const targetsQuery = useQuery({
    queryKey: ["catalog-import-targets", workspaceId],
    enabled: open && Boolean(workspaceId),
    queryFn: () => api.catalogImportTargets(workspaceId!),
  });

  const parseMut = useMutation({
    mutationFn: (file: File) => api.catalogImportParse(workspaceId!, file),
    onSuccess: (data) => {
      setParsed(data);
      setSheets(
        data.sheets.map((s) => ({
          sheet_index: s.index,
          include: s.suggested_include,
          header_row: s.header_row ?? 1,
          category_id: categoryIdForKey(categories, s.suggested_category_key),
          manufacturer_default: "",
          unit_default: "unit",
          column_map: { ...s.suggested_map },
        })),
      );
      setActiveSheet(0);
      setStep("sheets");
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : he.catalogImportError);
    },
  });

  const previewMut = useMutation({
    mutationFn: () =>
      api.catalogImportPreview(workspaceId!, {
        session_id: parsed!.session_id,
        duplicate_policy: duplicatePolicy,
        sheets: sheets.map(toConfig),
      }),
    onSuccess: (data) => {
      setPreview(data);
      setStep("preview");
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : he.catalogImportError);
    },
  });

  const commitMut = useMutation({
    mutationFn: () =>
      api.catalogImportCommit(workspaceId!, {
        session_id: parsed!.session_id,
        duplicate_policy: duplicatePolicy,
        sheets: sheets.map(toConfig),
        confirm: true,
      }),
    onSuccess: (data) => {
      setResult(data);
      setStep("done");
      setError(null);
      onImported();
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : he.catalogImportError);
    },
  });

  const included = sheets.filter((s) => s.include);
  const mappingSheet = sheets[activeSheet] ?? sheets.find((s) => s.include) ?? sheets[0];
  const mappingMeta = parsed?.sheets.find((s) => s.index === mappingSheet?.sheet_index);

  function updateActive(patch: Partial<SheetState>) {
    if (!mappingSheet) return;
    const i = sheets.findIndex((s) => s.sheet_index === mappingSheet.sheet_index);
    if (i < 0) return;
    const next = [...sheets];
    next[i] = { ...mappingSheet, ...patch };
    setSheets(next);
  }

  function resetAndClose() {
    setStep("upload");
    setParsed(null);
    setSheets([]);
    setPreview(null);
    setResult(null);
    setError(null);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[var(--radius-control)] border border-border bg-surface sm:rounded-[var(--radius-control)]">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-fg">{he.catalogImportTitle}</h2>
            <p className="text-xs text-fg-muted">{stepLabel(step)}</p>
          </div>
          <Button variant="ghost" onClick={resetAndClose}>
            {he.catalogCancel}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

          {step === "upload" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-fg-muted">{he.catalogImportUploadHint}</p>
              <p className="text-xs text-fg-muted">{targetsQuery.data?.google_sheets_note_he ?? he.catalogImportGoogleHint}</p>
              <p className="text-xs text-fg-muted">{targetsQuery.data?.pricing_note_he ?? he.catalogImportPricingHint}</p>
              <input
                type="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="block w-full text-sm"
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (f) parseMut.mutate(f);
                }}
              />
              {parseMut.isPending ? <p className="text-sm text-fg-muted">{he.catalogImportParsing}</p> : null}
            </div>
          ) : null}

          {step === "sheets" && parsed ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-fg">
                {he.catalogImportSheetsFound.replace("{n}", String(parsed.sheet_count))} · {parsed.filename}
              </p>
              <ul className="flex flex-col gap-2">
                {sheets.map((s, i) => {
                  const meta = parsed.sheets.find((x) => x.index === s.sheet_index)!;
                  return (
                    <li key={s.sheet_index} className="flex flex-wrap items-center gap-3 rounded border border-border px-3 py-2">
                      <label className="flex flex-1 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={s.include}
                          onChange={(ev) => {
                            const next = [...sheets];
                            next[i] = { ...s, include: ev.target.checked };
                            setSheets(next);
                          }}
                        />
                        <span className="font-medium">{meta.name}</span>
                        <span className="text-fg-muted">({meta.row_count} {he.catalogImportRows})</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {step === "mapping" && mappingSheet && mappingMeta ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {included.map((s) => {
                  const meta = parsed!.sheets.find((x) => x.index === s.sheet_index)!;
                  return (
                    <Button
                      key={s.sheet_index}
                      variant={s.sheet_index === mappingSheet.sheet_index ? "primary" : "ghost"}
                      onClick={() => setActiveSheet(sheets.findIndex((x) => x.sheet_index === s.sheet_index))}
                    >
                      {meta.name}
                    </Button>
                  );
                })}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  id="imp-header"
                  label={he.catalogImportHeaderRow}
                  type="number"
                  value={String(mappingSheet.header_row)}
                  onChange={(ev) => updateActive({ header_row: Number(ev.target.value) || 1 })}
                />
                <Select
                  id="imp-cat"
                  label={he.catalogImportCategory}
                  value={mappingSheet.category_id}
                  onChange={(ev) => updateActive({ category_id: ev.target.value })}
                >
                  <option value="">{he.catalogCategoryAll}</option>
                  {leaves.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.path || c.name_he}
                    </option>
                  ))}
                </Select>
                <Input
                  id="imp-mfr"
                  label={he.catalogImportManufacturerDefault}
                  value={mappingSheet.manufacturer_default}
                  onChange={(ev) => updateActive({ manufacturer_default: ev.target.value })}
                  placeholder="UNIVIEW"
                />
                <Select
                  id="imp-unit"
                  label={he.catalogUnit}
                  value={mappingSheet.unit_default}
                  onChange={(ev) => updateActive({ unit_default: ev.target.value })}
                >
                  <option value="unit">{he.catalogUnitUnit}</option>
                  <option value="m">{he.catalogUnitM}</option>
                  <option value="roll">{he.catalogUnitRoll}</option>
                  <option value="job">{he.catalogUnitJob}</option>
                  <option value="pack">{he.catalogUnitPack}</option>
                </Select>
              </div>

              <p className="text-xs text-fg-muted">
                {he.catalogImportHeaderConfidence}: {Math.round((mappingMeta.header_confidence ?? 0) * 100)}%
              </p>

              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">{he.catalogImportColumnMap}</p>
                {(mappingMeta.headers ?? []).map((h, colIdx) => (
                  <div key={colIdx} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-2">
                    <span className="truncate text-sm text-fg-muted" title={String(h ?? "")}>
                      {String(h ?? `(עמודה ${colIdx + 1})`)}
                    </span>
                    <Select
                      id={`map-${colIdx}`}
                      label=""
                      value={mappingSheet.column_map[String(colIdx)] ?? ""}
                      onChange={(ev) => {
                        const map = { ...mappingSheet.column_map };
                        if (!ev.target.value) delete map[String(colIdx)];
                        else map[String(colIdx)] = ev.target.value;
                        updateActive({ column_map: map });
                      }}
                    >
                      {TARGET_OPTIONS.map((o) => (
                        <option key={o.value || "none"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>

              <Select
                id="dup-policy"
                label={he.catalogImportDupPolicy}
                value={duplicatePolicy}
                onChange={(ev) => setDuplicatePolicy(ev.target.value as typeof duplicatePolicy)}
              >
                <option value="skip">{he.catalogImportDupSkip}</option>
                <option value="update">{he.catalogImportDupUpdate}</option>
                <option value="new_only">{he.catalogImportDupNewOnly}</option>
              </Select>
            </div>
          ) : null}

          {step === "preview" && preview ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label={he.catalogImportDetected} value={preview.summary.detected} />
                <Stat label={he.catalogImportReady} value={preview.summary.ready} tone="success" />
                <Stat label={he.catalogImportWarning} value={preview.summary.warning} tone="warning" />
                <Stat label={he.catalogImportBlocked} value={preview.summary.blocked} tone="danger" />
              </div>
              <p className="text-sm text-fg-muted">
                {he.catalogImportWillCreate}: {preview.summary.will_create} · {he.catalogImportWillUpdate}:{" "}
                {preview.summary.will_update} · {he.catalogImportWillSkip}: {preview.summary.will_skip} ·{" "}
                {he.catalogImportDuplicates}: {preview.summary.duplicates}
              </p>
              <div className="overflow-x-auto rounded border border-border">
                <table className="min-w-full text-start text-xs">
                  <thead className="bg-surface-muted">
                    <tr>
                      <th className="p-2">{he.catalogSku}</th>
                      <th className="p-2">{he.catalogName}</th>
                      <th className="p-2">{he.catalogStatus}</th>
                      <th className="p-2">{he.catalogImportNormalized}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample_rows.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="p-2 public-mono">{row.product?.sku ?? "—"}</td>
                        <td className="p-2">{row.product?.name ?? "—"}</td>
                        <td className="p-2">
                          <Status
                            label={
                              row.status === "ready"
                                ? he.catalogImportReady
                                : row.status === "warning"
                                  ? he.catalogImportWarning
                                  : he.catalogImportBlocked
                            }
                            tone={row.status === "ready" ? "success" : row.status === "warning" ? "warning" : "danger"}
                          />
                        </td>
                        <td className="p-2 text-fg-muted">
                          {row.product?.attributes
                            ? Object.entries(row.product.attributes)
                                .map(([k, v]) => `${k}=${String(v)}`)
                                .join(", ") || "—"
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {step === "done" && result ? (
            <div className="flex flex-col gap-3">
              <p className="text-base font-semibold text-fg">{result.message_he}</p>
              <ul className="list-inside list-disc text-sm text-fg-muted">
                <li>
                  {he.catalogImportCamerasCore}: {result.readiness.camera_structured}
                </li>
                <li>
                  {he.catalogImportNvrsCore}: {result.readiness.nvr_structured}
                </li>
                <li>
                  {he.catalogImportHddsCore}: {result.readiness.hdd_structured}
                </li>
                <li>
                  {he.catalogImportSwitchesCore}: {result.readiness.switch_structured}
                </li>
                {result.readiness.incomplete_technical ? (
                  <li>
                    {he.catalogImportIncompleteTech}: {result.readiness.incomplete_technical}
                  </li>
                ) : null}
              </ul>
              {result.failed_count ? (
                <p className="text-sm text-danger">
                  {he.catalogImportFailed}: {result.failed_count}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-between gap-2 border-t border-border px-4 py-3">
          <div className="flex gap-2">
            {step !== "upload" && step !== "done" ? (
              <Button
                variant="ghost"
                onClick={() => {
                  if (step === "sheets") setStep("upload");
                  else if (step === "mapping") setStep("sheets");
                  else if (step === "preview") setStep("mapping");
                }}
              >
                {he.catalogImportBack}
              </Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            {step === "sheets" ? (
              <Button
                disabled={!included.length}
                onClick={() => {
                  const first = sheets.findIndex((s) => s.include);
                  setActiveSheet(first >= 0 ? first : 0);
                  setStep("mapping");
                }}
              >
                {he.catalogImportNext}
              </Button>
            ) : null}
            {step === "mapping" ? (
              <Button
                loading={previewMut.isPending}
                disabled={included.some((s) => !s.category_id)}
                onClick={() => previewMut.mutate()}
              >
                {he.catalogImportValidate}
              </Button>
            ) : null}
            {step === "preview" && preview ? (
              <Button
                loading={commitMut.isPending}
                disabled={preview.summary.will_create + preview.summary.will_update <= 0}
                onClick={() => commitMut.mutate()}
              >
                {he.catalogImportConfirm.replace(
                  "{n}",
                  String(preview.summary.will_create + preview.summary.will_update),
                )}
              </Button>
            ) : null}
            {step === "done" ? <Button onClick={resetAndClose}>{he.catalogImportOpenCatalog}</Button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function toConfig(s: SheetState): CatalogImportSheetConfig {
  return {
    sheet_index: s.sheet_index,
    include: s.include,
    header_row: s.header_row,
    category_id: s.category_id || null,
    manufacturer_default: s.manufacturer_default || null,
    unit_default: s.unit_default,
    column_map: s.column_map,
  };
}

function stepLabel(step: Step): string {
  switch (step) {
    case "upload":
      return he.catalogImportStepUpload;
    case "sheets":
      return he.catalogImportStepSheets;
    case "mapping":
      return he.catalogImportStepMapping;
    case "preview":
      return he.catalogImportStepPreview;
    case "done":
      return he.catalogImportStepDone;
  }
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-lg font-semibold text-fg"
      : tone === "warning"
        ? "text-lg font-semibold text-fg"
        : tone === "danger"
          ? "text-lg font-semibold text-danger"
          : "text-lg font-semibold text-fg";
  return (
    <div className="rounded border border-border p-2">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className={toneClass}>{value}</p>
    </div>
  );
}
