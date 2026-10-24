import { describe, expect, it } from "vitest";
import {
  SSP_FORM_HAS_DELETE_API,
  SSP_FORMS_FILTER_MIN,
  countSspFormAssignments,
  countSspFormSubmissions,
  filterSspForms,
  sspFormCanAssign,
  sspFormCanDelete,
  sspFormFiltersVisible,
  sspFormHasTemplates,
  sspFormNeedsEditWarning,
  sspFormNextVersion,
  sspFormStatusTone,
  sspFormUnassigned,
  sspFormVersionKind,
  sspFormsListState,
} from "../src/lib/ssp-forms-view";

describe("ssp forms view", () => {
  it("labels draft, published and archived, and treats a missing version as unpublished", () => {
    expect(sspFormStatusTone("draft")).toBe("pending");
    expect(sspFormStatusTone("published")).toBe("officer");
    expect(sspFormStatusTone("archived")).toBe("quiet");
    expect(sspFormVersionKind(null)).toBe("unpublished");
    expect(sspFormVersionKind(2)).toBe("version");
  });

  it("marks a published form with zero active assignments as unassigned", () => {
    expect(sspFormUnassigned("published", 0)).toBe(true);
    expect(sspFormUnassigned("published", 2)).toBe(false);
    expect(sspFormUnassigned("draft", 0)).toBe(false);
    expect(sspFormUnassigned("published", null)).toBe(false);
    expect(sspFormCanAssign("published")).toBe(true);
    expect(sspFormCanAssign("draft")).toBe(false);
  });

  it("blocks delete when the API is missing or the form has work attached", () => {
    expect(SSP_FORM_HAS_DELETE_API).toBe(false);
    expect(sspFormCanDelete({ hasDeleteApi: false, assignmentCount: 0, submissionCount: 0 })).toBe(false);
    expect(sspFormCanDelete({ hasDeleteApi: true, assignmentCount: 1, submissionCount: 0 })).toBe(false);
    expect(sspFormCanDelete({ hasDeleteApi: true, assignmentCount: 0, submissionCount: 3 })).toBe(false);
    expect(sspFormCanDelete({ hasDeleteApi: true, assignmentCount: 0, submissionCount: 0 })).toBe(true);
  });

  it("uses an empty state when there are no forms and no-results when a filter matches nothing", () => {
    expect(sspFormsListState({ loading: false, error: false, itemCount: 0, filterActive: false })).toBe("empty");
    expect(sspFormsListState({ loading: false, error: false, itemCount: 0, filterActive: true })).toBe("no-results");
    expect(sspFormsListState({ loading: false, error: false, itemCount: 2, filterActive: false })).toBe("rows");
    expect(sspFormFiltersVisible(2)).toBe(false);
    expect(sspFormFiltersVisible(SSP_FORMS_FILTER_MIN)).toBe(true);
    expect(sspFormHasTemplates()).toBe(false);
    expect(sspFormNeedsEditWarning("published")).toBe(true);
    expect(sspFormNextVersion(2)).toBe(3);
    expect(
      filterSspForms(
        [
          { title: "סיור", status: "published" },
          { title: "טיוטה", status: "draft" },
        ],
        "",
        "draft",
      ),
    ).toHaveLength(1);
    expect(countSspFormAssignments([{ form_id: "a", status: "active" }, { form_id: "a", status: "paused" }], "a")).toBe(1);
    expect(countSspFormSubmissions([{ form_id: "a", submission_count: 4 }, { form_id: "b", submission_count: 1 }], "a")).toBe(4);
  });
});
