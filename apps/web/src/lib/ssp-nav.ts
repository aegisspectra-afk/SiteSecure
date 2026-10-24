import { he } from "../i18n/he";
import type { AppNavGroup, AppNavTo, BottomNavEntry } from "./app-nav";

export type SspNavAbility = (action: string) => boolean;

export type SspNavOpts = {
  sspCan?: SspNavAbility;
  isOfficer?: boolean;
};

export const SSP_ACTOR_KINDS = ["office", "ops_center"] as const;
export const SSP_CUSTOMER_SITE_KINDS = ["physical_site", "other"] as const;

const ADMIN_BOTTOM: AppNavTo[] = [
  "/app/ssp",
  "/app/ssp/offices",
  "/app/ssp/users",
  "/app/ssp/forms",
  "/app/ssp/submissions",
];

const OFFICER_BOTTOM: AppNavTo[] = [
  "/app/ssp/my-forms",
  "/app/ssp/my-submissions",
  "/app/ssp/profile",
];

/**
 * Admin IA: dashboard, offices, users, form builder, assignments, submissions, reports, settings.
 * Officer IA: my forms, my submissions, profile.
 */
export function sspNavGroups(opts: SspNavOpts = {}): AppNavGroup[] {
  const sspCan = opts.sspCan ?? (() => true);
  const isOfficer = Boolean(opts.isOfficer);

  if (isOfficer) {
    const items: AppNavGroup["items"] = [
      { to: "/app/ssp/my-forms", label: he.sspNavMyForms, icon: "today" },
      { to: "/app/ssp/my-submissions", label: he.sspNavMySubmissions, icon: "audit" },
      { to: "/app/ssp/profile", label: he.sspNavProfile, icon: "team" },
    ];
    return [{ id: "me", label: he.sspNavGroupWorker, items }];
  }

  const canSeeSites = sspCan("ssp.sites.view") || sspCan("ssp.forms.view");
  const canSeeForms = sspCan("ssp.forms.view");
  const canSeePeople = sspCan("ssp.members.view") || sspCan("ssp.officers.view") || sspCan("ssp.org.view") || canSeeSites;
  const canSeeSettings = sspCan("ssp.settings.view") || sspCan("ssp.org.view") || canSeeForms;

  const items: Array<{ to: AppNavTo; label: string; icon: AppNavGroup["items"][number]["icon"]; show: boolean }> = [
    {
      to: "/app/ssp",
      label: he.sspNavDashboard,
      icon: "overview",
      show: sspCan("ssp.dashboard.view") || canSeeForms,
    },
    {
      to: "/app/ssp/offices",
      label: he.sspNavOffices,
      icon: "sites",
      show: canSeeSites,
    },
    {
      to: "/app/ssp/users",
      label: he.sspNavPeople,
      icon: "team",
      show: canSeePeople,
    },
    {
      to: "/app/ssp/forms",
      label: he.sspNavFormsBuilder,
      icon: "catalog",
      show: canSeeForms,
    },
    {
      to: "/app/ssp/assignments",
      label: he.sspNavAssignments,
      icon: "work",
      show: sspCan("ssp.assignments.manage") || canSeeForms,
    },
    {
      to: "/app/ssp/submissions",
      label: he.sspNavSubmittedForms,
      icon: "audit",
      show: sspCan("ssp.submissions.view") || sspCan("ssp.submissions.view_own"),
    },
    {
      to: "/app/ssp/reports",
      label: he.sspNavReports,
      icon: "overview",
      show: sspCan("ssp.dashboard.view") || canSeeForms,
    },
    {
      to: "/app/ssp/templates",
      label: he.sspNavSettings,
      icon: "settings",
      show: canSeeSettings,
    },
  ];

  const visible = items.filter((item) => item.show).map(({ to, label, icon }) => ({ to, label, icon }));
  if (!visible.length) return [];
  return [{ id: "ops", label: he.sspNavGroupManage, items: visible }];
}

export function sspBottomNav(opts: SspNavOpts = {}): BottomNavEntry[] {
  const allowed = new Set(sspNavDestinations(opts));
  const pref = opts.isOfficer ? OFFICER_BOTTOM : ADMIN_BOTTOM;
  const groups = sspNavGroups(opts);
  const flat = groups.flatMap((group) => group.items);
  return pref.filter((to) => allowed.has(to)).map((to) => {
    const item = flat.find((entry) => entry.to === to);
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
  "/app/ssp/devices",
  "/app/ssp/officers",
  "/app/ssp/task-templates",
  "/app/ssp/join",
  "/app/ssp/unit-codes",
  "/app/ssp/sites",
  "/app/ssp/alerts",
  "/app/ssp/patrols",
  "/app/ssp/activity",
  "/app/ssp/events",
  "/app/ssp/mobility",
  "/app/ssp/messages",
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
