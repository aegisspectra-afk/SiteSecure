import { render, screen } from "@testing-library/react";
import type { AttentionGroup } from "@site-secure/api-client";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AttentionList } from "../src/components/dashboard/AttentionList";
import { CommandStatus } from "../src/components/dashboard/CommandStatus";
import { he } from "../src/i18n/he";
import { attentionVisual, attentionQueue } from "../src/lib/attention-queue";

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
      href={params ? `${to}?${new URLSearchParams(params).toString()}` : to}
      className={className}
      data-params={params ? JSON.stringify(params) : undefined}
    >
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

const quoteGroup: AttentionGroup[] = [
  {
    kind: "quote_awaiting_customer",
    label_he: "ממתינות",
    count: 1,
    items: [
      {
        entity_type: "quote",
        entity_id: "q-attn-1",
        number: "Q-00042",
        title_he: "ממתין לאישור הלקוח",
        customer_name: "לקוח דמו",
        site_name: "אתר הרצל",
        scheduled_for: null,
        severity: "next",
        actions: [],
        updated_at: "2026-09-20T10:00:00Z",
      },
    ],
  },
];

const expiringGroup: AttentionGroup[] = [
  {
    kind: "quote_expiring",
    label_he: "פג תוקף",
    count: 1,
    items: [
      {
        entity_type: "quote",
        entity_id: "q-exp",
        number: "Q-00099",
        title_he: "פג תוקף בקרוב",
        customer_name: "לקוח ב",
        site_name: null,
        scheduled_for: null,
        severity: "now",
        actions: [],
        updated_at: "2026-09-26T10:00:00Z",
      },
    ],
  },
];

const jobGroup: AttentionGroup[] = [
  {
    kind: "job_overdue",
    label_he: "באיחור",
    count: 1,
    items: [
      {
        entity_type: "job",
        entity_id: "job-1",
        number: "J-00007",
        title_he: "התקנה באיחור",
        customer_name: "לקוח ג",
        site_name: "אתר ג",
        scheduled_for: null,
        severity: "now",
        actions: [],
        updated_at: "2026-09-25T08:00:00Z",
      },
    ],
  },
];

describe("DASH-3 Requires Attention queue", () => {
  it("renders dense queue rows with reason, context, id, and real CTA", () => {
    render(<AttentionList groups={quoteGroup} framed={false} />);
    expect(screen.getByText(/לקוח דמו/)).toBeInTheDocument();
    expect(screen.getByText(/אתר הרצל/)).toBeInTheDocument();
    expect(screen.getByText("Q-00042")).toBeInTheDocument();
    expect(screen.getByText(he.commandOpenQuote)).toBeInTheDocument();
    expect(document.querySelector(".ops-attention-row.is-queue.is-interactive")).toBeTruthy();
    expect(document.querySelector(".ops-attention-row.is-tone-warning, .ops-attention-row.is-tone-info, .ops-attention-row.is-tone-neutral")).toBeTruthy();
    expect(document.querySelector(".ss-activity-row-leading")).toBeTruthy();
  });

  it("maps expiring quotes to critical tone presentation", () => {
    const row = attentionQueue(expiringGroup)[0];
    const visual = attentionVisual(row);
    expect(visual.tone).toBe("critical");
    expect(visual.color).toBe("red");
    render(<AttentionList groups={expiringGroup} framed={false} />);
    expect(document.querySelector(".ops-attention-row.is-tone-critical")).toBeTruthy();
  });

  it("links jobs to the canonical job route", () => {
    render(<AttentionList groups={jobGroup} framed={false} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", expect.stringContaining("/app/jobs/$jobId"));
    expect(link.getAttribute("data-params")).toContain("job-1");
    expect(screen.getByText(he.todayOpenJob)).toBeInTheDocument();
  });

  it("does not render dead chevrons or CTA when there is no navigable action", () => {
    render(
      <AttentionList
        groups={[
          {
            kind: "lead_follow_up",
            label_he: "ליד",
            count: 1,
            items: [
              {
                entity_type: "unknown",
                entity_id: "x1",
                number: "",
                title_he: "פריט ללא ניווט",
                customer_name: null,
                site_name: null,
                scheduled_for: null,
                severity: "later",
                actions: [],
              },
            ],
          },
        ]}
        framed={false}
      />,
    );
    expect(screen.getAllByText("פריט ללא ניווט").length).toBeGreaterThan(0);
    expect(document.querySelector(".ops-attention-row.is-static")).toBeTruthy();
    expect(document.querySelector(".ops-attention-cta")).toBeNull();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("→")).not.toBeInTheDocument();
  });

  it("shows compact all-clear empty state", () => {
    render(<CommandStatus attention={[]} />);
    expect(screen.getByRole("heading", { name: he.dashCommandQueue })).toBeInTheDocument();
    expect(screen.getByText(he.commandAllClear)).toBeInTheDocument();
    expect(document.querySelector(".ops-attention-calm.is-queue-clear")).toBeTruthy();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("viewer read-only suppresses create-project action", () => {
    render(
      <CommandStatus
        readOnly
        canCreateProject
        workspaceId="ws"
        attention={[
          {
            kind: "quote_approved_pending_project",
            label_he: "אושרה",
            count: 1,
            items: [
              {
                entity_type: "quote",
                entity_id: "q-ap",
                number: "Q-00055",
                title_he: "אושרה — לפרויקט",
                customer_name: "לקוח",
                site_name: null,
                scheduled_for: null,
                severity: "now",
                actions: ["create_project"],
                updated_at: "2026-09-26T10:00:00Z",
              },
            ],
          },
        ]}
      />,
    );
    expect(screen.queryByRole("button", { name: /פרויקט/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link")).toBeInTheDocument();
    expect(screen.getByText(he.commandOpenQuote)).toBeInTheDocument();
  });

  it("keeps RTL direction on queue chrome", () => {
    const { container } = render(<AttentionList groups={quoteGroup} framed={false} />);
    const row = container.querySelector(".ops-attention-row");
    expect(row).toBeTruthy();
    expect(container.querySelector(".ltr-meta")).toBeTruthy();
  });
});
