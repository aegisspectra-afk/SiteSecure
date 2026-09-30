import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserAccountMenu } from "../src/components/UserAccountMenu";
import { WorkspaceSystemStatus } from "../src/components/WorkspaceSystemStatus";
import { he } from "../src/i18n/he";
import { planLabel, roleLabel } from "../src/lib/app-nav";
import { useOnlineStatus } from "../src/lib/use-online-status";
import {
  givenName,
  greetingLine,
  headerHealth,
  headerHealthAriaLabel,
  headerHealthSummary,
  initialsFromName,
  placeAccountPopover,
  sortSystemChecks,
  workspaceSystemChecks,
} from "../src/lib/workspace-header";

describe("workspace header helpers", () => {
  it("greets with the given name from the profile, not a hardcoded label", () => {
    expect(givenName("ilya kerner")).toBe("ilya");
    expect(greetingLine(he.greetingNight, "ilya kerner")).toBe(`${he.greetingNight}, ilya`);
    expect(greetingLine(he.greetingNight, null)).toBe(he.greetingNight);
    expect(initialsFromName("ilya kerner")).toBe("IK");
    expect(initialsFromName(null, "aegisspectra@gmail.com")).toBe("AE");
  });

  it("builds system checks only from real session, workspace and network state", () => {
    const ready = workspaceSystemChecks({
      workspaceStatus: "active",
      hasSession: true,
      sessionError: null,
      online: true,
      authenticated: true,
    });
    expect(headerHealth(ready)).toBe("ready");
    expect(ready.every((row) => row.ok)).toBe(true);

    const offline = workspaceSystemChecks({
      workspaceStatus: "active",
      hasSession: true,
      online: false,
      authenticated: true,
    });
    expect(headerHealth(offline)).toBe("offline");

    const inactive = workspaceSystemChecks({
      workspaceStatus: "inactive",
      hasSession: true,
      online: true,
      authenticated: true,
    });
    expect(headerHealth(inactive)).toBe("degraded");
    expect(inactive.find((row) => row.id === "workspace")?.detail).toBe(he.systemCheckWorkspaceDown);
  });

  it("names the status control with title and current health", () => {
    expect(headerHealthAriaLabel("ready")).toBe(`${he.systemStatusTitle}: ${he.systemStatusReady}`);
    expect(headerHealthAriaLabel("degraded")).toBe(`${he.systemStatusTitle}: ${he.systemStatusDegraded}`);
    expect(headerHealthAriaLabel("offline")).toBe(`${he.systemStatusTitle}: ${he.systemStatusOffline}`);
    expect(headerHealthSummary("ready")).toBe(he.systemStatusSummaryReady);
    expect(headerHealthSummary("degraded")).toBe(he.systemStatusSummaryDegraded);
    expect(headerHealthSummary("offline")).toBe(he.systemStatusSummaryOffline);
  });

  it("sorts failing checks before healthy ones", () => {
    const sorted = sortSystemChecks(
      workspaceSystemChecks({
        workspaceStatus: "inactive",
        hasSession: true,
        online: true,
        authenticated: true,
      }),
    );
    expect(sorted[0]?.id).toBe("workspace");
    expect(sorted[0]?.ok).toBe(false);
    expect(sorted.every((row, index) => index === 0 || row.ok)).toBe(true);
  });

  it("keeps the account popover inside the viewport and covers the trigger", () => {
    const rtl = placeAccountPopover(
      { top: 12, left: 8, right: 188, width: 180 },
      { width: 390, height: 700 },
      { rtl: true },
    );
    expect(rtl.left).toBeGreaterThanOrEqual(8);
    expect(rtl.left + rtl.width).toBeLessThanOrEqual(390 - 8);
    expect(rtl.top).toBe(12);

    const ltr = placeAccountPopover(
      { top: 12, left: 900, right: 1080, width: 180 },
      { width: 1100, height: 700 },
      { rtl: false },
    );
    expect(ltr.left).toBeGreaterThanOrEqual(8);
    expect(ltr.left + ltr.width).toBeLessThanOrEqual(1100);
    const below = placeAccountPopover(
      { top: 12, left: 8, right: 188, bottom: 48, width: 180 },
      { width: 390, height: 700 },
      { rtl: true, placement: "below" },
    );
    expect(below.top).toBe(54);
    expect(below.left).toBeGreaterThanOrEqual(8);

    const above = placeAccountPopover(
      { top: 620, left: 8, right: 188, bottom: 664, width: 180 },
      { width: 390, height: 700 },
      { rtl: true, placement: "above" },
    );
    expect(above.bottom).toBe(700 - 620 + 6);
    expect(above.maxHeight).toBeLessThan(620);
    expect(above.top).toBeUndefined();
  });
});

