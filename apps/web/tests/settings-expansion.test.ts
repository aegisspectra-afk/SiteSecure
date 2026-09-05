import { describe, expect, it } from "vitest";
import { planAllowsCustomRbac } from "@site-secure/authz";
import { he } from "../src/i18n/he";
import { appNav, TARGET_IA } from "../src/lib/app-nav";
import { can } from "../src/lib/can";
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

describe("settings production nav", () => {
  it("keeps Team/RBAC/Security out of the sidebar", () => {
    const paths = appNav(
      "owner",
      ["core", "crm", "sales", "catalog", "quotes", "projects", "service", "settings", "team", "audit"],
    ).flatMap((g) => g.items.map((i) => i.to));
    expect(paths).toContain("/app/settings");
    expect(paths).not.toContain("/app/settings/users");
    expect(paths).not.toContain("/app/settings/roles");
    expect(paths).not.toContain("/app/settings/security");
    expect(TARGET_IA.map((g) => g.id)).toEqual(["overview", "sales", "ops", "system"]);
  });

  it("covers required Hebrew settings sections", () => {
    expect(he.settingsNavGeneral).toBeTruthy();
    expect(he.settingsNavCompany).toBe("פרטי חברה ומיתוג");
    expect(he.settingsNavPdf).toBe("תבניות מסמכים");
    expect(he.pdfTemplatesTitle).toBe("תבניות מסמכים");
    expect(he.pdfTemplatePreviewReal).toBeTruthy();
    expect(he.settingsNavRoles).toBe("תפקידים והרשאות");
    expect(he.navUsers).toBeTruthy();
    expect(he.navSecurity).toBeTruthy();
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
    };
    const patch = prefsToSettingsPatch(prefs);
    const restored = prefsFromSettings({
      workspace_id: "w1",
      branding: {},
      taxes: {},
      quotes: patch.quotes!,
      localization: patch.localization!,
      notifications: patch.notifications!,
      scheduling: patch.scheduling!,
    });
    expect(restored.quotePrefix).toBe("QT-");
    expect(restored.quoteValidityDays).toBe(21);
    expect(restored.paymentTerms).toBe("מקדמה 50%");
    expect(restored.currency).toBe("ILS");
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
    expect(can("viewer", "quotes.create", ["quotes"], ["quotes.view"])).toBe(false);
  });
});
