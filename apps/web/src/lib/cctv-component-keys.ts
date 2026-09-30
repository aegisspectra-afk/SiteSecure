/**
 * SYSTEM-DESIGNER-1A — stable DesignComponent identity + commercial labels.
 * Selection / planned package_name / Design role_key use component_key — never role-only maps.
 */

export const CCTV_COMPONENT_KEYS = {
  cameraIp: "camera_ip_main",
  cameraAnalog: "camera_analog_main",
  recorder: "recorder_main",
  storage: "storage_main",
  poeSwitch: "poe_switch_main",
  networkSwitch: "network_switch_main",
  cableIp: "cable_ip_main",
  cableAnalog: "cable_analog_main",
  powerSupply: "power_supply_main",
  ups: "ups_main",
  installationCamera: "installation_camera",
  recorderSetup: "recorder_setup_main",
  remoteViewing: "remote_viewing_main",
  testing: "testing_main",
  commissioning: "commissioning_main",
} as const;

export type CctvComponentKey = (typeof CCTV_COMPONENT_KEYS)[keyof typeof CCTV_COMPONENT_KEYS];

const KNOWN_KEYS = new Set<string>(Object.values(CCTV_COMPONENT_KEYS));

/** Legacy recommend `role` → stable component_key (pre–Slice B engine). */
const LEGACY_ROLE_TO_KEY: Record<string, string> = {
  camera: CCTV_COMPONENT_KEYS.cameraIp,
  recorder: CCTV_COMPONENT_KEYS.recorder,
  storage: CCTV_COMPONENT_KEYS.storage,
  poe_switch: CCTV_COMPONENT_KEYS.poeSwitch,
  cable: CCTV_COMPONENT_KEYS.cableIp,
  camera_install: CCTV_COMPONENT_KEYS.installationCamera,
  recorder_setup: CCTV_COMPONENT_KEYS.recorderSetup,
  remote_viewing_setup: CCTV_COMPONENT_KEYS.remoteViewing,
  remote_setup: CCTV_COMPONENT_KEYS.remoteViewing,
  testing: CCTV_COMPONENT_KEYS.testing,
  commissioning: CCTV_COMPONENT_KEYS.commissioning,
  ups: CCTV_COMPONENT_KEYS.ups,
};

/** Semantic role used for grouping / engine metadata. */
const KEY_TO_SEMANTIC_ROLE: Record<string, string> = {
  [CCTV_COMPONENT_KEYS.cameraIp]: "camera",
  [CCTV_COMPONENT_KEYS.cameraAnalog]: "camera",
  [CCTV_COMPONENT_KEYS.recorder]: "recorder",
  [CCTV_COMPONENT_KEYS.storage]: "storage",
  [CCTV_COMPONENT_KEYS.poeSwitch]: "poe_switch",
  [CCTV_COMPONENT_KEYS.networkSwitch]: "network_switch",
  [CCTV_COMPONENT_KEYS.cableIp]: "cable",
  [CCTV_COMPONENT_KEYS.cableAnalog]: "cable",
  [CCTV_COMPONENT_KEYS.powerSupply]: "power_supply",
  [CCTV_COMPONENT_KEYS.ups]: "ups",
  [CCTV_COMPONENT_KEYS.installationCamera]: "camera_install",
  [CCTV_COMPONENT_KEYS.recorderSetup]: "recorder_setup",
  [CCTV_COMPONENT_KEYS.remoteViewing]: "remote_viewing_setup",
  [CCTV_COMPONENT_KEYS.testing]: "testing",
  [CCTV_COMPONENT_KEYS.commissioning]: "commissioning",
};

export function isKnownComponentKey(value: string): boolean {
  return KNOWN_KEYS.has(value);
}

/** Normalize any persisted role_key / legacy role / explicit key → stable component_key. */
export function normalizeComponentKey(raw: string): string {
  const key = String(raw || "").trim();
  if (!key) return key;
  if (KNOWN_KEYS.has(key)) return key;
  if (LEGACY_ROLE_TO_KEY[key]) return LEGACY_ROLE_TO_KEY[key]!;
  return key;
}

export function semanticRoleOf(componentKey: string): string {
  const key = normalizeComponentKey(componentKey);
  return KEY_TO_SEMANTIC_ROLE[key] ?? key;
}

export type ComponentKeySource = {
  component_key?: string | null;
  role: string;
  technical_requirements?: Record<string, unknown> | null;
};

/** Resolve stable identity for a recommendation / design component. Never returns empty when role exists. */
export function componentKeyOf(component: ComponentKeySource): string {
  const explicit = component.component_key?.trim();
  if (explicit) return normalizeComponentKey(explicit);
  const tech = component.technical_requirements ?? {};
  const fromTech = tech.component_key;
  if (typeof fromTech === "string" && fromTech.trim()) {
    return normalizeComponentKey(fromTech.trim());
  }
  return normalizeComponentKey(component.role);
}

/**
 * Customer-facing commercial name for quote lines and review cards.
 * Technology-aware labels where the key encodes IP vs analog.
 */
export function commercialLabelHe(
  componentKey: string,
  opts?: { technology?: "ip" | "analog_hd" | "hybrid" | "" | null },
): string {
  const key = normalizeComponentKey(componentKey);
  switch (key) {
    case CCTV_COMPONENT_KEYS.cameraIp:
      return "מצלמת IP";
    case CCTV_COMPONENT_KEYS.cameraAnalog:
      return "מצלמה אנלוגית";
    case CCTV_COMPONENT_KEYS.recorder: {
      const tech = opts?.technology;
      if (tech === "analog_hd") return "DVR";
      if (tech === "hybrid") return "XVR";
      return "NVR";
    }
    case CCTV_COMPONENT_KEYS.storage:
      return "כונן HDD";
    case CCTV_COMPONENT_KEYS.poeSwitch:
      return "מתג PoE";
    case CCTV_COMPONENT_KEYS.networkSwitch:
      return "מתג רשת";
    case CCTV_COMPONENT_KEYS.cableIp:
      return "כבל CAT6";
    case CCTV_COMPONENT_KEYS.cableAnalog:
      return "כבל RG59";
    case CCTV_COMPONENT_KEYS.powerSupply:
      return "ספק כוח";
    case CCTV_COMPONENT_KEYS.ups:
      return "UPS";
    case CCTV_COMPONENT_KEYS.installationCamera:
      return "התקנת מצלמות";
    case CCTV_COMPONENT_KEYS.recorderSetup:
      return "הגדרת מקליט";
    case CCTV_COMPONENT_KEYS.remoteViewing:
      return "צפייה מרחוק";
    case CCTV_COMPONENT_KEYS.testing:
      return "בדיקות";
    case CCTV_COMPONENT_KEYS.commissioning:
      return "בדיקות והפעלה";
    default:
      return key;
  }
}

export function plannedPackageNameFor(componentKey: string): string {
  return `cctv-planned:${normalizeComponentKey(componentKey)}`;
}

export function componentKeyFromPlannedPackage(packageName: string | null | undefined): string | null {
  const pkg = String(packageName || "");
  const prefix = "cctv-planned:";
  if (!pkg.startsWith(prefix)) return null;
  const key = pkg.slice(prefix.length).trim();
  return key ? normalizeComponentKey(key) : null;
}
