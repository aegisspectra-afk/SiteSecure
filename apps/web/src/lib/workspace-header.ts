import { he } from "../i18n/he";

export function givenName(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim() ?? "";
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? "";
}

export function greetingLine(
  greeting: string,
  fullName: string | null | undefined,
): string {
  const name = givenName(fullName);
  return name ? `${greeting}, ${name}` : greeting;
}

export function initialsFromName(
  fullName: string | null | undefined,
  email?: string | null,
): string {
  const parts = (fullName?.trim() || "").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? "";
    const last = parts[parts.length - 1]?.[0] ?? "";
    return `${first}${last}`.toUpperCase();
  }
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const local = (email ?? "").split("@")[0]?.trim() ?? "";
  if (local) return local.slice(0, 2).toUpperCase();
  return "";
}

export type SystemCheckId = "workspace" | "platform" | "network" | "auth";

export type SystemCheck = {
  id: SystemCheckId;
  ok: boolean;
  label: string;
  detail: string;
};

export type HeaderHealth = "ready" | "degraded" | "offline";

export function workspaceSystemChecks(input: {
  workspaceStatus?: string | null;
  hasSession: boolean;
  sessionError?: string | null;
  online: boolean;
  authenticated: boolean;
}): SystemCheck[] {
  const workspaceOk = input.workspaceStatus === "active";
  const platformOk = input.hasSession && !input.sessionError;
  return [
    {
      id: "workspace",
      ok: workspaceOk,
      label: he.systemCheckWorkspace,
      detail: workspaceOk ? he.systemCheckWorkspaceReady : he.systemCheckWorkspaceDown,
    },
    {
      id: "platform",
      ok: platformOk,
      label: he.systemCheckPlatform,
      detail: platformOk ? he.systemCheckPlatformReady : he.systemCheckPlatformDown,
    },
    {
      id: "network",
      ok: input.online,
      label: he.systemCheckNetwork,
      detail: input.online ? he.systemCheckNetworkReady : he.systemCheckNetworkDown,
    },
    {
      id: "auth",
      ok: input.authenticated,
      label: he.systemCheckAuth,
      detail: input.authenticated ? he.systemCheckAuthReady : he.systemCheckAuthDown,
    },
  ];
}

export function headerHealth(checks: SystemCheck[]): HeaderHealth {
  const network = checks.find((row) => row.id === "network");
  if (network && !network.ok) return "offline";
  if (checks.some((row) => !row.ok)) return "degraded";
  return "ready";
}

export function headerHealthLabel(health: HeaderHealth): string {
  if (health === "offline") return he.systemStatusOffline;
  if (health === "degraded") return he.systemStatusDegraded;
  return he.systemStatusReady;
}

export const ACCOUNT_POPOVER_MIN_WIDTH = 280;
export const HEADER_POPOVER_MIN_WIDTH = ACCOUNT_POPOVER_MIN_WIDTH;

export function placeAccountPopover(
  trigger: { top: number; left: number; right: number; width: number; bottom?: number },
  viewport: { width: number; height: number },
  options: {
    rtl: boolean;
    margin?: number;
    minWidth?: number;
    placement?: "cover" | "below" | "above";
    gap?: number;
  } = { rtl: true },
): { top?: number; bottom?: number; left: number; width: number; maxHeight: number } {
  const margin = options.margin ?? 8;
  const minWidth = options.minWidth ?? HEADER_POPOVER_MIN_WIDTH;
  const gap = options.gap ?? 6;
  const placement = options.placement ?? "cover";
  const available = Math.max(0, viewport.width - margin * 2);
  const width = Math.min(available, Math.max(minWidth, trigger.width));
  let left = options.rtl ? trigger.left : trigger.right - width;
  left = Math.min(Math.max(left, margin), Math.max(margin, viewport.width - width - margin));
  const edge = trigger.bottom ?? trigger.top;
  if (placement === "above") {
    return {
      bottom: Math.max(margin, viewport.height - trigger.top + gap),
      left,
      width,
      maxHeight: Math.max(0, trigger.top - margin - gap),
    };
  }
  let top = placement === "below" ? edge + gap : trigger.top;
  top = Math.min(Math.max(top, margin), Math.max(margin, viewport.height - margin));
  const maxHeight = Math.max(0, viewport.height - top - margin);
  return { top, left, width, maxHeight };
}
