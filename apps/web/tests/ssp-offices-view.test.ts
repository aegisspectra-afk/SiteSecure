import { describe, expect, it } from "vitest";
import {
  compareSspOffices,
  nextSspOfficeSort,
  sortSspOffices,
  sspOfficeActivation,
  sspOfficeActivationTone,
  sspOfficeFiltersActive,
  sspOfficeWarningDetail,
  sspOfficeWarningSummary,
  sspOfficeWarnings,
  sspOfficesListState,
} from "../src/lib/ssp-offices-view";
import { sspSiteToneClass } from "../src/lib/ssp-dashboard-view";

describe("ssp offices view", () => {
  it("tags missing team and missing form as orange warnings", () => {
    expect(sspOfficeWarnings({ members_count: 0, assigned_forms_count: 0 })).toEqual(["no_team", "no_form"]);
    expect(sspOfficeWarnings({ members_count: 1, assigned_forms_count: 0 })).toEqual(["no_form"]);
    expect(sspOfficeWarnings({ members_count: 0, assigned_forms_count: 2 })).toEqual(["no_team"]);
    expect(sspOfficeWarnings({ members_count: 2, assigned_forms_count: 1 })).toEqual([]);
    expect(sspSiteToneClass("no_form")).toBe("ssp-site-tone is-no-form");
    expect(sspOfficeWarningSummary(["no_team", "no_form"])).toBe("setup");
    expect(sspOfficeWarningSummary(["no_form"])).toBe("no_form");
    expect(
      sspOfficeWarningDetail(["no_team", "no_form"], { noTeam: "לא הוגדר צוות", noForm: "לא הוקצה טופס" }),
    ).toBe("לא הוגדר צוות · לא הוקצה טופס");
  });

  it("uses the dashboard pending activation tone", () => {
    expect(sspOfficeActivation("awaiting_activation")).toBe("pending");
    expect(sspOfficeActivation("pending_approval")).toBe("pending");
    expect(sspOfficeActivation("code_issued")).toBe("issued");
    expect(sspOfficeActivation("device_active")).toBe("active");
    expect(sspOfficeActivation(null)).toBe("none");
    expect(sspOfficeActivationTone("pending")).toBe("pending");
    expect(sspSiteToneClass("pending")).toBe("ssp-site-tone is-pending");
  });

  it("treats an empty filtered list as no-results, not a bare empty workspace", () => {
    expect(
      sspOfficesListState({ loading: false, error: false, itemCount: 0, filterActive: false }),
    ).toBe("empty");
    expect(
      sspOfficesListState({ loading: false, error: false, itemCount: 0, filterActive: true }),
    ).toBe("no-results");
    expect(
      sspOfficesListState({ loading: false, error: false, itemCount: 4, filterActive: true }),
    ).toBe("rows");
    expect(sspOfficeFiltersActive("שפלה", "", "")).toBe(true);
    expect(sspOfficeFiltersActive("  ", "", "")).toBe(false);
  });

  it("sorts by name and members without sharing row state", () => {
    const rows = [
      { name: "שפלה 4", is_active: true, members_count: 0, assigned_forms_count: 0 },
      { name: "מוקד צפון", is_active: true, members_count: 3, assigned_forms_count: 1 },
    ];
    const byMembers = sortSspOffices(rows, "members", "desc");
    expect(byMembers.map((row) => row.name)).toEqual(["מוקד צפון", "שפלה 4"]);
    expect(compareSspOffices(rows[0], rows[1], "name", "asc")).toBeGreaterThan(0);
    expect(nextSspOfficeSort("name", "asc", "name")).toEqual({ key: "name", dir: "desc" });
    expect(nextSspOfficeSort("name", "asc", "status")).toEqual({ key: "status", dir: "asc" });
  });
});
