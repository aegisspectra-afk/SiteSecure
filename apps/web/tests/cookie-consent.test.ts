import { describe, expect, it } from "vitest";
import { mayLoadAnalytics, usesNonEssentialCookies } from "../src/lib/cookie-consent";

describe("cookie consent", () => {
  it("treats analytics as non-essential only when production flag is on", () => {
    expect(usesNonEssentialCookies()).toBe(false);
    expect(mayLoadAnalytics()).toBe(false);
  });
});