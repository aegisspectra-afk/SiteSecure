import type { WarrantyOut } from "@site-secure/api-client";
import type { StatusTone } from "@site-secure/ui";
import { he } from "../i18n/he";

export const WARRANTY_STATUSES = ["draft", "active", "expiring_soon", "expired", "cancelled"] as const;
export const WARRANTY_TYPES = ["manufacturer", "installation", "extended", "maintenance_contract"] as const;

export type WarrantyStatus = (typeof WARRANTY_STATUSES)[number];
export type WarrantyType = (typeof WARRANTY_TYPES)[number];

export function warrantyStatusLabel(status: string): string {
  return he.warrantyStatuses[status as WarrantyStatus] ?? status;
}

export function warrantyStatusTone(status: string): StatusTone {
  switch (status) {
    case "active":
      return "success";
    case "expiring_soon":
      return "warning";
    case "expired":
      return "danger";
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

export function warrantyTypeLabel(type: string): string {
  return he.warrantyTypes[type as WarrantyType] ?? type;
}

export function warrantyRowTitle(row: WarrantyOut): string {
  if (row.title) return `${row.number} · ${row.title}`;
  const product = [row.equipment_manufacturer, row.equipment_model, row.equipment_name]
    .filter(Boolean)
    .join(" · ");
  if (product) return `${row.number} · ${product}`;
  return row.number;
}

export function warrantyRowMeta(row: WarrantyOut): string {
  const parts = [
    row.customer_name,
    row.site_name,
    row.equipment_serial ? `${he.equipmentSerial}: ${row.equipment_serial}` : null,
    `${row.starts_on} → ${row.ends_on}`,
  ].filter(Boolean);
  return parts.join(" · ");
}

/** Local filter over fields already loaded from list/create — API has no q= search. */
export function filterWarrantiesLocal(rows: WarrantyOut[], query: string): WarrantyOut[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    const haystack = [
      row.number,
      row.title,
      row.customer_name,
      row.site_name,
      typeof row.policy?.subject_label === "string" ? row.policy.subject_label : null,
      row.equipment_name,
      row.equipment_manufacturer,
      row.equipment_model,
      row.equipment_serial,
      row.type,
      row.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function equipmentOptionLabel(row: {
  name: string;
  manufacturer?: string | null;
  model?: string | null;
  serial?: string | null;
}): string {
  const product = [row.manufacturer, row.model].filter(Boolean).join(" ");
  const serial = row.serial ? ` · ${row.serial}` : "";
  if (product) return `${row.name} — ${product}${serial}`;
  return `${row.name}${serial}`;
}
