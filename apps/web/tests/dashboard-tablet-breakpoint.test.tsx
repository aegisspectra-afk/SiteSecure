import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardCommandBalance, meaningfulSparkline } from "../src/components/dashboard/DashboardCommandBalance";
import { RecentQuotes } from "../src/components/dashboard/RecentQuotes";
import type { DashboardSummary } from "@site-secure/api-client";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
    params,
  }: {
    to: string;
    children: ReactNode;
    className?: string;
    params?: Record<string, string>;
  }) => {
    let href = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) href = href.replace(`$${key}`, value);
    }
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  },
}));

const summary = {
  quotes_draft: 1,
  quotes_sent: 1,
  quotes_viewed: 0,
  quotes_approved: 1,
  quotes_rejected: 0,
  quotes_open: 2,
  quotes_approved_value: 1000,
  quotes_open_value: 4800,
  jobs_open: 0,
  jobs_overdue: 0,
  jobs_unassigned: 0,
} satisfies DashboardSummary;

describe("tablet breakpoint coordination", () => {
  it("keeps the desktop sidebar off until 1280 and pairs the dashboard from canvas width", () => {
    const styles = readFileSync(path.resolve(__dirname, "../src/styles.css"), "utf8");
    expect(styles).toMatch(
      /@media \(min-width: 1280px\) \{\s*\.ops-sidebar \{\s*display: flex;\s*\}\s*\.ops-bottom-nav \{\s*display: none;/,
    );
    expect(styles).not.toMatch(/@media \(min-width: 1024px\) \{\s*\.ops-sidebar \{\s*display: flex;/);
    expect(styles).toContain("container-name: dash-canvas");
    expect(styles).toContain("@container dash-canvas (min-width: 64rem)");
    expect(styles).toContain("@container dash-canvas (min-width: 72rem)");
  });
});

describe("hero sparkline", () => {
  it("hides a single spike on an empty series and keeps a real trend", () => {
    expect(meaningfulSparkline([0, 0, 0, 0, 1200])).toBeNull();
    expect(meaningfulSparkline([0])).toBeNull();
    expect(meaningfulSparkline([400, 800, 600])).toEqual([400, 800, 600]);
  });

  it("does not render a broken sparkline when revenue is almost empty", () => {
    const { container } = render(
      <DashboardCommandBalance
        summary={summary}
        chart={{
          labels_he: ["a", "b", "c"],
          revenue: [0, 0, 900],
          quotes: [0, 0, 1],
        }}
      />,
    );
    expect(container.querySelector(".ops-command-balance-spark")).toBeNull();
    expect(screen.getByText(/4,?800|4800/)).toBeTruthy();
  });
});

describe("recent quotes long titles", () => {
  it("keeps the quote number and amount outside the truncated title", () => {
    const title = "Q3-B benchmark 2026-09-27T19:55:48.591Z extra stress fixture for tablet rows";
    render(
      <RecentQuotes
        quotes={[
          {
            id: "q-long",
            number: "Q-88081",
            status: "sent",
            title,
            customer_name: "לקוח בדיקה ארוך לשם עיצוב",
            total_gross: 12840,
            updated_at: "2026-09-27T19:55:48.591Z",
          },
        ]}
      />,
    );
    const row = document.querySelector(".ops-recent-row.is-dash5");
    if (!row) throw new Error("missing recent quote row");
    const number = row.querySelector(".ops-recent-number");
    const titleEl = row.querySelector(".ops-recent-title");
    const amount = row.querySelector(".ops-recent-amount");
    expect(number?.textContent).toBe("Q-88081");
    expect(titleEl?.textContent).toBe(title);
    expect(titleEl?.className).not.toContain("truncate");
    expect(amount?.textContent).toMatch(/12/);
    expect(row.querySelector(".ops-recent-primary")?.className).not.toContain("truncate");
  });
});
