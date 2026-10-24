import { describe, expect, it } from "vitest";
import { he } from "../src/i18n/he";
import {
  sspAttentionBanner,
  sspAttentionItems,
  sspAttentionLayout,
  sspCodeIssuedProgress,
  sspIdleFeedsEmpty,
  sspKpiTone,
  sspSetupComplete,
  sspSetupCounts,
  sspSetupSteps,
  sspShowExceptionsSection,
  sspSiteActivityKind,
  sspSiteHasIssuedCode,
  sspSitesWithoutForm,
  sspSiteToneClass,
} from "../src/lib/ssp-dashboard-view";

const labels = {
  overdue: "באיחור",
  openEvents: "אירועים פתוחים",
  lateRuns: "חריגות סיור",
  pendingJoins: "בקשות הצטרפות",
};

const setupCopy = {
  labels: {
    offices: "o",
    formPublished: "f",
    formAssigned: "a",
    codeIssued: "c",
    device: "d",
  },
  actions: {
    offices: "o",
    formPublished: "f",
    formAssigned: "a",
    codeIssued: "c",
    device: "d",
  },
};

describe("ssp dashboard view", () => {
  it("keeps attention items only when the count is above zero and excludes activation", () => {
    const items = sspAttentionItems({
      overdue: 2,
      openEvents: 0,
      lateRuns: 1,
      pendingJoins: 0,
      canEvents: true,
      canPatrols: true,
      labels,
    });
    expect(items.map((row) => row.id)).toEqual(["overdue", "late"]);
    expect(items.every((row) => row.value > 0)).toBe(true);
    expect(items.some((row) => row.id === "activation")).toBe(false);
  });

  it("treats zero danger values as muted", () => {
    expect(sspKpiTone("danger", 0)).toBe("muted");
    expect(sspKpiTone("danger", 3)).toBe("danger");
    expect(sspKpiTone("warning", 1)).toBe("warning");
  });

  it("hides setup after every step is done and reports 5/5", () => {
    const steps = sspSetupSteps({
      officesActive: 1,
      formsPublished: 1,
      assignmentsActive: 1,
      codeIssued: true,
      devicesActive: 1,
      ...setupCopy,
    });
    expect(sspSetupComplete(steps)).toBe(true);
    expect(sspSetupCounts(steps)).toEqual({ done: 5, total: 5 });
  });

  it("marks a site without assignments as a setup issue, not a late report", () => {
    expect(sspSiteActivityKind({ assigned_forms_count: 0, overdue_count: 2 })).toBe("no_form");
    expect(sspSiteActivityKind({ assigned_forms_count: 1, overdue_count: 2 })).toBe("overdue");
  });

  it("treats awaiting activation as a missing live code, not a completed issue step", () => {
    expect(sspSiteHasIssuedCode("awaiting_activation")).toBe(false);
    expect(sspSiteHasIssuedCode("code_issued")).toBe(true);
    expect(sspSiteHasIssuedCode("pending_approval")).toBe(true);
    expect(sspSiteHasIssuedCode("device_active")).toBe(true);
    expect(
      sspCodeIssuedProgress([
        { activation_status: "awaiting_activation" },
        { activation_status: "awaiting_activation" },
        { activation_status: "awaiting_activation" },
        { activation_status: "awaiting_activation" },
      ]),
    ).toEqual({ issued: 0, total: 4, done: false });
  });

  it("marks the code step done only when every site has an issued or active code", () => {
    expect(
      sspCodeIssuedProgress([
        { activation_status: "code_issued" },
        { activation_status: "device_active" },
        { activation_status: "pending_approval" },
      ]).done,
    ).toBe(true);
    expect(
      sspCodeIssuedProgress([
        { activation_status: "code_issued" },
        { activation_status: "awaiting_activation" },
      ]),
    ).toEqual({ issued: 1, total: 2, done: false });
    expect(sspCodeIssuedProgress([])).toEqual({ issued: 0, total: 0, done: false });
  });

  it("keeps awaiting-activation yellow and unassigned-form orange", () => {
    expect(sspSiteToneClass("pending")).toBe("ssp-site-tone is-pending");
    expect(sspSiteToneClass("no_form")).toBe("ssp-site-tone is-no-form");
    expect(sspSiteToneClass("overdue")).toBe("ssp-site-tone is-overdue");
  });

  it("collapses idle feeds only when timeline, joins, and reports are all empty", () => {
    expect(sspIdleFeedsEmpty(0, 0, 0)).toBe(true);
    expect(sspIdleFeedsEmpty(1, 0, 0)).toBe(false);
  });

  it("uses a green all-clear banner only after setup is complete and nothing is open", () => {
    expect(
      sspAttentionBanner({
        hasExceptions: false,
        setupComplete: false,
        pendingActivation: 4,
        sitesWithoutForm: 1,
      }),
    ).toBe("neutral");
    expect(
      sspAttentionBanner({
        hasExceptions: false,
        setupComplete: true,
        pendingActivation: 0,
        sitesWithoutForm: 0,
      }),
    ).toBe("clear");
    expect(
      sspAttentionBanner({
        hasExceptions: true,
        setupComplete: false,
        pendingActivation: 4,
        sitesWithoutForm: 1,
      }),
    ).toBe("items");
  });

  it("shows chips for overdue, open event, and patrol exception", () => {
    const overdue = sspAttentionItems({
      overdue: 2,
      openEvents: 0,
      lateRuns: 0,
      pendingJoins: 0,
      canEvents: true,
      canPatrols: true,
      labels,
    });
    const events = sspAttentionItems({
      overdue: 0,
      openEvents: 1,
      lateRuns: 0,
      pendingJoins: 0,
      canEvents: true,
      canPatrols: true,
      labels,
    });
    const late = sspAttentionItems({
      overdue: 0,
      openEvents: 0,
      lateRuns: 3,
      pendingJoins: 0,
      canEvents: true,
      canPatrols: true,
      labels,
    });
    expect(overdue.map((row) => row.id)).toEqual(["overdue"]);
    expect(events.map((row) => row.id)).toEqual(["events"]);
    expect(late.map((row) => row.id)).toEqual(["late"]);
    for (const items of [overdue, events, late]) {
      const banner = sspAttentionBanner({
        hasExceptions: items.length > 0,
        setupComplete: true,
        pendingActivation: 0,
        sitesWithoutForm: 0,
      });
      expect(banner).toBe("items");
      expect(sspAttentionLayout(banner)).toBe("chips");
    }
  });

  it("uses a compact activity line when setup is open and nothing operational is open", () => {
    const items = sspAttentionItems({
      overdue: 0,
      openEvents: 0,
      lateRuns: 0,
      pendingJoins: 0,
      canEvents: true,
      canPatrols: true,
      labels,
    });
    const banner = sspAttentionBanner({
      hasExceptions: items.length > 0,
      setupComplete: false,
      pendingActivation: 2,
      sitesWithoutForm: 1,
    });
    expect(items).toEqual([]);
    expect(banner).toBe("neutral");
    expect(sspAttentionLayout(banner)).toBe("line");
    expect(he.sspNoOperationalExceptions).toBe("אין איחורים, אירועים או חריגות פתוחים");
  });

  it("uses the green all-clear line when setup is done and nothing is open", () => {
    const items = sspAttentionItems({
      overdue: 0,
      openEvents: 0,
      lateRuns: 0,
      pendingJoins: 0,
      canEvents: true,
      canPatrols: true,
      labels,
    });
    const banner = sspAttentionBanner({
      hasExceptions: items.length > 0,
      setupComplete: true,
      pendingActivation: 0,
      sitesWithoutForm: 0,
    });
    expect(items).toEqual([]);
    expect(banner).toBe("clear");
    expect(sspAttentionLayout(banner)).toBe("line");
    expect(he.sspAllClear).toBe("הכול תקין");
  });

  it("hides the empty exceptions feed and shows full cards when events or late runs exist", () => {
    expect(sspShowExceptionsSection(0, 0)).toBe(false);
    expect(sspShowExceptionsSection(1, 0)).toBe(true);
    expect(sspShowExceptionsSection(0, 2)).toBe(true);
    const withCards = sspAttentionBanner({
      hasExceptions: true,
      setupComplete: true,
      pendingActivation: 0,
      sitesWithoutForm: 0,
    });
    const compact = sspAttentionBanner({
      hasExceptions: false,
      setupComplete: true,
      pendingActivation: 0,
      sitesWithoutForm: 0,
    });
    expect(sspAttentionLayout(withCards)).toBe("chips");
    expect(sspShowExceptionsSection(1, 0)).toBe(true);
    expect(sspAttentionLayout(compact)).toBe("line");
    expect(sspShowExceptionsSection(0, 0)).toBe(false);
  });

  it("counts sites without an assigned form", () => {
    expect(sspSitesWithoutForm([{ assigned_forms_count: 0 }, { assigned_forms_count: 1 }])).toBe(1);
  });
});
