import type { AppNavTo } from "./app-nav";
import { he } from "../i18n/he";

export const SSP_UNIT_LOGIN_PATH = "/app/ssp/unit-codes" as const;
export const SSP_DEVICE_ACTIVATION_PATH = "/app/ssp/sites" as const;

export type SspOfficeCodeMenuItem = {
  id: "unit-login" | "device-activation";
  to: AppNavTo;
  label: string;
};

/** Office row “עוד” code actions: two different codes, two different screens. */
export function sspOfficeCodeMenuItems(): SspOfficeCodeMenuItem[] {
  return [
    { id: "unit-login", to: SSP_UNIT_LOGIN_PATH, label: he.sspUnitCodesTitle },
    { id: "device-activation", to: SSP_DEVICE_ACTIVATION_PATH, label: he.sspQuickIssueCode },
  ];
}

export function sspUnitLoginHintText(): string {
  return he.sspUnitLoginHint;
}
