import { render, screen } from "@testing-library/react";
import type { DashboardResponse } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ObserveDashboard, OpsDashboard } from "../src/components/dashboard/OpsDashboard";
import { TodayHome } from "../src/components/dashboard/TodayHome";
import { AttentionList } from "../src/components/dashboard/AttentionList";
import { DashboardSkeleton } from "../src/components/dashboard/DashboardSkeleton";
import { ErrorState } from "@site-secure/ui";
import { he } from "../src/i18n/he";
import { can, canAny, canAll } from "../src/lib/can";
import { dayGreeting } from "../src/lib/greeting";
import { homeVariant, moduleHref, quickActions } from "../src/lib/home";
import { liveAdminActions, workspaceSetup } from "../src/lib/workspace-setup";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

const emptyDash: DashboardResponse = {
  home_variant: "ops",
  generated_at: "2026-08-14T12:00:00Z",
  attention: [],
  today: { label_he: "היום", items: [] },
  activity: [],
};

const attentionDash: DashboardResponse = {
  ...emptyDash,
  attention: [
    {
      kind: "quote_awaiting_customer",
      label_he: "ממתינות לאישור הלקוח",
      count: 1,
      items: [
        {
          entity_type: "quote",
          entity_id: "q1",
          number: "Q-00012",
          title_he: "ממתין לאישור הלקוח",
          customer_name: "לקוח א",
          site_name: "אתר ב",
          scheduled_for: null,
          severity: "next",
          actions: [],
        },
      ],
    },
  ],
};

describe("homeVariant", () => {
  it("maps each role to the specified home", () => {
    expect(homeVariant("owner")).toBe("ops");
    expect(homeVariant("administrator")).toBe("ops");
    expect(homeVariant("manager")).toBe("ops");
    expect(homeVariant("sales")).toBe("sales");
    expect(homeVariant("technician")).toBe("today");
    expect(homeVariant("founding_technician")).toBe("today");
    expect(homeVariant("viewer")).toBe("observe");
  });
});

describe("module destinations", () => {
  it("does not expose CRM/Quotes/Jobs hrefs before those phases", () => {
    expect(moduleHref("customer.create")).toBeNull();
    expect(moduleHref("quote.create")).toBeNull();
    expect(moduleHref("job.create")).toBeNull();
    expect(moduleHref("quote", "q1")).toBeNull();
    expect(quickActions("owner", ["crm", "quotes"])).toEqual([]);
    expect(quickActions("viewer", ["crm"])).toEqual([]);
  });
});

describe("OpsDashboard", () => {
  it("empty state has no fake create CTAs or KPI copy", () => {
    render(<OpsDashboard data={emptyDash} roleKey="owner" features={["crm", "quotes"]} />);
    expect(screen.getByRole("heading", { name: he.overviewTitle })).toBeInTheDocument();
    expect(screen.getByText(he.dashboardEmptyTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "לקוח חדש" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "הצעת מחיר" })).not.toBeInTheDocument();
    expect(screen.queryByText(/KPI/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/revenue/i)).not.toBeInTheDocument();
    expect(screen.queryByText("142")).not.toBeInTheDocument();
  });

  it("owner empty state offers live admin destinations only", () => {
    render(
      <OpsDashboard
        data={emptyDash}
        roleKey="owner"
        features={["crm", "quotes", "settings"]}
        memberCount={1}
      />,
    );
    expect(screen.getAllByRole("link", { name: he.inviteUser }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: he.navSettings })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "לקוח חדש" })).not.toBeInTheDocument();
  });

  it("sales empty state has no team administration", () => {
    render(<OpsDashboard data={emptyDash} roleKey="sales" features={["crm"]} />);
    expect(screen.queryByText(he.inviteUser)).not.toBeInTheDocument();
    expect(screen.queryByText(he.setupTitle)).not.toBeInTheDocument();
  });

  it("attention rows are not links while destination modules are absent", () => {
    render(<AttentionList groups={attentionDash.attention} />);
    expect(screen.getByText(/ממתינות לאישור הלקוח/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

describe("ObserveDashboard", () => {
  it("viewer never gets mutation verbs", () => {
    render(<ObserveDashboard data={attentionDash} />);
    expect(screen.queryByRole("button", { name: he.startJob })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "לקוח חדש" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: he.completeJob })).not.toBeInTheDocument();
  });
});

describe("TodayHome", () => {
  it("shows the real next job verb and not open-job dead ends", () => {
    const data: DashboardResponse = {
      ...emptyDash,
      home_variant: "today",
      today: {
        label_he: "היום",
        items: [
          {
            entity_type: "job",
            entity_id: "j1",
            number: "J-00005",
            title_he: "מתוכננת",
            customer_name: "לקוח X",
            site_name: "אתר Y",
            scheduled_for: "2026-08-14T09:00:00+00:00",
            severity: "next",
            actions: ["start"],
          },
        ],
      },
    };
    render(<TodayHome data={data} onStart={vi.fn()} onComplete={vi.fn()} busyId={null} />);
    expect(screen.getByRole("button", { name: he.startJob })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "פתח עבודה" })).not.toBeInTheDocument();
  });

  it("empty today is honest", () => {
    render(
      <TodayHome
        data={{ ...emptyDash, home_variant: "today" }}
        onStart={vi.fn()}
        onComplete={vi.fn()}
        busyId={null}
      />,
    );
    expect(screen.getByText(he.todayEmptyTitle)).toBeInTheDocument();
  });
});

