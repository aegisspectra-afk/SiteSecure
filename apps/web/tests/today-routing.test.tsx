import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { he } from "../src/i18n/he";
import { homeVariant } from "../src/lib/home";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
    params,
    ...rest
  }: {
    to: string;
    children: ReactNode;
    className?: string;
    params?: Record<string, string>;
    [key: string]: unknown;
  }) => {
    let href = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) href = href.replace(`$${key}`, value);
    }
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    );
  },
  createFileRoute: () => (opts: { component: () => ReactNode }) => opts,
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  useNavigate: () => vi.fn(),
}));

const canMock = vi.fn((_role: string | undefined, permission: string) => permission === "dashboard.view");

vi.mock("../src/lib/can", () => ({
  can: (...args: unknown[]) => canMock(...(args as [string | undefined, string])),
}));

const emptyDashboard = {
  attention: { items: [] },
  today: { items: [] },
  quotes: { pipeline: [], recent: [] },
  summary: {
    quotes_draft: 0,
    quotes_sent: 0,
    quotes_viewed: 0,
    quotes_approved: 0,
    quotes_rejected: 0,
    quotes_open: 0,
    quotes_open_value: 0,
    quotes_approved_value: 0,
    jobs_open: 0,
    jobs_overdue: 0,
    jobs_unassigned: 0,
  },
};

const api = {
  getDashboard: vi.fn(async () => emptyDashboard),
  enRouteJob: vi.fn(),
  arrivedJob: vi.fn(),
  startJob: vi.fn(),
};

const sessionState = {
  role_key: "owner" as string,
};

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    session: {
      memberships: [
        {
          workspace_id: "ws1",
          role_key: sessionState.role_key,
          features: ["core", "jobs"],
        },
      ],
      profile: { full_name: "בודק" },
    },
    api,
  }),
}));

import { TodayPage } from "../src/routes/app/today";
import { AppHome } from "../src/routes/app/index";
import { DashboardPage } from "../src/routes/app/dashboard";

function renderPage(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe("homeVariant landing contract", () => {
  it("maps root home only — not child route ownership", () => {
    expect(homeVariant("owner")).toBe("ops");
    expect(homeVariant("manager")).toBe("ops");
    expect(homeVariant("sales")).toBe("sales");
    expect(homeVariant("viewer")).toBe("observe");
    expect(homeVariant("technician")).toBe("today");
  });
});

describe("/app root home resolution", () => {
  it("owner lands on dashboard", () => {
    sessionState.role_key = "owner";
    renderPage(<AppHome />);
    expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/app/dashboard");
  });

  it("manager lands on dashboard", () => {
    sessionState.role_key = "manager";
    renderPage(<AppHome />);
    expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/app/dashboard");
  });

  it("technician lands on today", () => {
    sessionState.role_key = "technician";
    renderPage(<AppHome />);
    expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/app/today");
  });
});

describe("/app/dashboard role gate", () => {
  it("technician is redirected to today (field home)", () => {
    sessionState.role_key = "technician";
    renderPage(<DashboardPage />);
    expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/app/today");
  });
});

describe("/app/today direct route — no homeVariant bounce", () => {
  beforeEach(() => {
    api.getDashboard.mockClear();
    canMock.mockImplementation((_role, permission) => permission === "dashboard.view");
  });

  for (const role of ["owner", "manager", "sales", "viewer", "technician"] as const) {
    it(`${role} stays on /app/today (no redirect to dashboard)`, async () => {
      sessionState.role_key = role;
      renderPage(<TodayPage />);
      expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: he.todayTitle })).toBeInTheDocument();
      });
      expect(api.getDashboard).toHaveBeenCalledWith("ws1");
    });
  }

  it("denies without dashboard.view", () => {
    sessionState.role_key = "owner";
    canMock.mockReturnValue(false);
    renderPage(<TodayPage />);
    expect(screen.getByText(he.noDashboardPermission)).toBeInTheDocument();
    expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
  });
});
