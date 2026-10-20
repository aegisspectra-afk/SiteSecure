import type { FleetMaintenanceStatus, FleetVehicleStatus } from "@site-secure/api-client";
import { Status } from "@site-secure/ui";
import {
  expiryLabel,
  expiryTone,
  fleetMaintenanceStatusLabel,
  fleetMaintenanceStatusTone,
  fleetVehicleStatusLabel,
  fleetVehicleStatusTone,
} from "./fleet-labels";

export function FleetStatusBadge({ status }: { status: FleetVehicleStatus | string }) {
  return <Status label={fleetVehicleStatusLabel(status)} tone={fleetVehicleStatusTone(status)} />;
}

export function FleetMaintenanceBadge({ status }: { status: FleetMaintenanceStatus | string }) {
  return (
    <Status label={fleetMaintenanceStatusLabel(status)} tone={fleetMaintenanceStatusTone(status)} />
  );
}

export function FleetExpiryBadge({
  date,
  withinDays = 30,
}: {
  date: string | null | undefined;
  withinDays?: number;
}) {
  return <Status label={expiryLabel(date, withinDays)} tone={expiryTone(date, withinDays)} />;
}
