import { describe, expect, it } from "vitest";
import { planAllowsCustomRbac } from "@site-secure/authz";
import { he } from "../src/i18n/he";
import { appNav, TARGET_IA } from "../src/lib/app-nav";
import { can, canAny } from "../src/lib/can";
import {
  prefsFromSettings,
  prefsToSettingsPatch,
  DEFAULT_WORKSPACE_PREFS,
} from "../src/lib/workspace-prefs";
import {
  RBAC_ACTIONS,
  RBAC_MODULES,
  RBAC_PERMISSION_MAP,
  buildGrantMatrixFromCatalog,
} from "../src/lib/settings-rbac-demo";

const FULL_FEATURES = [
  "core",
  "crm",
  "sales",
  "catalog",
  "quotes",
  "projects",
  "service",
  "settings",
  "team",
  "audit",
];

describe("settings production nav", () => {
  it("keeps Team/RBAC/Security out of the sidebar", () => {
    const paths = appNav("owner", FULL_FEATURES).flatMap((g) => g.items.map((i) => i.to));
    expect(paths).toContain("/app/settings");
    expect(paths).not.toContain("/app/settings/users");
    expect(paths).not.toContain("/app/settings/roles");
    expect(paths).not.toContain("/app/settings/security");
    expect(TARGET_IA.map((g) => g.id)).toEqual(["overview", "sales", "ops", "system"]);
  });

  it("covers required Hebrew settings sections and groups", () => {
    expect(he.settingsTitle).toBe("הגדרות");
    expect(he.settingsLead).toContain("סביבת עבודה");
    expect(he.settingsNavGroupProfile).toBe("פרופיל וחשבון");
    expect(he.settingsNavGroupWorkspace).toBe("סביבת עבודה");
    expect(he.settingsNavGroupCommercial).toBe("מסחרי");
    expect(he.settingsNavGroupOperations).toBe("תפעול");
    expect(he.settingsNavGroupTeam).toBe("צוות וגישה");
    expect(he.settingsNavGroupAdvanced).toBe("מתקדם");
    expect(he.settingsNavProfile).toBe("פרופיל אישי");
    expect(he.settingsEditProfile).toBe("עריכת פרופיל");
    expect(he.settingsNavGeneral).toBeTruthy();
    expect(he.settingsNavCompany).toBe("פרטי חברה ומיתוג");
    expect(he.settingsNavSystem).toBe("הגדרות מערכת");
    expect(he.settingsNavPdf).toBe("תבניות מסמכים");
    expect(he.pdfTemplatesTitle).toBe("תבניות מסמכים");
    expect(he.pdfTemplatesLead).toContain("PDF");
    expect(he.settingsNavRoles).toBe("תפקידים והרשאות");
    expect(he.navUsers).toBe("צוות");
    expect(he.navSecurity).toBe("אבטחה");
    expect(he.securityTitle).toBe("אבטחה");
    expect(he.accountAvatarStyleA).toBeTruthy();
    expect(he.accountAvatarStyleB).toBeTruthy();
    expect(he.settingsQuotesApplyHint).toBeTruthy();
    expect(he.settingsNumberingExampleHint).toBeTruthy();
  });
});

describe("settings role-aware access", () => {
  it("owner/admin can edit workspace settings", () => {
    expect(can("owner", "workspace.edit", FULL_FEATURES)).toBe(true);
    expect(can("administrator", "workspace.edit", FULL_FEATURES)).toBe(true);
    expect(can("owner", "users.view", FULL_FEATURES)).toBe(true);
    expect(can("owner", "roles.manage", FULL_FEATURES)).toBe(true);
  });

  it("manager sees team/security, not workspace.edit", () => {
    expect(can("manager", "workspace.edit", FULL_FEATURES)).toBe(false);
    expect(can("manager", "users.view", FULL_FEATURES)).toBe(true);
    expect(can("manager", "settings.general", FULL_FEATURES)).toBe(true);
    expect(canAny("manager", ["settings.general", "workspace.edit"], FULL_FEATURES)).toBe(true);
    expect(can("manager", "roles.manage", FULL_FEATURES)).toBe(false);
  });

  it("sales/technician/viewer do not get settings management surfaces", () => {
    for (const role of ["sales", "technician", "viewer"] as const) {
      expect(can(role, "workspace.edit", FULL_FEATURES)).toBe(false);
      expect(can(role, "users.view", FULL_FEATURES)).toBe(false);
      expect(can(role, "settings.general", FULL_FEATURES)).toBe(false);
      expect(can(role, "roles.manage", FULL_FEATURES)).toBe(false);
      expect(can(role, "audit.view", FULL_FEATURES)).toBe(false);
    }
  });

  it("sales/technician/viewer get personal Appearance via settings.view", () => {
    for (const role of ["sales", "technician", "viewer"] as const) {
      expect(can(role, "settings.view", FULL_FEATURES)).toBe(true);
    }
  });

  it("security remains settings.general / workspace.edit — not broadened to sales", () => {
    expect(can("sales", "settings.general", FULL_FEATURES)).toBe(false);
    expect(canAny("manager", ["settings.general", "workspace.edit"], FULL_FEATURES)).toBe(true);
  });
});

