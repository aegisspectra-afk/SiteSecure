import { render, screen } from "@testing-library/react";
import type { DashboardItem } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ActiveWork,
  formatTodaySchedule,
  todayStatusTone,
} from "../src/components/dashboard/ActiveWork";
import { he } from "../src/i18n/he";

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
  }) => (
    <a
      href={params ? `${String(to)}?${new URLSearchParams(params).toString()}` : String(to)}
      className={className}
      data-params={params ? JSON.stringify(params) : undefined}
    >
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

const baseJob = (over: Partial<DashboardItem> = {}): DashboardItem => ({
  entity_type: "job",
  entity_id: "job-1",
  number: "J-00011",
  title_he: "התקנת מצלמות",
  customer_name: "לקוח אלפא",
  site_name: "אתר הרצל",
  scheduled_for: "2026-09-27T09:00:00+03:00",
  scheduled_end: "2026-09-27T11:00:00+03:00",
  status: "scheduled",
  severity: "next",
  actions: [],
  ...over,
});

describe("DASH-4 Today / ActiveWork queue", () => {
  it("renders dense rows with title, context, schedule, status, and open action", () => {
    render(<ActiveWork items={[baseJob({ status: "in_progress", severity: "now" })]} />);
    expect(screen.getByRole("heading", { name: he.todayTitle })).toBeInTheDocument();
    expect(screen.getByText(he.activeWorkCount(1))).toBeInTheDocument();
    expect(screen.getByText("התקנת מצלמות")).toBeInTheDocument();
    expect(screen.getByText(/לקוח אלפא/)).toBeInTheDocument();
    expect(screen.getByText(/אתר הרצל/)).toBeInTheDocument();
    expect(screen.getByText("J-00011")).toBeInTheDocument();
    expect(screen.getByText(he.jobStatuses.in_progress)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: he.dashViewToday })).toHaveAttribute("href", "/app/today");
    const open = document.querySelector(".ops-today-row.is-queue.is-interactive") as HTMLAnchorElement | null;
    expect(open).toBeTruthy();
    expect(open?.getAttribute("href")).toContain("/app/jobs/$jobId");
    expect(open?.getAttribute("data-params")).toContain("job-1");
    expect(open?.textContent).toContain(he.openLinkedJob);
    expect(document.querySelector(".ops-today-row.is-queue.is-tone-active")).toBeTruthy();
    expect(document.querySelector(".ss-activity-row-leading")).toBeTruthy();
  });

  it("shows muted no-time state instead of inventing a schedule", () => {
    render(
      <ActiveWork
        items={[baseJob({ scheduled_for: null, scheduled_end: null, status: "scheduled" })]}
      />,
    );
    expect(screen.getByText(he.fieldNoSchedule)).toBeInTheDocument();
    expect(screen.queryByText(/\d{2}:\d{2}–\d{2}:\d{2}/)).not.toBeInTheDocument();
  });

  it("formats real start–end windows only when both exist", () => {
    expect(formatTodaySchedule(baseJob())).toMatch(/^\d{2}:\d{2}–\d{2}:\d{2}$/);
    expect(formatTodaySchedule(baseJob({ scheduled_end: null }))).toMatch(/^\d{2}:\d{2}$/);
    expect(formatTodaySchedule(baseJob({ scheduled_for: null, scheduled_end: null }))).toBeNull();
  });

  it("maps statuses to semantic tones without inventing lifecycle", () => {
    expect(todayStatusTone("scheduled", "next")).toBe("info");
    expect(todayStatusTone("in_progress", "now")).toBe("active");
    expect(todayStatusTone("completed", "info")).toBe("success");
    expect(todayStatusTone("blocked", "now")).toBe("warning");
  });

  it("does not render open CTA for non-job entities", () => {
    render(
      <ActiveWork
        items={[
          baseJob({
            entity_type: "lead",
            entity_id: "lead-1",
            number: "L-1",
            title_he: "לא עבודה",
          }),
        ]}
      />,
    );
    expect(screen.getByText("לא עבודה")).toBeInTheDocument();
    expect(document.querySelector(".ops-today-row.is-static")).toBeTruthy();
    expect(screen.queryByRole("link", { name: he.openLinkedJob })).not.toBeInTheDocument();
  });

  it("compact empty state is restrained with Today link", () => {
    render(<ActiveWork items={[]} compactEmpty />);
    expect(screen.getByText(he.todayRestDay)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: he.dashViewToday })).toHaveAttribute("href", "/app/today");
    expect(document.querySelector(".ops-today-card.is-queue")).toBeTruthy();
  });

  it("keeps LTR isolation on times and IDs", () => {
    const { container } = render(<ActiveWork items={[baseJob()]} />);
    expect(container.querySelector(".ops-today-time.ltr-meta")).toBeTruthy();
    expect(container.querySelector(".ops-today-id.ltr-meta")).toBeTruthy();
  });

  it("renders long customer/site/title stress fixtures without dropping open CTA", () => {
    render(
      <ActiveWork
        items={[
          baseJob({
            title_he:
              "התקנת מערכת אבטחה מקיפה למבנה מסחרי רב-קומתי עם דגש על היקף חיצוני",
            customer_name: "לקוח בדיקה ארוך לשם עיצוב",
            site_name: "אתר בדיקה — שדרות הרצל 42 תל אביב קומה 7 אגף מזרחי",
            status: "in_progress",
            severity: "now",
          }),
        ]}
      />,
    );
    expect(
      screen.getByText(/התקנת מערכת אבטחה מקיפה/),
    ).toBeInTheDocument();
    expect(screen.getByText(/לקוח בדיקה ארוך לשם עיצוב/)).toBeInTheDocument();
    expect(screen.getByText(/שדרות הרצל 42/)).toBeInTheDocument();
    expect(document.querySelector(".ops-today-cta.is-quiet")?.textContent).toContain(
      he.openLinkedJob,
    );
    expect(document.querySelector(".ops-today-context")).toBeTruthy();
    expect(document.querySelector(".ops-today-card.is-queue")).toBeTruthy();
  });
});
