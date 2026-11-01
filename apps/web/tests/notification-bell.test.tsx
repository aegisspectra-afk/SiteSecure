import { createApiClient } from "@site-secure/api-client";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { NotificationBell } from "../src/components/NotificationBell";
import { he } from "../src/i18n/he";

const listNotifications = vi.fn(async () => ({
  items: [
    {
      id: "n1",
      workspace_id: "ws",
      type: "quote.viewed",
      title: "הצעת מחיר נצפתה",
      body: "הצעה Q-1",
      entity_type: "quote",
      entity_id: "q1",
      payload: {},
      read_at: null,
      created_at: "2026-11-01T00:00:00+00:00",
    },
  ],
  next_cursor: null,
  unread_count: 1,
}));
const markNotificationRead = vi.fn(async () => ({}));
const markAllNotificationsRead = vi.fn(async () => ({ unread_count: 0 }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
    onClick,
  }: {
    to: string;
    children: ReactNode;
    className?: string;
    onClick?: () => void;
  }) => (
    <a href={to} className={className} onClick={onClick}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock("../src/lib/session", () => ({
  useSession: () => ({
    api: {
      listNotifications,
      markNotificationRead,
      markAllNotificationsRead,
    },
    session: { memberships: [{ workspace_id: "ws" }] },
  }),
}));

function withClient(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

describe("NotificationBell", () => {
  it("exposes listNotifications on the live api client", () => {
    const api = createApiClient({
      baseUrl: "http://127.0.0.1:8001",
      getAccessToken: async () => null,
    });
    expect(typeof api.listNotifications).toBe("function");
    expect(typeof api.markNotificationRead).toBe("function");
    expect(typeof api.getNotificationPreferences).toBe("function");
  });

  it("shows unread count and Hebrew empty-state copy keys", async () => {
    render(withClient(<NotificationBell />));
    const trigger = await screen.findByTestId("notifications-bell");
    expect(trigger).toHaveAttribute("aria-label", he.notificationsBell);
    expect(await screen.findByText("1")).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(await screen.findByText("הצעת מחיר נצפתה")).toBeInTheDocument();
    expect(screen.getByText(he.notificationsMarkAll)).toBeInTheDocument();
    expect(screen.getByText(he.notificationsPrefs)).toBeInTheDocument();
    fireEvent.click(screen.getByText(he.notificationsMarkAll));
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalled());
  });
});