describe("workspace command header controls", () => {
  it("shows a quiet ready dot without the ready label in the trigger", () => {
    const checks = workspaceSystemChecks({
      workspaceStatus: "active",
      hasSession: true,
      online: true,
      authenticated: true,
    });
    render(<WorkspaceSystemStatus checks={checks} />);
    const trigger = screen.getByRole("button", {
      name: `${he.systemStatusTitle}: ${he.systemStatusReady}`,
    });
    expect(trigger).toBeInTheDocument();
    expect(within(trigger).queryByText(he.systemStatusReady)).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: he.systemStatusOffline })).not.toBeInTheDocument();
    const chevron = trigger.querySelector(".system-status-chevron");
    expect(chevron).toBeTruthy();
    expect(chevron).not.toHaveClass("rotate-180");
    fireEvent.click(trigger);
    expect(trigger.querySelector(".system-status-chevron")).toHaveClass("rotate-180");
    const panel = screen.getByRole("dialog", { name: he.systemStatusTitle });
    expect(panel).toHaveClass("ops-header-popover");
    expect(within(panel).getByText(he.systemStatusSummaryReady)).toBeInTheDocument();
    expect(within(panel).queryByText(he.systemStatusTitle)).not.toBeInTheDocument();
    expect(within(panel).getByText(he.systemCheckNetwork)).toBeInTheDocument();
    expect(within(panel).getAllByText(he.systemCheckNetworkReady).length).toBeGreaterThan(0);
    expect(within(panel).queryByRole("img", { name: he.systemStatusOffline })).not.toBeInTheDocument();
  });

  it("surfaces a full degraded chip and lists failures first", () => {
    const checks = workspaceSystemChecks({
      workspaceStatus: "inactive",
      hasSession: true,
      online: true,
      authenticated: true,
    });
    render(<WorkspaceSystemStatus checks={checks} />);
    const trigger = screen.getByRole("button", {
      name: `${he.systemStatusTitle}: ${he.systemStatusDegraded}`,
    });
    expect(within(trigger).getByText(he.systemStatusDegraded)).toBeInTheDocument();
    fireEvent.click(trigger);
    const panel = screen.getByRole("dialog", { name: he.systemStatusTitle });
    expect(within(panel).getByText(he.systemStatusSummaryDegraded)).toBeInTheDocument();
    const rows = within(panel).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent(he.systemCheckWorkspace);
    expect(rows[0]).toHaveTextContent(he.systemCheckWorkspaceDown);
  });

  it("renders the network Lottie only while offline, inside the status popover", () => {
    const checks = workspaceSystemChecks({
      workspaceStatus: "active",
      hasSession: true,
      online: false,
      authenticated: true,
    });
    const { rerender } = render(<WorkspaceSystemStatus checks={checks} />);
    expect(screen.getByRole("img", { name: he.systemStatusOffline })).toBeInTheDocument();
    expect(screen.getByText(he.systemStatusOffline)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: `${he.systemStatusTitle}: ${he.systemStatusOffline}` }),
    );
    const panel = screen.getByRole("dialog", { name: he.systemStatusTitle });
    expect(panel).toHaveClass("ops-header-popover");
    const panelLottie = within(panel).getByRole("img", { name: he.systemStatusOffline });
    expect(panelLottie).toHaveStyle({ width: "43px", height: "36px" });
    expect(within(panel).getByText(he.systemCheckNetworkDown)).toBeInTheDocument();
    expect(within(panel).getByText(he.systemStatusSummaryOffline)).toBeInTheDocument();

    rerender(
      <WorkspaceSystemStatus
        checks={workspaceSystemChecks({
          workspaceStatus: "active",
          hasSession: true,
          online: true,
          authenticated: true,
        })}
      />,
    );
    expect(screen.queryByRole("img", { name: he.systemStatusOffline })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `${he.systemStatusTitle}: ${he.systemStatusReady}` }),
    ).toBeInTheDocument();
    expect(screen.queryByText(he.systemStatusReady)).not.toBeInTheDocument();
  });

  it("reads role and plan from the catalog, not from copy in the menu", () => {
    render(
      <UserAccountMenu
        displayName="ilya kerner"
        email="aegisspectra@gmail.com"
        roleKey="owner"
        planKey="solo"
        canSettings
        canSecurity
        canUsers
        isPlatformAdmin
        onSettings={vi.fn()}
        onSecurity={vi.fn()}
        onUsers={vi.fn()}
        onSignOut={vi.fn()}
        onAdmin={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: he.userMenu })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: he.userMenu })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: he.userMenu }));
    const panel = screen.getByRole("dialog", { name: he.userMenu });
    expect(within(panel).getByText("ilya kerner")).toBeInTheDocument();
    expect(within(panel).getAllByText("ilya kerner")).toHaveLength(1);
    expect(within(panel).getByText("aegisspectra@gmail.com")).toBeInTheDocument();
    expect(within(panel).getByText(`${roleLabel("owner")} · ${planLabel("solo")}`)).toBeInTheDocument();
    expect(within(panel).queryByText(he.accountMenuKicker)).not.toBeInTheDocument();
    expect(within(panel).getByText(he.accountManage)).toBeInTheDocument();
    expect(within(panel).getByRole("menuitem", { name: he.navSettings })).toBeInTheDocument();
    expect(within(panel).getByRole("menuitem", { name: he.navSecurity })).toBeInTheDocument();
    expect(within(panel).getByRole("menuitem", { name: he.navUsers })).toBeInTheDocument();
    expect(within(panel).getByRole("menuitem", { name: he.adminNav })).toBeInTheDocument();
    const signOut = within(panel).getByRole("menuitem", { name: he.signOut });
    expect(signOut).toBeInTheDocument();
    expect(signOut).toHaveClass("text-danger");
    expect(within(panel).queryByText(he.nextActionInvite)).not.toBeInTheDocument();
    expect(within(panel).queryByText(he.nextActionInviteBody)).not.toBeInTheDocument();
  });

  it("closes on Escape and click outside", () => {
    render(
      <UserAccountMenu
        displayName="ilya kerner"
        email="aegisspectra@gmail.com"
        roleKey="owner"
        planKey="business"
        canSettings
        canSecurity
        onSettings={vi.fn()}
        onSecurity={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: he.userMenu }));
    expect(screen.getByRole("dialog", { name: he.userMenu })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: he.navSettings })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("dialog", { name: he.userMenu }), { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: he.navSecurity })).toHaveFocus();
    expect(screen.getByText(`${roleLabel("owner")} · ${planLabel("business")}`)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: he.userMenu })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: he.userMenu }));
    expect(screen.getByRole("dialog", { name: he.userMenu })).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog", { name: he.userMenu })).not.toBeInTheDocument();
  });
});

describe("useOnlineStatus", () => {
  it("follows browser online and offline events", () => {
    let onLine = true;
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => onLine,
    });
    function Probe() {
      const online = useOnlineStatus();
      return <span>{online ? "on" : "off"}</span>;
    }
    render(<Probe />);
    expect(screen.getByText("on")).toBeInTheDocument();
    onLine = false;
    fireEvent(window, new Event("offline"));
    expect(screen.getByText("off")).toBeInTheDocument();
    onLine = true;
    fireEvent(window, new Event("online"));
    expect(screen.getByText("on")).toBeInTheDocument();
  });
});
