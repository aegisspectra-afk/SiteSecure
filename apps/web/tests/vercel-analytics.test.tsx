import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { isLocalWebHost, vercelWebAnalyticsEnabled } from "../src/lib/cookie-consent";

vi.mock("@vercel/analytics/react", () => ({
  Analytics: () => <div data-testid="vercel-analytics-sdk" />,
}));

vi.mock("@tanstack/react-router", () => ({
  useRouterState: () => "/",
}));

describe("vercel web analytics", () => {
  it("stays off in vitest / dev (no env flag)", () => {
    expect(vercelWebAnalyticsEnabled()).toBe(false);
    expect(isLocalWebHost("localhost")).toBe(true);
    expect(isLocalWebHost("site-secure.com")).toBe(false);
  });

  it("does not mount the SDK component in dev", async () => {
    const { VercelAnalytics } = await import("../src/components/VercelAnalytics");
    render(<VercelAnalytics />);
    expect(screen.queryByTestId("vercel-analytics-sdk")).toBeNull();
  });
});