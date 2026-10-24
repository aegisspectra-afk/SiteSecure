import { ApiClientError } from "@site-secure/api-client";
import { describe, expect, it } from "vitest";
import { he } from "../i18n/he";
import { isWorkforceSchemaUnavailable, queryErrorDescription, shouldRetryQuery } from "./query-error";

describe("workforce query errors", () => {
  it("does not retry schema or auth failures", () => {
    expect(shouldRetryQuery(0, new ApiClientError(503, "WORKFORCE_SCHEMA_UNAVAILABLE", "חסר"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiClientError(403, "FEATURE_NOT_INCLUDED", "אין"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiClientError(404, "WORKFORCE_EMPLOYEE_NOT_LINKED", "לא משויך"))).toBe(false);
    expect(shouldRetryQuery(0, new Error("net"))).toBe(true);
    expect(shouldRetryQuery(1, new Error("net"))).toBe(false);
  });

  it("surfaces the server Hebrew message", () => {
    expect(
      queryErrorDescription(new ApiClientError(503, "WORKFORCE_SCHEMA_UNAVAILABLE", "טבלאות חסרות")),
    ).toBe("טבלאות חסרות");
    expect(queryErrorDescription(new Error("x"))).toBe(he.loadErrorHint);
    expect(
      queryErrorDescription({
        status: 503,
        code: "WORKFORCE_SCHEMA_UNAVAILABLE",
        message: "טבלאות חסרות",
      }),
    ).toBe("טבלאות חסרות");
  });

  it("detects missing Workforce tables without treating it as an auth failure", () => {
    expect(isWorkforceSchemaUnavailable(new ApiClientError(503, "WORKFORCE_SCHEMA_UNAVAILABLE", "חסר"))).toBe(true);
    expect(isWorkforceSchemaUnavailable(new ApiClientError(403, "PERMISSION_DENIED", "אין"))).toBe(false);
    expect(isWorkforceSchemaUnavailable({ status: 503, code: "WORKFORCE_SCHEMA_UNAVAILABLE" })).toBe(true);
  });
});
