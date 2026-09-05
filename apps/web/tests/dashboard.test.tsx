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
import { nextBestAction } from "../src/lib/next-best-action";
import { quoteConversion, quotesInPlay, seatTone, seatUtilization } from "../src/lib/ux-metrics";
import { liveAdminActions, workspaceSetup } from "../src/lib/workspace-setup";
import { dashboardStage } from "../src/lib/dashboard-maturity";
import { waitingDays } from "../src/lib/attention-queue";
import { formatMoney } from "../src/lib/quotes";

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
    render(
      <OpsDashboard data={emptyDash} roleKey="owner" features={["crm", "quotes"]} customerCount={0} countsReady />,
    );
    expect(screen.getByRole("heading", { name: he.dashboardTitleShort })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: he.activationTitle })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: he.nextActionTitle })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: he.activeWorkTitle })).toBeInTheDocument();
    expect(screen.getByText(he.todaySectionEmptyCompact)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: he.recentQuotesTitle })).toBeInTheDocument();
    expect(screen.getByText(he.recentQuotesEmptyTitle)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: he.quotePipelineTitle })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(he.dashboardKpiLabel)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: he.activationCta })).toBeInTheDocument();
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

  it("does not surface developer security health on the operational dashboard", () => {
    render(
      <OpsDashboard
        data={emptyDash}
        roleKey="owner"
        features={["settings"]}
        customerCount={1}
        countsReady
      />,
    );
    expect(screen.queryByLabelText(he.securityBarHealthy)).not.toBeInTheDocument();
    expect(screen.queryByText("Authentication")).not.toBeInTheDocument();
    expect(screen.queryByText("Tenant Isolation")).not.toBeInTheDocument();
  });

  it("owner empty state offers live quote creation first", () => {
    render(
      <OpsDashboard
        data={emptyDash}
        roleKey="owner"
        features={["crm", "quotes", "settings"]}
        memberCount={1}
        customerCount={0}
        countsReady
        workspaceStatus="active"
      />,
    );
    expect(screen.getByRole("button", { name: he.activationCta })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: he.newQuoteAction }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "לקוח חדש" })).not.toBeInTheDocument();
    expect(screen.queryByText(he.nextActionInvite)).not.toBeInTheDocument();
  });

  it("sales empty state has no team administration", () => {
    render(
      <OpsDashboard
        data={{ ...emptyDash, home_variant: "sales" }}
        roleKey="sales"
        features={["crm", "quotes"]}
        customerCount={0}
        countsReady
      />,
    );
    expect(screen.queryByText(he.inviteUser)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: he.setupTitle })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: he.activationCta })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: he.newQuoteAction }).length).toBeGreaterThan(0);
  });

  it("shows a compact usage warning only when a meter is near or over limit", () => {
    render(
      <OpsDashboard
        data={{
          ...emptyDash,
          summary: { ...emptySummary, quotes_open: 1, quotes_sent: 1, quotes_open_value: 100 },
          recent_quotes: [
            {
              id: "q1",
              number: "Q-00001",
              status: "sent",
              customer_name: null,
              total_gross: 100,
              updated_at: "2026-08-15T12:00:00Z",
            },
          ],
        }}
        roleKey="owner"
        features={["settings", "quotes"]}
        memberCount={1}
        customerCount={1}
        countsReady
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
            },
          ],
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: he.usageThresholdTitle })).toBeInTheDocument();
    expect(screen.getByText(he.usageThresholdBody("משתמשים במשרד"))).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: he.usageTitle })).not.toBeInTheDocument();
  });

  it("hides usage entirely when quotas are healthy", () => {
    render(
      <OpsDashboard
        data={{
          ...emptyDash,
          summary: { ...emptySummary, quotes_open: 1, quotes_sent: 1, quotes_open_value: 100 },
        }}
        roleKey="owner"
        features={["settings", "quotes"]}
        memberCount={1}
        customerCount={1}
        countsReady
        usage={{
          workspace_id: "w1",
          plan_key: "business",
          active_members: 2,
          pending_invites: 0,
          meters: [
            {
              key: "quota_quotes",
              label_he: "הצעות מחיר",
              current: 5,
              limit: 50,
              unlimited: false,
              unit: "quotes",
              at_limit: false,
              occupants: [],
            },
          ],
        }}
      />,
    );
    expect(screen.queryByRole("heading", { name: he.usageTitle })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: he.usageThresholdTitle })).not.toBeInTheDocument();
  });

  it("renders commercial pulse once the workspace is operating", () => {
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
        features={["settings", "quotes", "crm"]}
        memberCount={1}
        customerCount={1}
        countsReady
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
    expect(screen.queryByRole("heading", { name: he.activationTitle })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: he.commercialPulseTitle })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: he.usageThresholdTitle })).toBeInTheDocument();
    expect(screen.queryByText(he.nextActionInvite)).not.toBeInTheDocument();
    expect(screen.queryByText("NPS")).not.toBeInTheDocument();
    expect(screen.queryByText(/Margin/i)).not.toBeInTheDocument();
  });

  it("shows activation card for empty workspace instead of invite-first setup", () => {
    render(
      <OpsDashboard
        data={emptyDash}
        roleKey="owner"
        features={["settings", "quotes", "crm"]}
        customerCount={0}
        countsReady
        memberCount={1}
      />,
    );
    expect(screen.getByRole("heading", { name: he.activationTitle })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: he.activationCta })).toBeInTheDocument();
    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
    expect(screen.queryByText(he.nextActionInvite)).not.toBeInTheDocument();
  });

  it("hides activation after first quote exists", () => {
    render(
      <OpsDashboard
        data={{ ...emptyDash, summary: { ...emptySummary, quotes_draft: 1 } }}
        roleKey="owner"
        features={["quotes", "crm"]}
        customerCount={1}
        countsReady
        memberCount={2}
      />,
    );
    expect(screen.queryByRole("heading", { name: he.activationTitle })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: he.activationTitleWithCustomer })).not.toBeInTheDocument();
  });

  it("does not show create-quote activation CTA without quotes.create", () => {
    render(
      <OpsDashboard data={emptyDash} roleKey="viewer" features={["crm", "quotes"]} customerCount={0} countsReady />,
    );
    expect(screen.queryByRole("button", { name: he.activationCta })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: he.activationTitle })).not.toBeInTheDocument();
  });

  it("shows customer-only activation when quotes.create is missing but crm.create exists", () => {
    render(
      <OpsDashboard
        data={emptyDash}
        roleKey="founding_technician"
        features={["crm"]}
        customerCount={0}
        countsReady
      />,
    );
    expect(screen.getByRole("heading", { name: he.activationCreateCustomerTitle })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: he.activationCreateCustomer })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: he.activationCta })).not.toBeInTheDocument();
  });

  it("hides the setup ring after onboarding steps are actually done", () => {
    render(
      <OpsDashboard
        data={emptyDash}
        roleKey="owner"
        features={["settings", "quotes", "crm"]}
        memberCount={2}
        customerCount={1}
        countsReady
        workspaceStatus="active"
      />,
    );
    expect(screen.queryByRole("heading", { name: he.setupTitle })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: he.activationTitleWithCustomer })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: he.commandTitle })).not.toBeInTheDocument();
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
    expect(screen.getByText(/Q-00012/)).toBeInTheDocument();
    expect(screen.getByText(he.commandOpenQuote)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/app/quotes/$quoteId");
  });

  it("hides the KPI row during activation for an empty workspace", () => {
    render(
      <OpsDashboard data={emptyDash} roleKey="owner" features={["crm", "quotes"]} customerCount={0} countsReady />,
    );
    expect(screen.queryByLabelText(he.dashboardKpiLabel)).not.toBeInTheDocument();
    expect(screen.queryByText(he.kpiConversionLabel)).not.toBeInTheDocument();
  });

  it("places needs attention before business pulse when quotes exist", () => {
    render(
      <OpsDashboard
        data={{
          ...attentionDash,
          summary: {
            ...emptySummary,
            quotes_sent: 1,
            quotes_open: 1,
            quotes_open_value: 8400,
          },
        }}
        roleKey="owner"
        features={["quotes"]}
        customerCount={1}
        countsReady
        memberCount={2}
      />,
    );
    const attentionHeading = screen.getByRole("heading", { name: he.commandTitleCount(1) });
    const businessHeading = screen.getByRole("heading", { name: he.commercialPulseTitle });
    expect(
      attentionHeading.compareDocumentPosition(businessHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("dedupes viewed+expiring into one attention row with secondary signal", () => {
    render(
      <OpsDashboard
        data={{
          ...emptyDash,
          attention: [
            {
              kind: "quote_awaiting_us",
              label_he: "viewed",
              count: 1,
              items: [
                {
                  entity_type: "quote",
                  entity_id: "q-dup",
                  number: "Q-00024",
                  title_he: "נצפתה",
                  customer_name: "לקוח",
                  site_name: null,
                  scheduled_for: null,
                  severity: "now",
                  actions: ["expiring_soon"],
                },
              ],
            },
            {
              kind: "quote_expiring",
              label_he: "expiring",
              count: 1,
              items: [
                {
                  entity_type: "quote",
                  entity_id: "q-dup",
                  number: "Q-00024",
                  title_he: "פג תוקף בקרוב",
                  customer_name: "לקוח",
                  site_name: null,
                  scheduled_for: null,
                  severity: "now",
                  actions: [],
                },
              ],
            },
          ],
          summary: { ...emptySummary, quotes_viewed: 1, quotes_open: 1, quotes_open_value: 100 },
        }}
        roleKey="owner"
        features={["quotes"]}
        customerCount={1}
        countsReady
      />,
    );
    expect(screen.getByRole("heading", { name: he.commandTitleCount(1) })).toBeInTheDocument();
    expect(screen.getAllByText(/Q-00024/)).toHaveLength(1);
    expect(screen.getByText(new RegExp(he.commandViewedWhy))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(he.commandExpiringWhy))).toBeInTheDocument();
    expect(screen.getByText(he.commandOpenQuote)).toBeInTheDocument();
  });

  it("shows create project CTA for approved pending project", () => {
    render(
      <OpsDashboard
        data={{
          ...emptyDash,
          attention: [
            {
              kind: "quote_approved_pending_project",
              label_he: "approved",
              count: 1,
              items: [
                {
                  entity_type: "quote",
                  entity_id: "q-ap",
                  number: "Q-00050",
                  title_he: "אושרה",
                  customer_name: "לקוח",
                  site_name: null,
                  scheduled_for: null,
                  severity: "now",
                  actions: ["create_project"],
                },
              ],
            },
          ],
          summary: { ...emptySummary, quotes_approved: 1, quotes_open: 0 },
        }}
        roleKey="owner"
        features={["quotes", "projects"]}
        customerCount={1}
        countsReady
      />,
    );
    expect(screen.getByText(he.nextActionCreateProject)).toBeInTheDocument();
    expect(screen.queryByText(he.attentionTypeAction)).not.toBeInTheDocument();
  });

  it("shows truthful job count in the hero field-today chip", () => {
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
              {
                entity_type: "job",
                entity_id: "j2",
                number: "J-00006",
                title_he: "מתוכננת",
                customer_name: "לקוח ב",
                site_name: "DEMO Site B",
                scheduled_for: "2026-08-14T14:00:00+00:00",
                severity: "next",
                actions: [],
              },
            ],
          },
        }}
        roleKey="owner"
        features={["quotes", "jobs"]}
        memberCount={2}
        customerCount={1}
        countsReady
      />,
    );
    expect(screen.getAllByText(/2 עבודות/).length).toBeGreaterThan(0);
    expect(screen.queryByText(he.dashboardFieldTechnicians(2))).not.toBeInTheDocument();
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
        customerCount={1}
        countsReady
      />,
    );
    expect(screen.getByRole("heading", { name: he.commercialPulseTitle })).toBeInTheDocument();
    expect(screen.getByText(he.snapshotOpenValue)).toBeInTheDocument();
    expect(screen.getAllByText(/48,250/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/21,400/).length).toBeGreaterThan(0);
    expect(screen.queryByText(he.snapshotActiveQuotes)).not.toBeInTheDocument();
    expect(screen.queryByText(he.quotesKpiMargin)).not.toBeInTheDocument();
    expect(screen.queryByText(he.dashboardSynced)).not.toBeInTheDocument();
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
        features={["quotes", "jobs"]}
        memberCount={2}
        customerCount={1}
        countsReady
      />,
    );
    expect(screen.getByRole("heading", { name: he.activeWorkTitle })).toBeInTheDocument();
    expect(screen.getByText(/J-00005/)).toBeInTheDocument();
    expect(screen.getAllByText(/DEMO Site A/).length).toBeGreaterThan(0);
    expect(screen.getByText("בביצוע")).toBeInTheDocument();
    expect(screen.queryByText(he.activeWorkEmpty)).not.toBeInTheDocument();
  });

  it("V2.1 command header chips and quiet attention copy", () => {
    render(
      <OpsDashboard
        data={{
          ...emptyDash,
          summary: { ...emptySummary, quotes_sent: 1, quotes_open: 2, quotes_open_value: 1500 },
        }}
        roleKey="owner"
        features={["quotes", "jobs"]}
        customerCount={1}
        countsReady
        displayName="Ilya"
      />,
    );
    expect(screen.getByText(he.commandQuietBody)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: he.commandHeaderAttention(0) })).toHaveAttribute(
      "href",
      "#command-heading",
    );
    expect(screen.getByRole("link", { name: he.commandHeaderQuotesOpen(2) })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: he.commandHeaderPipeline(formatMoney(1500)) }),
    ).toBeInTheDocument();
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
  it("tracks customer and quote milestones from live counts", () => {
    const empty = workspaceSetup({
      roleKey: "owner",
      features: ["settings", "crm", "quotes"],
      customerCount: 0,
      quoteCount: 0,
    });
    expect(empty.complete).toBe(false);
    expect(empty.done).toBe(1);
    expect(empty.total).toBe(3);
    expect(empty.percent).toBe(33);
    expect(empty.steps.map((step) => step.id)).toEqual(["workspace", "first_customer", "first_quote"]);
    expect(empty.steps.find((step) => step.id === "first_customer")?.current).toBe(true);

    const withCustomer = workspaceSetup({
      roleKey: "owner",
      features: ["settings", "crm", "quotes"],
      customerCount: 1,
      quoteCount: 0,
    });
    expect(withCustomer.done).toBe(2);
    expect(withCustomer.steps.find((step) => step.id === "first_quote")?.current).toBe(true);

    const activated = workspaceSetup({
      roleKey: "owner",
      features: ["settings", "crm", "quotes"],
      customerCount: 2,
      quoteCount: 1,
    });
    expect(activated.complete).toBe(true);
    expect(activated.percent).toBe(100);

    const unknown = workspaceSetup({
      roleKey: "owner",
      features: ["settings", "crm", "quotes"],
      customerCount: null,
      quoteCount: null,
    });
    expect(unknown.steps.map((step) => step.id)).toEqual(["workspace"]);
    expect(unknown.complete).toBe(true);

    const sales = workspaceSetup({
      roleKey: "sales",
      features: ["crm", "quotes"],
      customerCount: 0,
      quoteCount: 0,
    });
    expect(sales.steps.map((step) => step.id)).toEqual(["workspace", "first_customer", "first_quote"]);
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
  it("prioritizes first quote over invite when there are no quotes", () => {
    const setup = workspaceSetup({
      roleKey: "owner",
      features: ["settings", "quotes", "crm"],
      customerCount: 0,
      quoteCount: 0,
    });
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

    const noQuotePerm = workspaceSetup({
      roleKey: "owner",
      features: ["settings"],
      customerCount: 0,
      quoteCount: 0,
    });
    expect(
      nextBestAction({
        setup: noQuotePerm,
        summary: emptySummary,
        attention: [],
        usage: null,
        canCreateQuote: false,
        canInvite: true,
        canViewQuotes: false,
      }),
    ).toBeNull();
  });

  it("may invite field seats only after quotes exist", () => {
    const setup = workspaceSetup({
      roleKey: "owner",
      features: ["settings", "quotes", "crm"],
      customerCount: 1,
      quoteCount: 1,
    });
    expect(
      nextBestAction({
        setup,
        summary: { ...emptySummary, quotes_draft: 1 },
        attention: [],
        usage: {
          workspace_id: "w1",
          plan_key: "solo",
          active_members: 1,
          pending_invites: 0,
          meters: [
            {
              key: "seats_field",
              label_he: "שטח",
              current: 0,
              limit: 3,
              unlimited: false,
              unit: "seats",
              at_limit: false,
            },
          ],
        },
        canCreateQuote: true,
        canInvite: true,
        canViewQuotes: true,
      })?.id,
    ).toBe("invite-field");
  });

  it("does not ask sales to administer the team", () => {
    const setup = workspaceSetup({
      roleKey: "sales",
      features: ["crm", "quotes"],
      customerCount: 0,
      quoteCount: 0,
    });
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
    const setup = workspaceSetup({
      roleKey: "owner",
      features: ["settings", "quotes", "projects", "crm"],
      customerCount: 1,
      quoteCount: 2,
    });
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
