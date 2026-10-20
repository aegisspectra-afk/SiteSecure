import type { FleetMaintenanceStatus, FleetVehicleOut, FleetVehicleStatus } from "@site-secure/api-client";
import type { StatusTone } from "@site-secure/ui";
import { he } from "../../i18n/he";

export function fleetVehicleStatusLabel(status: string): string {
  return he.fleetVehicleStatuses[status as keyof typeof he.fleetVehicleStatuses] ?? status;
}

export function fleetVehicleStatusTone(status: string): StatusTone {
  switch (status as FleetVehicleStatus) {
    case "active":
      return "success";
    case "maintenance":
      return "warning";
    case "temporarily_inactive":
      return "info";
    case "inactive":
      return "neutral";
    case "sold":
      return "neutral";
    default:
      return "neutral";
  }
}

export function fleetMaintenanceStatusLabel(status: string): string {
  return he.fleetMaintenanceStatuses[status as keyof typeof he.fleetMaintenanceStatuses] ?? status;
}

export function fleetMaintenanceStatusTone(status: string): StatusTone {
  switch (status as FleetMaintenanceStatus) {
    case "due":
      return "danger";
    case "soon":
      return "warning";
    case "normal":
    default:
      return "success";
  }
}

export function computeMaintenanceStatus(vehicle: Pick<
  FleetVehicleOut,
  "current_mileage" | "next_service_mileage" | "maintenance_soon_km" | "maintenance_status"
>): FleetMaintenanceStatus {
  if (vehicle.maintenance_status) return vehicle.maintenance_status;
  if (vehicle.next_service_mileage == null) return "normal";
  const remaining = vehicle.next_service_mileage - (vehicle.current_mileage ?? 0);
  if (remaining <= 0) return "due";
  const soon = vehicle.maintenance_soon_km ?? 1000;
  if (remaining <= soon) return "soon";
  return "normal";
}

export function expiryTone(dateStr: string | null | undefined, withinDays = 30): StatusTone {
  if (!dateStr) return "neutral";
  const end = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(end.getTime())) return "neutral";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return "danger";
  if (diff <= withinDays) return "warning";
  return "success";
}

export function expiryLabel(dateStr: string | null | undefined, withinDays = 30): string {
  if (!dateStr) return he.fleetExpiryNone;
  const end = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(end.getTime())) return dateStr;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return he.fleetExpiryExpired;
  if (diff <= withinDays) return he.fleetExpirySoon;
  return he.fleetExpiryOk;
}

export function vehicleTitle(vehicle: Pick<FleetVehicleOut, "license_plate" | "manufacturer" | "model">): string {
  const parts = [vehicle.manufacturer, vehicle.model].filter(Boolean);
  return parts.length ? `${vehicle.license_plate} · ${parts.join(" ")}` : vehicle.license_plate;
}

export function formatKm(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toLocaleString("he-IL")} ${he.fleetKmUnit}`;
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  const keys = Array.from(
    rows.reduce((acc, row) => {
      Object.keys(row).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>()),
  );
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [keys.join(","), ...rows.map((row) => keys.map((k) => escape(row[k])).join(","))];
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const FLEET_REPORT_KEYS = [
  "vehicles",
  "by_department",
  "mileage",
  "maintenance",
  "expiring_tests",
  "expiring_insurance",
  "assignments",
  "overview",
] as const;

export type FleetReportKey = (typeof FLEET_REPORT_KEYS)[number];
