import type { EquipmentOut, SystemOut } from "@site-secure/api-client";
import { Button, Input, Select, Status } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { he } from "../../i18n/he";
import {
  ASSET_CATEGORY_OPTIONS,
  ASSET_STATUS_OPTIONS,
  equipmentCategoryLabel,
  equipmentStatusLabel,
  equipmentStatusTone,
  filterSiteAssets,
  formatAssetDate,
  manufacturerModel,
  systemName,
} from "../../lib/site-assets";

export function SiteAssetsPanel({
  siteId,
  equipment,
  systems,
  canEdit,
  onAdd,
  addPending,
}: {
  siteId: string;
  equipment: EquipmentOut[];
  systems: SystemOut[];
  canEdit?: boolean;
  onAdd?: (payload: {
    name: string;
    category: string;
    serial?: string;
    location_note?: string;
  }) => void;
  addPending?: boolean;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [systemId, setSystemId] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [equipName, setEquipName] = useState("");
  const [equipSerial, setEquipSerial] = useState("");
  const [equipCategory, setEquipCategory] = useState("camera");
  const [equipLocation, setEquipLocation] = useState("");

  const filtered = useMemo(
    () =>
      filterSiteAssets(equipment, {
        q,
        status: status || undefined,
        category: category || undefined,
        systemId: systemId || undefined,
      }),
    [equipment, q, status, category, systemId],
  );

  return (
    <section className="site-assets-panel ops-panel space-y-4 p-5" data-testid="site-assets-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.siteAssetsKicker}</p>
          <h2 className="mt-1 text-base font-semibold text-fg">{he.siteTabAssets}</h2>
          <p className="mt-1 text-xs text-fg-muted">{he.siteAssetsLead}</p>
        </div>
        {canEdit ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowAdd((v) => !v)}
            data-testid="site-assets-add-toggle"
          >
            {he.equipmentAdd}
          </Button>
        ) : null}
      </div>

      {canEdit && showAdd && onAdd ? (
        <form
          className="grid gap-2 border-b border-border pb-4 sm:grid-cols-2"
          data-testid="site-assets-add-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!equipName.trim()) return;
            onAdd({
              name: equipName.trim(),
              category: equipCategory,
              serial: equipSerial.trim() || undefined,
              location_note: equipLocation.trim() || undefined,
            });
            setEquipName("");
            setEquipSerial("");
            setEquipLocation("");
            setShowAdd(false);
          }}
        >
          <Input
            id="asset-add-name"
            label={he.equipmentName}
            value={equipName}
            onChange={(e) => setEquipName(e.target.value)}
          />
          <Input
            id="asset-add-serial"
            label={he.equipmentSerial}
            value={equipSerial}
            onChange={(e) => setEquipSerial(e.target.value)}
          />
          <Select
            id="asset-add-category"
            label={he.equipmentCategory}
            value={equipCategory}
            onChange={(e) => setEquipCategory(e.target.value)}
          >
            {ASSET_CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {equipmentCategoryLabel(c)}
              </option>
            ))}
          </Select>
          <Input
            id="asset-add-location"
            label={he.equipmentLocation}
            value={equipLocation}
            onChange={(e) => setEquipLocation(e.target.value)}
            placeholder={he.equipmentLocationHint}
          />
          <div className="sm:col-span-2">
            <Button type="submit" loading={addPending} className="min-h-11">
              {he.equipmentAdd}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="site-assets-filters">
        <Input
          id="asset-search"
          label={he.siteAssetsSearch}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={he.siteAssetsSearchHint}
        />
        <Select
          id="asset-filter-status"
          label={he.status}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{he.siteAssetsFilterAll}</option>
          {ASSET_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {equipmentStatusLabel(s)}
            </option>
          ))}
        </Select>
        <Select
          id="asset-filter-category"
          label={he.equipmentCategory}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">{he.siteAssetsFilterAll}</option>
          {ASSET_CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {equipmentCategoryLabel(c)}
            </option>
          ))}
        </Select>
        <Select
          id="asset-filter-system"
          label={he.siteTabSystems}
          value={systemId}
          onChange={(e) => setSystemId(e.target.value)}
        >
          <option value="">{he.siteAssetsFilterAll}</option>
          <option value="__none__">{he.siteAssetsNoSystem}</option>
          {systems.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      {!equipment.length ? (
        <div className="border border-border px-4 py-6" data-testid="site-assets-empty">
          <p className="text-sm font-medium text-fg">{he.siteAssetsEmptyTitle}</p>
          <p className="mt-1 text-sm text-fg-muted">{he.siteAssetsEmptyBody}</p>
        </div>
      ) : !filtered.length ? (
        <div className="border border-border px-4 py-6" data-testid="site-assets-no-matches">
          <p className="text-sm text-fg-muted">{he.siteAssetsNoMatches}</p>
        </div>
      ) : (
        <>
          {/* Desktop dense list */}
          <div className="site-assets-table-wrap hidden md:block" data-testid="site-assets-table">
            <table className="site-assets-table w-full text-sm">
              <thead>
                <tr className="border-b border-border text-start text-xs text-fg-muted">
                  <th className="py-2 pe-3 font-medium">{he.equipmentAssetCode}</th>
                  <th className="py-2 pe-3 font-medium">{he.equipmentName}</th>
                  <th className="py-2 pe-3 font-medium">{he.equipmentCategory}</th>
                  <th className="py-2 pe-3 font-medium">{he.siteAssetsMfrModel}</th>
                  <th className="py-2 pe-3 font-medium">{he.equipmentSerial}</th>
                  <th className="py-2 pe-3 font-medium">{he.status}</th>
                  <th className="py-2 pe-3 font-medium">{he.siteTabSystems}</th>
                  <th className="py-2 pe-3 font-medium">IP</th>
                  <th className="py-2 font-medium">{he.equipmentInstalled}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const sys = systemName(systems, row.system_id);
                  const mm = manufacturerModel(row);
                  return (
                    <tr key={row.id} className="border-b border-border/80 hover:bg-bg-subtle">
                      <td className="py-2.5 pe-3">
                        <Link
                          to="/app/sites/$siteId/assets/$assetId"
                          params={{ siteId, assetId: row.id }}
                          className="block min-w-0"
                          data-testid={`site-asset-row-${row.id}`}
                        >
                          {row.asset_code ? (
                            <span className="public-mono text-xs text-fg-muted" dir="ltr">
                              {row.asset_code}
                            </span>
                          ) : (
                            <span className="text-xs text-fg-muted">—</span>
                          )}
                        </Link>
                      </td>
                      <td className="py-2.5 pe-3">
                        <Link
                          to="/app/sites/$siteId/assets/$assetId"
                          params={{ siteId, assetId: row.id }}
                          className="font-medium text-fg hover:underline"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="py-2.5 pe-3 text-fg-muted">{equipmentCategoryLabel(row.category)}</td>
                      <td className="py-2.5 pe-3 text-fg-muted">{mm || "—"}</td>
                      <td className="py-2.5 pe-3">
                        <span className="public-mono text-xs" dir="ltr">
                          {row.serial || "—"}
                        </span>
                      </td>
                      <td className="py-2.5 pe-3">
                        <Status
                          label={equipmentStatusLabel(row.status)}
                          tone={equipmentStatusTone(row.status)}
                        />
                      </td>
                      <td className="py-2.5 pe-3 text-fg-muted">{sys || "—"}</td>
                      <td className="py-2.5 pe-3">
                        <span className="public-mono text-xs" dir="ltr">
                          {row.ip || "—"}
                        </span>
                      </td>
                      <td className="py-2.5 text-fg-muted">{formatAssetDate(row.installed_at) || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="site-assets-cards space-y-2 md:hidden" data-testid="site-assets-cards">
            {filtered.map((row) => {
              const sys = systemName(systems, row.system_id);
              const mm = manufacturerModel(row);
              return (
                <li key={row.id}>
                  <Link
                    to="/app/sites/$siteId/assets/$assetId"
                    params={{ siteId, assetId: row.id }}
                    className="block rounded-md border border-border bg-bg px-3 py-3 min-h-11"
                    data-testid={`site-asset-card-${row.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {row.asset_code ? (
                          <p className="public-mono text-[11px] text-fg-muted" dir="ltr">
                            {row.asset_code}
                          </p>
                        ) : null}
                        <p className="truncate text-sm font-semibold text-fg">{row.name}</p>
                        <p className="mt-0.5 text-xs text-fg-muted">
                          {[equipmentCategoryLabel(row.category), mm, row.serial].filter(Boolean).join(" · ") ||
                            "—"}
                        </p>
                        {sys || row.ip ? (
                          <p className="mt-1 text-xs text-fg-muted">
                            {[sys, row.ip ? `IP ${row.ip}` : null].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                      </div>
                      <Status
                        label={equipmentStatusLabel(row.status)}
                        tone={equipmentStatusTone(row.status)}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
