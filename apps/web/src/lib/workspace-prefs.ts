/** Map Settings prefs ↔ workspace_settings JSON columns (production persistence). */

import type { WorkspaceSettingsOut } from "@site-secure/api-client";

export type WorkspacePrefs = {
  currency: "ILS";
  quotePrefix: string;
  projectPrefix: string;
  siteFilePrefix: string;
  quoteValidityDays: number;
  showVatOnQuotes: boolean;
  paymentTerms: string;
  pdfNotes: string;
  siteRequireAddress: boolean;
  siteRequireContact: boolean;
  siteRequireAccessNotes: boolean;
  notifyQuoteViewed: boolean;
  notifyQuoteApproved: boolean;
  notifyJobOverdue: boolean;
  notifyTeamInvite: boolean;
};

export const DEFAULT_WORKSPACE_PREFS: WorkspacePrefs = {
  currency: "ILS",
  quotePrefix: "Q-",
  projectPrefix: "P-",
  siteFilePrefix: "SF-",
  quoteValidityDays: 14,
  showVatOnQuotes: true,
  paymentTerms: "שוטף + 30",
  pdfNotes: "",
  // Explicit True only — matches server enforcement (missing = not required).
  siteRequireAddress: false,
  siteRequireContact: false,
  siteRequireAccessNotes: false,
  notifyQuoteViewed: false,
  notifyQuoteApproved: false,
  notifyJobOverdue: false,
  notifyTeamInvite: false,
};

export function prefsFromSettings(settings: WorkspaceSettingsOut): WorkspacePrefs {
  const loc = settings.localization ?? {};
  const quotes = settings.quotes ?? {};
  const sites = (settings.scheduling?.sites as Record<string, unknown> | undefined) ?? {};
  const notify = (settings.notifications?.events as Record<string, unknown> | undefined) ?? {};
  return {
    currency: "ILS",
    quotePrefix: String(loc.quote_prefix ?? DEFAULT_WORKSPACE_PREFS.quotePrefix),
    projectPrefix: String(loc.project_prefix ?? DEFAULT_WORKSPACE_PREFS.projectPrefix),
    siteFilePrefix: String(loc.site_file_prefix ?? DEFAULT_WORKSPACE_PREFS.siteFilePrefix),
    quoteValidityDays: Number(quotes.validity_days ?? DEFAULT_WORKSPACE_PREFS.quoteValidityDays) || 14,
    showVatOnQuotes: quotes.show_vat !== false,
    paymentTerms: String(quotes.payment_terms ?? DEFAULT_WORKSPACE_PREFS.paymentTerms),
    pdfNotes: String(quotes.pdf_notes ?? ""),
    siteRequireAddress: sites.require_address === true,
    siteRequireContact: sites.require_contact === true,
    siteRequireAccessNotes: sites.require_access_notes === true,
    notifyQuoteViewed: notify.quote_viewed === true,
    notifyQuoteApproved: notify.quote_approved === true,
    notifyJobOverdue: notify.job_overdue === true,
    notifyTeamInvite: notify.team_invite === true,
  };
}

export function prefsToSettingsPatch(prefs: WorkspacePrefs): Partial<WorkspaceSettingsOut> {
  return {
    localization: {
      locale: "he",
      currency: "ILS",
      quote_prefix: prefs.quotePrefix || "Q-",
      project_prefix: prefs.projectPrefix || "P-",
      site_file_prefix: prefs.siteFilePrefix || "SF-",
    },
    quotes: {
      validity_days: prefs.quoteValidityDays,
      show_vat: prefs.showVatOnQuotes,
      payment_terms: prefs.paymentTerms,
      pdf_notes: prefs.pdfNotes,
    },
    scheduling: {
      sites: {
        require_address: prefs.siteRequireAddress,
        // require_contact is not enforced — site model has no contact field; omit active claim.
        require_access_notes: prefs.siteRequireAccessNotes,
      },
    },
    // Notification event toggles are not consumed by a dispatcher — do not patch as active prefs.
  };
}

/** @deprecated localStorage helpers retained for migration fallback only */
const KEY = "site-secure-workspace-prefs-v1";

export function loadWorkspacePrefs(): WorkspacePrefs {
  if (typeof window === "undefined") return { ...DEFAULT_WORKSPACE_PREFS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_WORKSPACE_PREFS };
    return { ...DEFAULT_WORKSPACE_PREFS, ...(JSON.parse(raw) as Partial<WorkspacePrefs>), currency: "ILS" };
  } catch {
    return { ...DEFAULT_WORKSPACE_PREFS };
  }
}

export function saveWorkspacePrefs(prefs: WorkspacePrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...prefs, currency: "ILS" }));
  } catch {
    /* private mode */
  }
}
