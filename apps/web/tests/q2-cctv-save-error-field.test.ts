import { ApiClientError } from "@site-secure/api-client";
import { describe, expect, it } from "vitest";
import { apiErrorMessage, validationFieldLabel } from "../src/lib/api-validation-message";
import { he } from "../src/i18n/he";

// The exact 400 the CCTV designer got before the fix (captured from the local API).
const realError = new ApiClientError(400, "VALIDATION_ERROR", "נתונים לא תקינים", {
  errors: [
    { type: "extra_forbidden", loc: ["body", "components", 0, "equipment_intent"], msg: "Extra inputs are not permitted" },
    { type: "extra_forbidden", loc: ["body", "components", 1, "equipment_intent"], msg: "Extra inputs are not permitted" },
  ],
});

describe("Q2.1 the save error names the field", () => {
  it("turns the API location into a Hebrew field name with the component number", () => {
    expect(validationFieldLabel(["body", "components", 0, "equipment_intent"])).toBe(he.apiFieldInComponent("כוונת ציוד", 1));
    expect(validationFieldLabel(["body", "requirements"])).toBe("דרישות");
    expect(validationFieldLabel(["body", "cable_distance_meters"])).toBe("אורך כבל");
    expect(validationFieldLabel(["body", "unknown_field"])).toBe("unknown_field");
    expect(validationFieldLabel([])).toBeNull();
  });

  it("appends the failing fields to 'נתונים לא תקינים'", () => {
    const msg = apiErrorMessage(realError, he.cpqCctvDesignSaveError);
    expect(msg).toBe(he.apiValidationWithField("נתונים לא תקינים", "כוונת ציוד (רכיב 1), כוונת ציוד (רכיב 2)"));
    expect(msg).toContain("כוונת ציוד");
  });

  it("keeps other errors as they are", () => {
    expect(apiErrorMessage(new ApiClientError(409, "CONFLICT_REVISION", "גרסה ישנה"), "x")).toBe("גרסה ישנה");
    expect(apiErrorMessage(new Error("boom"), he.cpqCctvDesignSaveError)).toBe(he.cpqCctvDesignSaveError);
    expect(apiErrorMessage(new ApiClientError(400, "VALIDATION_ERROR", "נתונים לא תקינים", {}), "x")).toBe("נתונים לא תקינים");
  });
});
