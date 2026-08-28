import { fireEvent, render, screen } from "@testing-library/react";
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
import { nextBestAction } from "../src/lib/next-best-action";
import { quoteConversion, quotesInPlay, seatTone, seatUtilization } from "../src/lib/ux-metrics";
import { liveAdminActions, workspaceSetup } from "../src/lib/workspace-setup";
import { dashboardStage } from "../src/lib/dashboard-maturity";
import { waitingDays } from "../src/lib/attention-queue";

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
  useNavigate: () => vi.fn(),
}));

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    api: {
      listCustomers: vi.fn(async () => ({ items: [] })),
      listSites: vi.fn(async () => ({ items: [] })),
      createCustomer: vi.fn(),
    },
    session: { memberships: [{ workspace_id: "ws" }] },
  }),
}));

vi.mock("../src/components/quotes/CreateQuoteDialog", () => ({
  CreateQuoteDialog: () => null,
  NewQuoteDialog: () => null,
}));

vi.mock("../src/components/quotes/quote-creation/NewQuoteDialog", () => ({
  CreateQuoteDialog: () => null,
  NewQuoteDialog: () => null,
}));

const emptySummary = {
  quotes_draft: 0,
  quotes_sent: 0,
  quotes_viewed: 0,
  quotes_approved: 0,
  quotes_rejected: 0,
  quotes_open: 0,
  quotes_approved_value: 0,
  quotes_open_value: 0,
  jobs_open: 0,
  jobs_overdue: 0,
  jobs_unassigned: 0,
};

const emptyDash: DashboardResponse = {
  home_variant: "ops",
  generated_at: "2026-08-14T12:00:00Z",
  attention: [],
  today: { label_he: "היום", items: [] },
  activity: [],
  summary: emptySummary,
  recent_quotes: [],
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
  it("exposes live quote and customer routes; jobs still pending", () => {
    expect(moduleHref("customer.create")).toBe("/app/customers");
    expect(moduleHref("quote.create")).toBe("/app/quotes/new");
    expect(moduleHref("job.create")).toBeNull();
    expect(moduleHref("quote", "q1")).toBe("/app/quotes/q1");
    expect(moduleHref("customer", "c1")).toBe("/app/customers/c1");
    expect(moduleHref("site", "s1")).toBe("/app/sites/s1");
    expect(quickActions("owner", ["crm", "quotes"])).toEqual([
      { permission: "crm.create", label: "לקוח חדש", href: "/app/customers" },
      { permission: "quotes.create", label: he.newQuote, href: "/app/quotes/new" },
    ]);
    expect(quickActions("viewer", ["crm", "quotes"])).toEqual([]);
    expect(quickActions("technician", ["quotes"])).toEqual([]);
  });
});

