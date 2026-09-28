import type { EquipmentOut, SystemOut, WarrantyOut } from "@site-secure/api-client";
import { he } from "../i18n/he";

export function equipmentStatusLabel(status: string): string {
  return he.equipmentStatuses[status as keyof typeof he.equipmentStatuses] ?? status;
}

export function equipmentCategoryLabel(category: string): string {
  return he.equipmentCategories[category as keyof typeof he.equipmentCategories] ?? category;
}

export function equipmentStatusTone(
  status: string | null | undefined,
): "success" | "warning" | "neutral" | "danger" {
  if (!status) return "neutral";
  if (status === "installed") return "success";
  if (status === "planned" || status === "replaced") return "warning";
  if (status === "removed") return "danger";
  return "neutral";
}

export function formatAssetDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("he-IL");
}

export function manufacturerModel(row: Pick<EquipmentOut, "manufacturer" | "model">): string | null {
  const parts = [row.manufacturer, row.model].map((v) => (v || "").trim()).filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function filterSiteAssets(
  items: EquipmentOut[],
  opts: {
    q?: string;
    status?: string;
    category?: string;
    systemId?: string;
  },
): EquipmentOut[] {
  const q = (opts.q || "").trim().toLowerCase();
  return items.filter((row) => {
    if (opts.status && row.status !== opts.status) return false;
    if (opts.category && row.category !== opts.category) return false;
    if (opts.systemId === "__none__") {
      if (row.system_id) return false;
    } else if (opts.systemId && row.system_id !== opts.systemId) {
      return false;
    }
    if (!q) return true;
    const hay = [
      row.asset_code,
      row.name,
      row.serial,
      row.manufacturer,
      row.model,
      row.ip,
      row.mac,
      row.location_note,
    ]
      .map((v) => (v || "").toLowerCase())
      .join(" ");
    return hay.includes(q);
  });
}

export function warrantyForAsset(
  warranties: WarrantyOut[],
  assetId: string,
): WarrantyOut | null {
  const linked = warranties.filter((w) => w.equipment_id === assetId);
  if (!linked.length) return null;
  const preferred =
    linked.find((w) => w.status === "active" || w.status === "issued" || w.status === "expiring_soon") ??
    linked[0];
  return preferred ?? null;
}

export function systemName(
  systems: SystemOut[],
  systemId: string | null | undefined,
): string | null {
  if (!systemId) return null;
  return systems.find((s) => s.id === systemId)?.name ?? null;
}

/** Prefer operational statuses in selectors; keep planned for legacy. */
export const ASSET_STATUS_OPTIONS = ["installed", "replaced", "removed", "planned"] as const;

export const ASSET_CATEGORY_OPTIONS = [
  "camera",
  "nvr",
  "dvr",
  "switch",
  "panel",
  "reader",
  "lock",
  "pir",
  "power",
  "cable",
  "sim",
  "other",
] as const;
