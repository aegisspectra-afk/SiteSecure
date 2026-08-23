import type { LeadRequirements } from "@site-secure/api-client";
import type { LeadServiceType } from "./leads";

export type NewLeadCustomerMode = "none" | "existing" | "new";
export type NewLeadSiteMode = "unknown" | "existing" | "new";

export type CctvRequirementDraft = {
  cameraCount: string;
  location: "" | "indoor" | "outdoor" | "both";
  infrastructure: "" | "existing" | "partial" | "new";
  recording: boolean;
  remoteViewing: boolean;
};

export type AlarmRequirementDraft = {
  systemType: string;
  zoneCount: string;
  detectors: string;
  magnets: boolean;
  siren: boolean;
  app: boolean;
};

export function canSaveNewLead(opts: {
  customerMode: NewLeadCustomerMode;
  customerId: string;
  contactName: string;
  newCustomerName: string;
}): boolean {
  if (opts.customerMode === "existing") return Boolean(opts.customerId.trim());
  if (opts.customerMode === "new") {
    return Boolean(opts.newCustomerName.trim() || opts.contactName.trim());
  }
  return Boolean(opts.contactName.trim());
}

export function locationLabel(value: string): string {
  if (value === "indoor") return "פנים";
  if (value === "outdoor") return "חוץ";
  if (value === "both") return "פנים + חוץ";
  return value;
}

export function infrastructureLabel(value: string): string {
  if (value === "existing") return "קיימת";
  if (value === "partial") return "חלקית";
  if (value === "new") return "חדשה";
  return value;
}

export function buildLeadRequirements(
  serviceType: LeadServiceType,
  cctv: CctvRequirementDraft,
  alarm: AlarmRequirementDraft,
): LeadRequirements | undefined {
  if (serviceType === "cctv") {
    const payload: LeadRequirements = {
      camera_count: cctv.cameraCount.trim() ? Number(cctv.cameraCount) : undefined,
      location: cctv.location ? locationLabel(cctv.location) : undefined,
      infrastructure: cctv.infrastructure ? infrastructureLabel(cctv.infrastructure) : undefined,
      recording: cctv.recording,
      remote_viewing: cctv.remoteViewing,
    };
    return payload;
  }

  if (serviceType === "alarm") {
    return {
      system_type: alarm.systemType.trim() || undefined,
      zone_count: alarm.zoneCount.trim() ? Number(alarm.zoneCount) : undefined,
      detectors: alarm.detectors.trim() || undefined,
      magnets: alarm.magnets,
      siren: alarm.siren,
      app: alarm.app,
    };
  }

  return undefined;
}

/** Changing opportunity fields must not clear customer_id. */
export function customerIdAfterFieldChange(customerId: string, _field: string): string {
  return customerId;
}