describe("RBAC plan gating", () => {
  it("maps FREE/solo vs PRO+/business for custom RBAC", () => {
    expect(planAllowsCustomRbac("solo")).toBe(false);
    expect(planAllowsCustomRbac("business")).toBe(true);
    expect(planAllowsCustomRbac("enterprise")).toBe(true);
  });

  it("roles.manage requires team feature (FREE cannot open matrix)", () => {
    expect(can("owner", "roles.manage", ["core", "settings"])).toBe(false);
    expect(can("owner", "roles.manage", ["core", "settings", "team"])).toBe(true);
    expect(can("sales", "roles.manage", ["core", "settings", "team"])).toBe(false);
  });
});

describe("workspace prefs ↔ settings JSON", () => {
  it("round-trips numbering and quote prefs", () => {
    const prefs = {
      ...DEFAULT_WORKSPACE_PREFS,
      quotePrefix: "QT-",
      quoteValidityDays: 21,
      paymentTerms: "מקדמה 50%",
      siteRequireAddress: true,
    };
    const patch = prefsToSettingsPatch(prefs);
    expect(patch.notifications).toBeUndefined();
    const restored = prefsFromSettings({
      workspace_id: "w1",
      branding: {},
      taxes: {},
      quotes: patch.quotes!,
      localization: patch.localization!,
      notifications: {},
      scheduling: patch.scheduling!,
    });
    expect(restored.quotePrefix).toBe("QT-");
    expect(restored.quoteValidityDays).toBe(21);
    expect(restored.paymentTerms).toBe("מקדמה 50%");
    expect(restored.siteRequireAddress).toBe(true);
    expect(restored.currency).toBe("ILS");
  });

  it("site requirements use explicit-true semantics", () => {
    const restored = prefsFromSettings({
      workspace_id: "w1",
      branding: {},
      taxes: {},
      quotes: {},
      localization: {},
      notifications: {},
      scheduling: { sites: {} },
    });
    expect(restored.siteRequireAddress).toBe(false);
    expect(restored.siteRequireAccessNotes).toBe(false);
  });
});

describe("SETTINGS-3B integrity honesty copy", () => {
  it("marks notifications as future / unavailable", () => {
    expect(he.settingsNotificationsFutureTitle).toContain("עתידיות");
    expect(he.settingsNotificationsFutureBody).toContain("אין כרגע");
  });

  it("does not present unused numbering prefixes as active", () => {
    expect(he.settingsNumberingUnusedTitle).toBeTruthy();
    expect(he.settingsNumberingLead).not.toContain("פרויקטים");
  });

  it("security copy does not claim MFA/session management as active", () => {
    expect(he.securityStatusMfaBody).toContain("אינו זמין");
    expect(he.securityStatusSessionsBody).toContain("אינו זמין");
    expect(he.securityPasswordResetCta).toBeTruthy();
  });

  it("appearance is described as personal device preference", () => {
    expect(he.settingsAppearancePersonalHint).toContain("במכשיר זה");
    expect(he.settingsProfileThemeDeviceHint).toContain("במכשיר זה");
    expect(he.settingsProfilePrefsHeading).toBe("העדפות אישיות");
  });
});

describe("RBAC matrix mapping", () => {
  it("maps modules×actions to catalog permission keys", () => {
    expect(RBAC_PERMISSION_MAP.quotes.approve_send).toEqual(["quotes.send", "quotes.approve"]);
    expect(RBAC_MODULES.length).toBeGreaterThan(5);
    expect(RBAC_ACTIONS).toContain("view");
  });

  it("owner catalog matrix is full-access where mapped", () => {
    const matrix = buildGrantMatrixFromCatalog(["owner"]);
    for (const module of RBAC_MODULES) {
      for (const action of RBAC_ACTIONS) {
        const cell = matrix.owner[module][action];
        if (cell !== null) expect(cell).toBe(true);
      }
    }
  });

  it("honors session permissions over catalog role", () => {
    expect(can("viewer", "quotes.create", ["quotes"], ["quotes.view", "quotes.create"])).toBe(true);
  });
});
