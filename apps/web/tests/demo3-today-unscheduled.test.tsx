import { render, screen, within } from "@testing-library/react";
import type { DashboardResponse } from "@site-secure/api-client";
import { describe, expect, it, vi } from "vitest";
import { TodayHome } from "../src/components/dashboard/TodayHome";
import { he } from "../src/i18n/he";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => <a className={className}>{children}</a>,
}));

function item(id: string, title: string, scheduled_for: string | null) {
  return { entity_type: "job", entity_id: id, number: id, title_he: title, status: "scheduled", severity: "next",
    actions: ["en_route"], scheduled_for, scheduled_end: null, customer_name: "לקוח", site_name: "אתר" };
}

function data(today: unknown[], unscheduled: unknown[] | null): DashboardResponse {
  return {
    home_variant: "today",
    generated_at: "2026-11-16T08:00:00Z",
    attention: [],
    today: { label_he: "היום", items: today },
    unscheduled: unscheduled === null ? null : { label_he: "ללא מועד", items: unscheduled },
    activity: [],
    summary: {},
    recent_quotes: [],
  } as unknown as DashboardResponse;
}

describe("DEMO-3.2 Today by date, undated jobs under 'ללא מועד'", () => {
  it("lists undated assigned jobs instead of saying there is no work", () => {
    render(<TodayHome data={data([], [item("J-1", "התקנה אצל אורן", null)])} onAction={() => {}} busyId={null} />);
    expect(screen.queryByText(he.todayEmptyTitle)).not.toBeInTheDocument();
    expect(screen.getByTestId("today-nothing-today")).toHaveTextContent(he.todayNothingToday);
    const section = screen.getByTestId("today-unscheduled");
    expect(section).toHaveTextContent(he.todayUnscheduledTitle);
    expect(within(section).getByText("התקנה אצל אורן")).toBeInTheDocument();
  });

  it("shows today's jobs and the undated ones separately", () => {
    render(
      <TodayHome
        data={data([item("J-2", "עבודה של היום", "2026-11-16T09:00:00Z")], [item("J-1", "בלי תאריך", null)])}
        onAction={() => {}}
        busyId={null}
      />,
    );
    expect(screen.getByText("עבודה של היום")).toBeInTheDocument();
    expect(within(screen.getByTestId("today-unscheduled")).getByText("בלי תאריך")).toBeInTheDocument();
  });

  it("keeps the empty state when there is nothing at all, with Hebrew header labels", () => {
    const { container } = render(<TodayHome data={data([], [])} onAction={() => {}} busyId={null} />);
    expect(screen.getByText(he.todayEmptyTitle)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/FIELD OPS|JOBS/);
  });
});
