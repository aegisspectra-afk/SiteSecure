import { describe, expect, it } from "vitest";
import {
  isLocalWebHost,
  mayLoadAnalytics,
  usesNonEssentialCookies,
  vercelWebAnalyticsEnabled,
} from "../src/lib/cookie-consent";

describe("cookie consent", () => {
  it("treats analytics as non-essential only when production flag is on", () => {
    expect(vercelWebAnalyticsEnabled()).toBe(false);
    expect(usesNonEssentialCookies()).toBe(false);
    expect(mayLoadAnalytics()).toBe(false);
    expect(isLocalWebHost("127.0.0.1")).toBe(true);
    expect(isLocalWebHost("www.site-secure.com")).toBe(false);
  });
});