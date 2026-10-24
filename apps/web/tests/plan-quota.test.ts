import { describe, expect, it } from "vitest";
import { ApiClientError } from "@site-secure/api-client";
import { planQuotaMessage } from "../src/lib/plan-quota";

describe("planQuotaMessage", () => {
  it("maps customers resource", () => {
    const err = new ApiClientError(403, "PLAN_LIMIT_REACHED", "x", { resource: "customers" });
    const msg = planQuotaMessage(err);
    expect(msg).toContain("לקוחות");
    expect(msg).not.toMatch(/שדרגו|Stripe|checkout|שלמו עכשיו/i);
  });

  it("maps storage resource", () => {
    const err = new ApiClientError(403, "PLAN_LIMIT_REACHED", "x", { resource: "storage" });
    const msg = planQuotaMessage(err);
    expect(msg).toContain("אחסון");
  });

  it("names field seats from plan-limit details without a checkout claim", () => {
    const err = new ApiClientError(409, "PLAN_LIMIT_REACHED", "הגעתם למגבלת התוכנית הנוכחית", {
      resource: "seats_field",
      limit_key: "seats_field",
      current: 3,
      limit: 3,
    });
    const msg = planQuotaMessage(err);
    expect(msg).toContain("בשטח");
    expect(msg).toContain("(3/3)");
    expect(msg).not.toMatch(/שדרגו|Stripe|checkout|שלמו עכשיו/i);
  });

  it("ignores an unrelated HTTP 409", () => {
    expect(planQuotaMessage(new Error("nope"))).toBeNull();
    expect(planQuotaMessage(new ApiClientError(400, "VALIDATION_ERROR", "x"))).toBeNull();
    const conflict = new ApiClientError(
      409,
      "SSP_ACCOUNT_CONFLICT",
      "לא ניתן ליצור משתמש עם פרטי ההתחברות האלה — ייתכן שהחשבון כבר קיים",
    );
    expect(planQuotaMessage(conflict)).toBeNull();
  });
});
