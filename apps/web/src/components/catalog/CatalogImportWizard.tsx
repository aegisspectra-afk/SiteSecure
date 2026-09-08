import { Button, Input, Select, Status } from "@site-secure/ui";
import {
  ApiClientError,
  type CatalogCategory,
  type CatalogImportCommitResult,
  type CatalogImportParseResult,
  type CatalogImportPreviewResult,
  type CatalogImportSheetConfig,
} from "@site-secure/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
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

const STEPS: Array<{ id: Step; short: string; label: string }> = [
  { id: "upload", short: "העלאה", label: "העלאת קובץ" },
  { id: "sheets", short: "גיליונות", label: "גיליונות" },
  { id: "mapping", short: "מיפוי", label: "מיפוי" },
  { id: "preview", short: "בדיקה", label: "בדיקה" },
  { id: "done", short: "ייבוא", label: "ייבוא" },
];

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

function getFocusable(root: HTMLElement) {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
}

function stepIndex(step: Step): number {
  return STEPS.findIndex((s) => s.id === step);
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
  const queryClient = useQueryClient();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<CatalogImportParseResult | null>(null);
  const [sheets, setSheets] = useState<SheetState[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [duplicatePolicy, setDuplicatePolicy] = useState<"skip" | "update" | "new_only">("skip");
  const [preview, setPreview] = useState<CatalogImportPreviewResult | null>(null);
  const [result, setResult] = useState<CatalogImportCommitResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  onCloseRef.current = onClose;

  const leaves = useMemo(() => {
    const child = categories.filter((c) => c.parent_id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    if (child.length) return child;
    // Flat taxonomy fallback (roots only) — still allow mapping after wipe/legacy seed.
    return categories.filter((c) => !c.parent_id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [categories]);

  const included = sheets.filter((s) => s.include);
  const missingCategorySheets = included.filter((s) => !s.category_id);
  const mappingBlocked = missingCategorySheets.length > 0 || leaves.length === 0;

  const ensureCats = useMutation({
    mutationFn: () => api.ensureCatalogDefaults(workspaceId!),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["catalog-categories", workspaceId] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : he.catalogImportError);
    },
  });

  useEffect(() => {
    if (!open || !workspaceId) return;
    if (leaves.length > 0) return;
    ensureCats.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only auto-seed when wizard opens with empty taxonomy
  }, [open, workspaceId, leaves.length]);

  useEffect(() => {
    if (!parsed || !categories.length || !sheets.length) return;
    setSheets((prev) => {
      let changed = false;
      const next = prev.map((s) => {
        if (s.category_id) return s;
        const meta = parsed.sheets.find((x) => x.index === s.sheet_index);
        const id = categoryIdForKey(categories, meta?.suggested_category_key);
        if (!id) return s;
        changed = true;
        return { ...s, category_id: id };
      });
      return changed ? next : prev;
    });
  }, [categories, parsed, sheets.length]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(id);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), 180);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted || !visible) return;
    const panel = panelRef.current;
    if (panel) {
      const active = document.activeElement as HTMLElement | null;
      if (!active || !panel.contains(active)) {
        closeRef.current?.focus();
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        resetAndClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const nodes = getFocusable(panelRef.current);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetAndClose is stable enough for Escape
  }, [mounted, visible]);

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

  const mappingSheet = sheets[activeSheet] ?? sheets.find((s) => s.include) ?? sheets[0];
  const mappingMeta = parsed?.sheets.find((s) => s.index === mappingSheet?.sheet_index);
  const currentStep = stepIndex(step);

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
    setSelectedName(null);
    setDragOver(false);
    onCloseRef.current();
  }

  function acceptFile(file: File | undefined | null) {
    if (!file) return;
    setSelectedName(file.name);
    setError(null);
    parseMut.mutate(file);
  }

  function onDrop(ev: DragEvent) {
    ev.preventDefault();
    setDragOver(false);
    const file = ev.dataTransfer.files?.[0];
    acceptFile(file);
  }

  if (!mounted || typeof document === "undefined") return null;

  const maxBytes = targetsQuery.data?.max_file_bytes ?? 12 * 1024 * 1024;
  const maxMb = Math.round(maxBytes / (1024 * 1024));

  const footer = (
    <>
      <div className="flex gap-2">
        {step === "upload" || step === "done" ? (
          <Button variant="ghost" onClick={resetAndClose}>
            {he.catalogCancel}
          </Button>
        ) : (
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
        )}
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
            disabled={mappingBlocked}
            title={
              mappingBlocked
                ? leaves.length === 0
                  ? he.catalogImportNeedCategories
                  : he.catalogImportNeedCategoryPerSheet
                : undefined
            }
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
    </>
  );

  return createPortal(
    <div className={`catalog-import-root${visible ? " is-open" : ""}`} role="presentation">
      <button
        type="button"
        className={`catalog-import-backdrop${visible ? " is-open" : ""}`}
        aria-label={he.catalogImportClose}
        tabIndex={-1}
        onClick={resetAndClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`catalog-import-panel${visible ? " is-open" : ""}`}
      >
        <header className="catalog-import-header">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-fg">
              {he.catalogImportTitle}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{he.catalogImportSubtitle}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="shrink-0 rounded-[var(--radius-control)] p-2 text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            aria-label={he.catalogImportClose}
            onClick={resetAndClose}
          >
            <X className="size-4" />
          </button>
        </header>

        <nav className="catalog-import-stepper" aria-label={he.catalogImportStepsLabel}>
          <p className="catalog-import-stepper-mobile text-sm text-fg-muted">
            {he.catalogImportStepOf
              .replace("{n}", String(currentStep + 1))
              .replace("{total}", String(STEPS.length))}{" "}
            · {STEPS[currentStep]?.label}
          </p>
          <ol className="catalog-import-stepper-desktop">
            {STEPS.map((s, i) => {
              const state = i < currentStep ? "done" : i === currentStep ? "current" : "upcoming";
              return (
                <li key={s.id} className={`catalog-import-step catalog-import-step--${state}`}>
                  <span className="catalog-import-step-index" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="catalog-import-step-label">{s.short}</span>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="catalog-import-body">
          {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}

          {step === "upload" ? (
            <div className="flex flex-col gap-4">
              <div
                className={`catalog-import-dropzone${dragOver ? " is-dragover" : ""}`}
                onDragEnter={(ev) => {
                  ev.preventDefault();
                  setDragOver(true);
                }}
                onDragOver={(ev) => {
                  ev.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <p className="text-base font-semibold text-fg">{he.catalogImportUploadTitle}</p>
                <p className="mt-1 text-sm text-fg-muted">{he.catalogImportUploadFormats}</p>
                <p className="mt-1 text-xs text-fg-subtle">
                  {he.catalogImportUploadLimit.replace("{n}", String(maxMb))}
                </p>
                <div className="mt-4">
                  <Button
                    type="button"
                    loading={parseMut.isPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {he.catalogImportChooseFile}
                  </Button>
                </div>
                {selectedName ? (
                  <p className="mt-3 text-sm text-fg-muted public-mono">{selectedName}</p>
                ) : null}
                {parseMut.isPending ? <p className="mt-2 text-sm text-fg-muted">{he.catalogImportParsing}</p> : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="sr-only"
                  onChange={(ev) => {
                    acceptFile(ev.target.files?.[0]);
                    ev.target.value = "";
                  }}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <aside className="catalog-import-callout">
                  <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{he.catalogImportPrivacyTitle}</p>
                  <p className="mt-1 text-sm text-fg-muted">{he.catalogImportPrivacyBody}</p>
                </aside>
                <aside className="catalog-import-callout">
                  <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{he.catalogImportSheetsTitle}</p>
                  <p className="mt-1 text-sm text-fg-muted">
                    {targetsQuery.data?.google_sheets_note_he ?? he.catalogImportGoogleBody}
                  </p>
                </aside>
              </div>

              <aside className="catalog-import-callout catalog-import-callout--warn" role="note">
                <p className="text-sm font-semibold text-fg">{he.catalogImportPricingTitle}</p>
                <p className="mt-1 text-sm text-fg-muted">
                  {targetsQuery.data?.pricing_note_he ?? he.catalogImportPricingBody}
                </p>
              </aside>
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
                    <li
                      key={s.sheet_index}
                      className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] border border-border bg-bg-1 px-3 py-2"
                    >
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
                        <span className="text-fg-muted">
                          ({meta.row_count} {he.catalogImportRows})
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {step === "mapping" && mappingSheet && mappingMeta ? (
            <div className="flex flex-col gap-4">
              {mappingBlocked ? (
                <aside className="catalog-import-callout catalog-import-callout--warn" role="status">
                  {leaves.length === 0 ? (
                    <>
                      <p className="text-sm font-semibold text-fg">{he.catalogImportNeedCategoriesTitle}</p>
                      <p className="mt-1 text-sm text-fg-muted">{he.catalogImportNeedCategories}</p>
                      <div className="mt-3">
                        <Button
                          type="button"
                          variant="secondary"
                          loading={ensureCats.isPending}
                          onClick={() => ensureCats.mutate()}
                        >
                          {he.catalogImportRestoreCategories}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-fg">{he.catalogImportNeedCategoryTitle}</p>
                      <p className="mt-1 text-sm text-fg-muted">{he.catalogImportNeedCategoryPerSheet}</p>
                      <ul className="mt-2 list-inside list-disc text-sm text-fg">
                        {missingCategorySheets.map((s) => {
                          const meta = parsed!.sheets.find((x) => x.index === s.sheet_index);
                          return <li key={s.sheet_index}>{meta?.name ?? `גיליון ${s.sheet_index + 1}`}</li>;
                        })}
                      </ul>
                    </>
                  )}
                </aside>
              ) : (
                <aside className="catalog-import-callout" role="note">
                  <p className="text-sm text-fg-muted">{he.catalogImportMappingHint}</p>
                </aside>
              )}

              <div className="flex flex-wrap gap-2">
                {included.map((s) => {
                  const meta = parsed!.sheets.find((x) => x.index === s.sheet_index)!;
                  const needsCat = !s.category_id;
                  return (
                    <Button
                      key={s.sheet_index}
                      variant={s.sheet_index === mappingSheet.sheet_index ? "primary" : "ghost"}
                      onClick={() => setActiveSheet(sheets.findIndex((x) => x.sheet_index === s.sheet_index))}
                    >
                      {meta.name}
                      {needsCat ? " · !" : ""}
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
                  label={`${he.catalogImportCategory}${!mappingSheet.category_id ? ` · ${he.catalogImportRequired}` : ""}`}
                  value={mappingSheet.category_id}
                  onChange={(ev) => updateActive({ category_id: ev.target.value })}
                >
                  <option value="">{he.catalogImportPickCategory}</option>
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
              <div className="overflow-x-auto rounded-[var(--radius-control)] border border-border">
                <table className="min-w-full text-start text-xs">
                  <thead className="bg-bg-subtle">
                    <tr>
                      <th className="p-2">{he.catalogSku}</th>
                      <th className="p-2">{he.catalogName}</th>
                      <th className="p-2">{he.catalogStatus}</th>
                      <th className="p-2">{he.catalogImportNormalized}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample_rows.map((row, i) => (
                      <tr key={i} className="border-t border-border bg-bg-1">
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

        <footer className="catalog-import-footer">{footer}</footer>
      </div>
    </div>,
    document.body,
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
    tone === "danger" ? "text-lg font-semibold text-danger" : "text-lg font-semibold text-fg";
  return (
    <div className="rounded-[var(--radius-control)] border border-border bg-bg-1 p-2">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className={toneClass}>{value}</p>
    </div>
  );
}
