import { describe, expect, it } from "vitest";
import { ApiClientError } from "@site-secure/api-client";
import { planQuotaMessage } from "../src/lib/plan-quota";

describe("planQuotaMessage", () => {
  it("maps customers resource", () => {
    const err = new ApiClientError(403, "PLAN_LIMIT_REACHED", "x", { resource: "customers" });
    const msg = planQuotaMessage(err);
    expect(msg).toContain("לקוחות");
  });

  it("maps storage resource", () => {
    const err = new ApiClientError(403, "PLAN_LIMIT_REACHED", "x", { resource: "storage" });
    const msg = planQuotaMessage(err);
    expect(msg).toContain("אחסון");
  });

  it("ignores unrelated errors", () => {
    expect(planQuotaMessage(new Error("nope"))).toBeNull();
    expect(planQuotaMessage(new ApiClientError(400, "VALIDATION_ERROR", "x"))).toBeNull();
  });
});