describe("dashboard states", () => {
  it("loading skeleton is a status", () => {
    render(<DashboardSkeleton />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("error offers retry", () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        title={he.dashboardError}
        action={
          <button type="button" onClick={onRetry}>
            {he.retry}
          </button>
        }
      />,
    );
    expect(screen.getByText(he.dashboardError)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: he.retry })).toBeInTheDocument();
  });
});

describe("permission helpers", () => {
  it("evaluates any/all without role-name branching", () => {
    expect(can("technician", "users.invite", ["core"])).toBe(false);
    expect(canAny("owner", ["users.invite", "crm.create"], ["crm"])).toBe(true);
    expect(canAny("viewer", ["users.invite", "users.manage"], ["team"])).toBe(false);
    expect(canAll("administrator", ["users.view", "jobs.view"], [])).toBe(true);
    expect(canAll("sales", ["users.view", "crm.view"], ["crm"])).toBe(false);
  });
});

describe("workspaceSetup", () => {
  it("computes real setup steps without decorative percent", () => {
    const solo = workspaceSetup({ roleKey: "owner", features: ["settings"], memberCount: 1 });
    expect(solo.complete).toBe(false);
    expect(solo.steps.map((step) => step.id)).toEqual(["workspace", "invite"]);
    expect(solo.steps.find((step) => step.id === "invite")?.current).toBe(true);

    const staffed = workspaceSetup({ roleKey: "owner", features: ["settings"], memberCount: 2 });
    expect(staffed.complete).toBe(true);

    const sales = workspaceSetup({ roleKey: "sales", features: ["crm"], memberCount: 1 });
    expect(sales.complete).toBe(true);
    expect(sales.steps.map((step) => step.id)).toEqual(["workspace"]);
  });

  it("admin actions stay on live settings routes", () => {
    const owner = liveAdminActions("owner", ["settings"]);
    expect(owner.map((item) => item.href)).toEqual([
      "/app/settings/users",
      "/app/settings",
      "/app/settings/roles",
      "/app/settings/security",
    ]);
    expect(liveAdminActions("technician", ["core"])).toEqual([]);
  });
});

describe("dayGreeting", () => {
  it("uses Jerusalem hours", () => {
    expect(dayGreeting(new Date("2026-08-15T06:00:00+03:00"))).toBe(he.greetingMorning);
    expect(dayGreeting(new Date("2026-08-15T14:00:00+03:00"))).toBe(he.greetingAfternoon);
    expect(dayGreeting(new Date("2026-08-15T19:00:00+03:00"))).toBe(he.greetingEvening);
  });
});
