import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TodayList } from "../src/components/dashboard/TodayList";
import { he } from "../src/i18n/he";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => <a className={className}>{children}</a>,
}));

describe("DEMO-4.4 Today card: job number and time in RTL", () => {
  it("number and time are separate LTR islands, separator in the RTL flow, number first", () => {
    const item = {
      entity_type: "job", entity_id: "j1", number: "J-00003", title_he: "התקנה", status: "scheduled", severity: "next",
      actions: [], scheduled_for: "2026-11-17T07:00:00Z", scheduled_end: "2026-11-17T11:00:00Z", customer_name: "לקוח", site_name: "אתר",
    };
    render(<TodayList items={[item] as never} onAction={() => {}} busyId={null} />);
    const number = screen.getByTestId("today-card-number");
    const time = screen.getByTestId("today-card-time");
    expect(number.tagName).toBe("BDI");
    expect(time.tagName).toBe("BDI");
    expect(number).toHaveAttribute("dir", "ltr");
    expect(number.textContent).toBe("J-00003");
    expect(time.textContent).toMatch(/^\d{2}:\d{2}–\d{2}:\d{2}$/); // no separator inside the LTR run
    // DOM order = reading order in RTL: number, then time.
    expect(number.compareDocumentPosition(time) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("DEMO-4.4 site dossier chrome is Hebrew", () => {
  it("overview and health kickers", () => {
    const labels = [
      he.siteOverviewKicker,
      he.siteHealthKicker,
      he.siteHealthOperational,
      he.siteMetricCameras,
      he.siteMetricNvrs,
      he.siteMetricSwitches,
      he.siteMetricJobs,
      he.siteCustomerKicker,
      he.siteRecentKicker,
    ];
    for (const label of labels) expect(label).not.toMatch(/[A-Za-z]/);
  });
});

describe("DEMO-4.4 job page labels are Hebrew", () => {
  it("section kickers and start/done lines", () => {
    const labels = [
      he.fieldJobKicker, he.fieldDoKicker, he.fieldEquipmentKicker, he.fieldAssignKicker, he.fieldWhereKicker,
      he.fieldPhotosKicker, he.fieldCompleteKicker, he.fieldStartedAt("08:00"), he.fieldDoneAt("12:00"),
    ];
    for (const label of labels) expect(label).not.toMatch(/[A-Za-z]/);
  });
});