describe("OpsDashboard", () => {
  it("empty state has no fake create CTAs or KPI copy", () => {
    render(<OpsDashboard data={emptyDash} roleKey="owner" features={["crm", "quotes"]} />);
    expect(screen.getByRole("heading", { name: he.dashboardTitleShort })).toBeInTheDocument();
    expect(screen.getByText(he.commandQuietBody)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: he.nextActionTitle })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: he.activeWorkTitle })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: he.recentQuotesTitle })).toBeInTheDocument();
    expect(screen.getByText(he.recentQuotesEmptyTitle)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: he.quotePipelineTitle })).not.toBeInTheDocument();
    expect(screen.getByText(he.gettingStartedTitle)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: he.newQuoteAction }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "לקוח חדש" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "לקוח חדש" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "פרויקט חדש" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "קריאת שירות" })).not.toBeInTheDocument();
    expect(screen.queryByText(/revenue/i)).not.toBeInTheDocument();
    expect(screen.queryByText("142")).not.toBeInTheDocument();
    expect(screen.queryByText("Storage")).not.toBeInTheDocument();
    expect(screen.queryByText("NPS")).not.toBeInTheDocument();
    expect(screen.queryByText("Authentication")).not.toBeInTheDocument();
    expect(screen.queryByText("Tenant Isolation")).not.toBeInTheDocument();
    expect(screen.queryByText("פתחו את מרכז האבטחה")).not.toBeInTheDocument();
  });

  it("shows live security signals when the security center payload is present", () => {
    render(
      <OpsDashboard
        data={emptyDash}
        roleKey="owner"
        features={["settings"]}
        securitySignals={[
          { key: "authentication", label_he: "Authentication", status: "healthy", detail_he: "JWT" },
          { key: "rbac", label_he: "RBAC", status: "healthy", detail_he: "owner" },
          { key: "tenant_isolation", label_he: "Tenant Isolation", status: "healthy", detail_he: "workspace" },
          { key: "sessions", label_he: "Sessions", status: "not_built", detail_he: "not built" },
        ]}
      />,
    );
    expect(screen.getByText(he.securityBarHealthy)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: he.securityStatusTitle })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(he.securityCenterLink) })).toHaveAttribute(
      "href",
      "/app/settings/security",
    );
  });

  it("owner empty state offers live quote creation first", () => {
    render(
      <OpsDashboard
        data={emptyDash}
        roleKey="owner"
        features={["crm", "quotes", "settings"]}
        memberCount={1}
        workspaceStatus="active"
      />,
    );
    expect(screen.getAllByRole("button", { name: he.newQuoteAction }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "לקוח חדש" })).not.toBeInTheDocument();
  });

  it("sales empty state has no team administration", () => {
    render(<OpsDashboard data={{ ...emptyDash, home_variant: "sales" }} roleKey="sales" features={["crm", "quotes"]} />);
    expect(screen.queryByText(he.inviteUser)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: he.setupTitle })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: he.newQuoteAction }).length).toBeGreaterThan(0);
  });

  it("renders catalog usage meters from the server and not fake KPIs", () => {
    render(
      <OpsDashboard
        data={emptyDash}
        roleKey="owner"
        features={["settings"]}
        memberCount={1}
        workspaceStatus="active"
        usage={{
          workspace_id: "w1",
          plan_key: "solo",
          active_members: 1,
          pending_invites: 1,
          meters: [
            {
              key: "seats_operator",
              label_he: "משתמשים במשרד",
              current: 1,
              limit: 1,
              unlimited: false,
              unit: "seats",
              at_limit: true,
              occupants: [
                {
                  kind: "member",
                  role_key: "owner",
                  email: "aegisspectra@gmail.com",
                  label: "Ilya Kerner",
                  status: "active",
                },
              ],
            },
            {
              key: "seats_field",
              label_he: "משתמשים בשטח",
              current: 1,
              limit: 3,
              unlimited: false,
              unit: "seats",
              at_limit: false,
              occupants: [
                {
                  kind: "invite",
                  role_key: "technician",
                  email: "shimdurac@gmail.com",
                  label: "shimdurac@gmail.com",
                  status: "pending",
                },
              ],
            },
            {
              key: "storage_gb",
              label_he: "אחסון",
              current: 0,
              limit: 16106127360,
              unlimited: false,
              unit: "bytes",
              at_limit: false,
              occupants: [],
            },
            {
              key: "quota_quotes",
              label_he: "הצעות מחיר",
              current: 12,
              limit: 50,
              unlimited: false,
              unit: "quotes",
              at_limit: false,
              occupants: [],
              detail_he: "טיוטה: 5 · נשלח: 4 · אושר: 2 · נדחה: 1",
            },
            {
              key: "quota_clients",
              label_he: "לקוחות",
              current: 8,
              limit: 30,
              unlimited: false,
              unit: "customers",
              at_limit: false,
              occupants: [],
              detail_he: "פעילים: 8",
            },
          ],
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: he.usageTitle })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /משתמשים במשרד: 100 אחוז/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /משתמשים בשטח: 33 אחוז/ })).toBeInTheDocument();
    expect(screen.getByText(/0 GB \/ 15 GB · 15 GB פנוי/)).toBeInTheDocument();
    expect(screen.getByText(he.quotesRemaining(38))).toBeInTheDocument();
    expect(screen.getByText(he.clientsRemaining(22))).toBeInTheDocument();
    expect(screen.getByText(he.usageOfficeSeatTaken("Ilya Kerner"))).toBeInTheDocument();
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText(he.usageActivitySummary(1, 1))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: he.usageManageUsers })).toHaveAttribute("href", "/app/settings/users");
    fireEvent.click(screen.getByRole("button", { name: /משתמשים בשטח/ }));
    expect(screen.getByText(he.usageWho)).toBeInTheDocument();
    expect(screen.getByText(/shimdurac@gmail.com/)).toBeInTheDocument();
    expect(screen.getByText(he.usageOccupantPending)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /משתמשים במשרד/ }));
    expect(screen.getByText("Ilya Kerner")).toBeInTheDocument();
    expect(screen.getByText(he.usageOccupantActive)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /חברים פעילים/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Storage/i)).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /הצעות מחיר: 24 אחוז/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /לקוחות: 27 אחוז/ })).toBeInTheDocument();
  });

  it("renders circular UX metrics from real setup, seats, and quotes", () => {
    render(
      <OpsDashboard
        data={{
          ...emptyDash,
          summary: {
            ...emptySummary,
            quotes_draft: 1,
            quotes_approved: 1,
            quotes_open: 0,
            quotes_approved_value: 250,
            quotes_open_value: 0,
          },
          recent_quotes: [
            {
              id: "q1",
              number: "Q-00001",
              status: "approved",
              customer_name: null,
              total_gross: 250,
              updated_at: "2026-08-15T12:00:00Z",
            },
          ],
        }}
        roleKey="owner"
        features={["settings", "quotes"]}
        memberCount={1}
        workspaceStatus="active"
        usage={{
          workspace_id: "w1",
          plan_key: "solo",
          active_members: 1,
          pending_invites: 0,
          meters: [
            {
              key: "seats_operator",
              label_he: "משתמשים במשרד",
              current: 1,
              limit: 1,
              unlimited: false,
              unit: "seats",
              at_limit: true,
            },
            {
              key: "seats_field",
              label_he: "משתמשים בשטח",
              current: 0,
              limit: 3,
              unlimited: false,
              unit: "seats",
              at_limit: false,
            },
          ],
        }}
      />,
    );
    expect(screen.getByText(/1\/2.*50%/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: he.setupTitle })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: he.uxRingsTitle })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: he.businessTitle })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /משתמשים במשרד: 100 אחוז/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /משתמשים בשטח: 0 אחוז/ })).toBeInTheDocument();
    expect(screen.getByText(he.setupPendingLabel)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: he.inviteUser })).toHaveAttribute("href", "/app/settings/users");
    expect(screen.getByText(he.uxSeatFull)).toBeInTheDocument();
    expect(screen.queryByText(he.uxSeatEmpty)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: he.nextActionTitle })).toBeInTheDocument();
    expect(screen.getByText(he.nextActionInvite)).toBeInTheDocument();
    expect(screen.queryByText("NPS")).not.toBeInTheDocument();
    expect(screen.queryByText("92%")).not.toBeInTheDocument();
    expect(screen.queryByText("4.8")).not.toBeInTheDocument();
    expect(screen.queryByText(/Margin/i)).not.toBeInTheDocument();
  });

  it("hides the setup ring after onboarding steps are actually done", () => {
    render(
      <OpsDashboard
        data={emptyDash}
        roleKey="owner"
        features={["settings", "quotes"]}
        memberCount={2}
        workspaceStatus="active"
      />,
    );
    expect(screen.queryByRole("heading", { name: he.setupTitle })).not.toBeInTheDocument();
    expect(screen.getByText(he.commandQuietBody)).toBeInTheDocument();
    expect(screen.getAllByText(he.uxStartFirstQuote).length).toBeGreaterThan(0);
  });

  it("does not invent quote conversion when there are no quotes", () => {
    render(
      <OpsDashboard data={emptyDash} roleKey="owner" features={["crm", "quotes"]} memberCount={1} />,
    );
    expect(screen.queryByRole("img", { name: `${he.uxQuoteConversion}: ${he.uxMetricEmpty}` })).not.toBeInTheDocument();
    expect(screen.queryByText(he.uxQuoteNone)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: he.businessTitle })).not.toBeInTheDocument();
  });

  it("attention rows link to the live quote route", () => {
    render(<AttentionList groups={attentionDash.attention} />);
    expect(screen.getByText("Q-00012")).toBeInTheDocument();
    expect(screen.getByText(/ממתינות לאישור הלקוח/)).toBeInTheDocument();
    expect(screen.getByText(he.commandOpenQuote)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/app/quotes/$quoteId");
  });

  it("shows business health from real quote values once the workspace is operating", () => {
    render(
      <OpsDashboard
        data={{
          ...emptyDash,
          summary: {
            ...emptySummary,
            quotes_sent: 2,
            quotes_approved: 1,
            quotes_open: 2,
            quotes_approved_value: 21400,
            quotes_open_value: 48250,
          },
        }}
        roleKey="owner"
        features={["quotes"]}
        memberCount={2}
      />,
    );
    expect(screen.getByRole("heading", { name: he.businessTitle })).toBeInTheDocument();
    expect(screen.getByText(he.snapshotOpenValue)).toBeInTheDocument();
    expect(screen.getAllByText(/48,250/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/21,400/).length).toBeGreaterThan(0);
    expect(screen.queryByText(he.snapshotActiveQuotes)).not.toBeInTheDocument();
    expect(screen.queryByText(he.quotesKpiMargin)).not.toBeInTheDocument();
    expect(screen.getByText(he.dashboardSynced)).toBeInTheDocument();
  });

  it("renders active work from live today jobs and not an empty placeholder", () => {
    render(
      <OpsDashboard
        data={{
          ...emptyDash,
          today: {
            label_he: "היום",
            items: [
              {
                entity_type: "job",
                entity_id: "j1",
                number: "J-00005",
                title_he: "בביצוע",
                customer_name: "לקוח א",
                site_name: "DEMO Site A",
                scheduled_for: "2026-08-14T09:00:00+00:00",
                severity: "now",
                actions: [],
              },
            ],
          },
        }}
        roleKey="owner"
        features={["quotes"]}
        memberCount={2}
      />,
    );
    expect(screen.getByRole("heading", { name: he.activeWorkTitle })).toBeInTheDocument();
    expect(screen.getByText("J-00005")).toBeInTheDocument();
    expect(screen.getAllByText("DEMO Site A").length).toBeGreaterThan(0);
    expect(screen.getByText("בביצוע")).toBeInTheDocument();
    expect(screen.queryByText(he.activeWorkEmpty)).not.toBeInTheDocument();
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
    expect(screen.getByText(he.fieldOpsKicker)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: he.startJob })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: he.todayOpenJob })).toBeInTheDocument();
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
  it("computes real setup steps and a matching completion percent", () => {
    const solo = workspaceSetup({ roleKey: "owner", features: ["settings"], memberCount: 1 });
    expect(solo.complete).toBe(false);
    expect(solo.done).toBe(1);
    expect(solo.total).toBe(2);
    expect(solo.percent).toBe(50);
    expect(solo.steps.map((step) => step.id)).toEqual(["workspace", "invite"]);
    expect(solo.steps.find((step) => step.id === "invite")?.current).toBe(true);

    const staffed = workspaceSetup({ roleKey: "owner", features: ["settings"], memberCount: 2 });
    expect(staffed.complete).toBe(true);
    expect(staffed.percent).toBe(100);

    const pending = workspaceSetup({
      roleKey: "owner",
      features: ["settings"],
      memberCount: 1,
      pendingInvites: 1,
    });
    expect(pending.complete).toBe(true);
    expect(pending.percent).toBe(100);

    const unknownMembers = workspaceSetup({
      roleKey: "owner",
      features: ["settings"],
      memberCount: null,
    });
    expect(unknownMembers.complete).toBe(true);

    const sales = workspaceSetup({ roleKey: "sales", features: ["crm"], memberCount: 1 });
    expect(sales.complete).toBe(true);
    expect(sales.percent).toBe(100);
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

describe("nextBestAction", () => {
  it("prioritizes live commercial work over invite setup", () => {
    const setup = workspaceSetup({ roleKey: "owner", features: ["settings", "quotes"], memberCount: 1 });
    expect(
      nextBestAction({
        setup,
        summary: emptySummary,
        attention: [],
        usage: null,
        canCreateQuote: true,
        canInvite: true,
        canViewQuotes: true,
      })?.id,
    ).toBe("first-quote");

    const staffed = workspaceSetup({ roleKey: "owner", features: ["settings", "quotes"], memberCount: 2 });
    expect(
      nextBestAction({
        setup: staffed,
        summary: emptySummary,
        attention: [],
        usage: null,
        canCreateQuote: true,
        canInvite: true,
        canViewQuotes: true,
      })?.id,
    ).toBe("first-quote");

    const invited = workspaceSetup({
      roleKey: "owner",
      features: ["settings", "quotes"],
      memberCount: 1,
      pendingInvites: 1,
    });
    expect(invited.complete).toBe(true);
    expect(
      nextBestAction({
        setup: invited,
        summary: emptySummary,
        attention: [],
        usage: null,
        canCreateQuote: true,
        canInvite: true,
        canViewQuotes: true,
      })?.id,
    ).toBe("first-quote");

    const noQuoteYet = workspaceSetup({ roleKey: "owner", features: ["settings"], memberCount: 1 });
    expect(
      nextBestAction({
        setup: noQuoteYet,
        summary: emptySummary,
        attention: [],
        usage: null,
        canCreateQuote: false,
        canInvite: true,
        canViewQuotes: false,
      })?.id,
    ).toBe("setup-invite");
  });

  it("does not ask sales to administer the team", () => {
    const setup = workspaceSetup({ roleKey: "sales", features: ["crm", "quotes"], memberCount: 1 });
    expect(
      nextBestAction({
        setup,
        summary: emptySummary,
        attention: [],
        usage: null,
        canCreateQuote: true,
        canInvite: false,
        canViewQuotes: true,
      })?.id,
    ).toBe("first-quote");
  });

  it("prioritizes approved quotes pending project creation even while invite is open", () => {
    const setup = workspaceSetup({ roleKey: "owner", features: ["settings", "quotes", "projects"], memberCount: 1 });
    const action = nextBestAction({
      setup,
      summary: { ...emptySummary, quotes_approved: 2, quotes_open: 0 },
      attention: [
        {
          kind: "quote_approved_pending_project",
          label_he: "הצעות שאושרו וממתינות לפרויקט",
          count: 2,
          items: [
            {
              entity_type: "quote",
              entity_id: "q-approved",
              number: "1042",
              title_he: "אושרה · ממתינה לפרויקט",
              customer_name: null,
              site_name: null,
              scheduled_for: null,
              severity: "now",
              actions: ["create_project"],
            },
          ],
        },
      ],
      usage: null,
      canCreateQuote: true,
      canInvite: true,
      canViewQuotes: true,
      canCreateProject: true,
    });
    expect(action?.id).toBe("approved-pending-project");
    expect(action?.href).toBe("/app/quotes/q-approved");
    expect(action?.label).toBe(he.nextActionCreateProject);
  });
});

describe("ux metrics", () => {
  it("computes quote conversion only from real quote counts", () => {
    expect(quoteConversion(emptySummary)).toEqual({ percent: null, approved: 0, total: 0 });
    expect(
      quoteConversion({
        ...emptySummary,
        quotes_draft: 9,
      }),
    ).toEqual({ percent: null, approved: 0, total: 9 });
    expect(
      quoteConversion({
        ...emptySummary,
        quotes_draft: 1,
        quotes_approved: 1,
      }),
    ).toEqual({ percent: 50, approved: 1, total: 2 });
    expect(quotesInPlay(emptySummary)).toBe(0);
    expect(quotesInPlay({ ...emptySummary, quotes_draft: 2, quotes_sent: 1 })).toBe(3);
  });

  it("skips seat percent when the meter is unlimited", () => {
    expect(
      seatUtilization({
        key: "seats_field",
        label_he: "משתמשים בשטח",
        current: 2,
        limit: 0,
        unlimited: true,
        unit: "seats",
        at_limit: false,
      }),
    ).toBeNull();
    expect(
      seatUtilization({
        key: "seats_operator",
        label_he: "משתמשים במשרד",
        current: 1,
        limit: 1,
        unlimited: false,
        unit: "seats",
        at_limit: true,
      }),
    ).toBe(100);
    expect(
      seatUtilization({
        key: "seats_field",
        label_he: "משתמשים בשטח",
        current: 2,
        limit: 3,
        unlimited: false,
        unit: "seats",
        at_limit: false,
      }),
    ).toBe(67);
    expect(
      seatTone({
        key: "seats_operator",
        label_he: "משתמשים במשרד",
        current: 1,
        limit: 1,
        unlimited: false,
        unit: "seats",
        at_limit: true,
      }),
    ).toBe("warning");
    expect(
      seatTone({
        key: "seats_field",
        label_he: "משתמשים בשטח",
        current: 1,
        limit: 3,
        unlimited: false,
        unit: "seats",
        at_limit: false,
      }),
    ).toBe("success");
  });
});

describe("dashboard maturity", () => {
  it("moves from setup to operating only when real work exists", () => {
    expect(
      dashboardStage({ setupComplete: false, summary: emptySummary, todayCount: 0, jobsOpen: 0 }),
    ).toBe("setup");
    expect(
      dashboardStage({ setupComplete: true, summary: emptySummary, todayCount: 0, jobsOpen: 0 }),
    ).toBe("early");
    expect(
      dashboardStage({
        setupComplete: true,
        summary: { ...emptySummary, quotes_approved: 1 },
        todayCount: 0,
        jobsOpen: 0,
      }),
    ).toBe("operating");
  });
});

describe("attention waiting days", () => {
  it("counts whole days from the quote timestamp", () => {
    expect(waitingDays("2026-08-12T10:00:00Z", new Date("2026-08-16T12:00:00+03:00"))).toBe(4);
    expect(waitingDays(null)).toBeNull();
  });
});

describe("dayGreeting", () => {
  it("uses Jerusalem hours", () => {
    expect(dayGreeting(new Date("2026-08-15T06:00:00+03:00"))).toBe(he.greetingMorning);
    expect(dayGreeting(new Date("2026-08-15T14:00:00+03:00"))).toBe(he.greetingAfternoon);
    expect(dayGreeting(new Date("2026-08-15T19:00:00+03:00"))).toBe(he.greetingEvening);
  });
});
