/**
 * C0 — domain definition registry for System Builder.
 *
 * Shared definition (questions, order, roles, catalog mapping, line templates,
 * language copy) lives here. Engineering formulas stay in a verified per-domain
 * module. Domains without a verified module stay hidden.
 *
 * CCTV remains the only production engine. Do not invent Alarm/Access math.
 *
 * Docs gap (intentional, PO-approved): QUOTE-BUILDER-UNIFIED-PRODUCT-ARCHITECTURE
 * and SYSTEM-DESIGN-ENGINE-PLATFORM-DISCOVERY treat System Builder as engine-only
 * and defer a registry. This registry adds «בנייה חופשית» as a non-engine domain
 * and allows several domains on one quote. See domain-docs-gap.ts.
 */

export type DomainStatus = "production" | "hidden" | "research";
export type DomainKind = "engine" | "free_compose";

export type DomainDefinition = {
  key: string;
  kind: DomainKind;
  status: DomainStatus;
  wizard: boolean;
  hasVerifiedEngineeringModule: boolean;
  engineeringModule: string | null;
  i18nKey: "domainFreeBuild" | "systemTypes.cctv" | "systemTypes.alarm" | "systemTypes.access" | "systemTypes.network" | "systemTypes.intercom" | "domainLowVoltage" | "domainCombined";
  questions: readonly string[];
  questionOrder: readonly string[];
  roles: readonly string[];
  catalogMapping: Readonly<Record<string, string>>;
  lineTemplates: readonly { role: string; itemType: "catalog" | "free" | "labor" }[];
};

export const DOMAIN_REGISTRY: readonly DomainDefinition[] = [
  {
    key: "free_build",
    kind: "free_compose",
    status: "production",
    wizard: false,
    hasVerifiedEngineeringModule: false,
    engineeringModule: null,
    i18nKey: "domainFreeBuild",
    questions: [],
    questionOrder: [],
    roles: [],
    catalogMapping: {},
    lineTemplates: [{ role: "custom", itemType: "free" }],
  },
  {
    key: "cctv",
    kind: "engine",
    status: "production",
    wizard: true,
    hasVerifiedEngineeringModule: true,
    engineeringModule: "cctv_sizing+cctv_recommend",
    i18nKey: "systemTypes.cctv",
    questions: ["cameraCount", "environment", "retentionDays", "poe", "installation"],
    questionOrder: ["cameraCount", "environment", "retentionDays", "poe", "installation"],
    roles: ["camera", "recorder", "storage", "poe_switch", "cable", "camera_install"],
    catalogMapping: {
      camera: "cctv.camera",
      recorder: "cctv.recorder",
      storage: "cctv.storage",
      poe_switch: "cctv.switch",
    },
    lineTemplates: [
      { role: "camera", itemType: "catalog" },
      { role: "camera_install", itemType: "labor" },
    ],
  },
  {
    key: "alarm",
    kind: "engine",
    status: "hidden",
    wizard: true,
    hasVerifiedEngineeringModule: false,
    engineeringModule: null,
    i18nKey: "systemTypes.alarm",
    questions: [],
    questionOrder: [],
    roles: [],
    catalogMapping: {},
    lineTemplates: [],
  },
  {
    key: "access_control",
    kind: "engine",
    status: "hidden",
    wizard: true,
    hasVerifiedEngineeringModule: false,
    engineeringModule: null,
    i18nKey: "systemTypes.access",
    questions: [],
    questionOrder: [],
    roles: [],
    catalogMapping: {},
    lineTemplates: [],
  },
  {
    key: "intercom",
    kind: "engine",
    status: "hidden",
    wizard: true,
    hasVerifiedEngineeringModule: false,
    engineeringModule: null,
    i18nKey: "systemTypes.intercom",
    questions: [],
    questionOrder: [],
    roles: [],
    catalogMapping: {},
    lineTemplates: [],
  },
  {
    key: "network",
    kind: "engine",
    status: "hidden",
    wizard: true,
    hasVerifiedEngineeringModule: false,
    engineeringModule: null,
    i18nKey: "systemTypes.network",
    questions: [],
    questionOrder: [],
    roles: [],
    catalogMapping: {},
    lineTemplates: [],
  },
  {
    key: "low_voltage",
    kind: "engine",
    status: "hidden",
    wizard: true,
    hasVerifiedEngineeringModule: false,
    engineeringModule: null,
    i18nKey: "domainLowVoltage",
    questions: [],
    questionOrder: [],
    roles: [],
    catalogMapping: {},
    lineTemplates: [],
  },
  {
    key: "combined",
    kind: "engine",
    status: "hidden",
    wizard: true,
    hasVerifiedEngineeringModule: false,
    engineeringModule: null,
    i18nKey: "domainCombined",
    questions: [],
    questionOrder: [],
    roles: [],
    catalogMapping: {},
    lineTemplates: [],
  },
];

export function getDomain(key: string): DomainDefinition | undefined {
  return DOMAIN_REGISTRY.find((row) => row.key === key);
}

/** Picker entries: free-build always, plus engines with a verified module. */
export function visibleDomains(): DomainDefinition[] {
  return DOMAIN_REGISTRY.filter(
    (row) =>
      row.status === "production" &&
      (row.kind === "free_compose" || row.hasVerifiedEngineeringModule),
  );
}

export function isDomainVisible(key: string): boolean {
  return visibleDomains().some((row) => row.key === key);
}

export function supportsMultipleDomainsOnQuote(): boolean {
  return true;
}

export function domainLabel(key: string, he: { domainFreeBuild: string; domainLowVoltage: string; domainCombined: string; systemTypes: Record<string, string> }): string {
  if (key === "free_build") return he.domainFreeBuild;
  if (key === "low_voltage") return he.domainLowVoltage;
  if (key === "combined") return he.domainCombined;
  if (key === "access_control") return he.systemTypes.access;
  return he.systemTypes[key] ?? key;
}

export function domainsOnQuote(input: {
  engineTypes?: Array<string | null | undefined>;
  hasManualOrCatalogLines?: boolean;
}): string[] {
  const keys = new Set<string>();
  for (const raw of input.engineTypes ?? []) {
    const key = String(raw || "").trim();
    if (key) keys.add(key);
  }
  if (input.hasManualOrCatalogLines) keys.add("free_build");
  return [...keys];
}
