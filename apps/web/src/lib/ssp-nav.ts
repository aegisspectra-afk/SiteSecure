import { he } from "../i18n/he";
import type { AppNavGroup, AppNavTo, BottomNavEntry } from "./app-nav";

export type SspNavAbility = (action: string) => boolean;

export type SspNavOpts = {
  sspCan?: SspNavAbility;
  isOfficer?: boolean;
};

export const SSP_ACTOR_KINDS = ["office", "ops_center"] as const;
export const SSP_CUSTOMER_SITE_KINDS = ["physical_site", "other"] as const;

const BOTTOM_PREF: AppNavTo[] = [
  "/app/ssp",
  "/app/ssp/alerts",
  "/app/ssp/patrols",
  "/app/ssp/activity",
  "/app/ssp/sites",
];

/**
 * Action-led IA: keep working capabilities, unify similar screens, defer untrusted modules.
 * Reports stay off the sidebar until real metrics exist.
 */
export function sspNavGroups(opts: SspNavOpts = {}): AppNavGroup[] {
  const sspCan = opts.sspCan ?? (() => true);
  const canSeeSites = sspCan("ssp.sites.view") || sspCan("ssp.forms.view");
  const canSeeForms = sspCan("ssp.forms.view");
  const canSeeWork = canSeeForms || sspCan("ssp.submissions.view") || sspCan("ssp.dashboard.view");
  const canSeeTemplates = canSeeForms || sspCan("ssp.patrols.view") || sspCan("ssp.settings.view") || sspCan("ssp.org.view");

  const items: Array<{ to: AppNavTo; label: string; icon: AppNavGroup["items"][number]["icon"]; show: boolean }> = [
    {
      to: "/app/ssp",
      label: he.sspNavDashboard,
      icon: "overview",
      show: sspCan("ssp.dashboard.view") || canSeeForms,
    },
    {
      to: "/app/ssp/alerts",
      label: he.sspNavOpsCenter,
      icon: "knowledge",
      show: sspCan("ssp.dashboard.view") || sspCan("ssp.events.view") || canSeeWork,
    },
    {
      to: "/app/ssp/patrols",
      label: he.sspNavPatrolsMain,
      icon: "calendar",
      show: sspCan("ssp.patrols.view"),
    },
    {
      to: "/app/ssp/activity",
      label: he.sspNavWork,
      icon: "today",
      show: canSeeWork,
    },
    {
      to: "/app/ssp/events",
      label: he.sspNavEventsHub,
      icon: "audit",
      show: sspCan("ssp.events.view"),
    },
    {
      to: "/app/ssp/sites",
      label: he.sspNavCustomerSites,
      icon: "sites",
      show: canSeeSites,
    },
    {
      to: "/app/ssp/mobility",
      label: he.sspNavMobility,
      icon: "work",
      show: canSeeSites,
    },
    {
      to: "/app/ssp/users",
      label: he.sspNavUsers,
      icon: "team",
      show: canSeeSites || sspCan("ssp.officers.view") || sspCan("ssp.org.view"),
    },
    {
      to: "/app/ssp/messages",
      label: he.sspNavMessages,
      icon: "ssp",
      show: canSeeWork,
    },
    {
      to: "/app/ssp/templates",
      label: he.sspNavTemplatesHub,
      icon: "settings",
      show: canSeeTemplates,
    },
  ];

  const visible = items.filter((item) => item.show).map(({ to, label, icon }) => ({ to, label, icon }));
  if (!visible.length) return [];
  return [{ id: "ops", label: he.sspNavOps, items: visible }];
}

export function sspBottomNav(opts: SspNavOpts = {}): BottomNavEntry[] {
  const allowed = new Set(sspNavDestinations(opts));
  return BOTTOM_PREF.filter((to) => allowed.has(to)).map((to) => {
    const groups = sspNavGroups(opts);
    const item = groups[0]?.items.find((entry) => entry.to === to);
    return {
      kind: "route" as const,
      to,
      label: item?.label ?? to,
      icon: item?.icon ?? "overview",
    };
  });
}

export function sspNavDestinations(opts?: SspNavOpts): AppNavTo[] {
  return sspNavGroups(opts).flatMap((group) => group.items.map((item) => item.to));
}

/** Implemented screens kept reachable from hubs, not as extra sidebar items. */
export const SSP_SECONDARY_NAV = [
  "/app/ssp/enrollments",
  "/app/ssp/organization",
  "/app/ssp/checkpoints",
  "/app/ssp/submissions",
  "/app/ssp/devices",
  "/app/ssp/officers",
  "/app/ssp/forms",
  "/app/ssp/task-templates",
  "/app/ssp/join",
] as const;

export const SSP_UNIMPLEMENTED_NAV = [
  "שליחת Push לספק חיצוני",
  "דוא״ל יוצא",
  "מיקום בזמן אמת לניידות",
  "תזמון משימות אוטומטי",
  "נוכחות / משמרות — אין מנגנון דיווח",
  "מצוקה — אין קליטה וטיפול ייעודי",
  "דוחות וניתוחים מתקדמים",
] as const;
